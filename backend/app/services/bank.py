"""Фейковый банк: балансы и история операций демо-персонажей.

Работаем с аккаунтами в памяти; после изменяющих запросов они сохраняются в PostgreSQL
(services/store.py) и переживают перезапуск бэкенда. Без базы — только память.
"""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app import content
from app.services import store
from app.schemas import Goal, Persona, Risk, Transaction


# Категория трат по названию магазина — для истории из content/personas.json, где её нет
CATEGORY_BY_NAME = {
    "Доставка еды": "food", "Кофейня": "food", "Кофейня у школы": "food", "Продукты": "food", "Столовая": "food",
    "Одежда": "clothes", "Магазин одежды": "clothes", "Магазин кроссовок": "clothes",
    "Кино": "fun", "Кинотеатр": "fun", "Игровой магазин": "fun",
    "Музыкальный сервис": "subscriptions", "Онлайн-кинотеатр": "subscriptions", "Подписка на музыку": "subscriptions",
}


def _category(h: dict) -> str | None:
    if h.get("category"):
        return h["category"]
    if h["direction"] != "out":
        return None
    if h.get("channel", "sbp") == "sbp":
        return "transfers"
    return CATEGORY_BY_NAME.get(h["counterparty"], "other")


@dataclass
class Account:
    persona: Persona
    transactions: list[Transaction] = field(default_factory=list)
    outgoing_paused_until: datetime | None = None
    xp: int = 0
    done: set[str] = field(default_factory=set)  # пройденные сторис и действия, за которые уже дали XP
    last_intercept: Risk | None = None  # последний перехваченный перевод — для панели «что видит банк»
    goals: list[Goal] = field(default_factory=list)  # цели и копилка
    # Доказательства к обращениям: номер пакета → число скриншотов. Сами картинки в демо не храним
    evidence: dict[str, int] = field(default_factory=dict)
    # Продуктовые события для метрик демо (services/metrics.py)
    events: list[dict] = field(default_factory=list)

    @property
    def balance(self) -> float:
        return self.persona.balance

    def known_counterparties(self) -> set[str]:
        return {t.counterparty for t in self.transactions}


class FakeBank:
    def __init__(self) -> None:
        self._accounts: dict[str, Account] = {}
        self._touched: set[str] = set()  # аккаунты, к которым обращались с последнего сохранения

    def take_touched(self) -> dict[str, Account]:
        """Аккаунты для сохранения после запроса (и сброс списка)."""
        touched, self._touched = self._touched, set()
        return {pid: self._accounts[pid] for pid in touched if pid in self._accounts}

    def reset(self, persona_id: str) -> Account:
        raw = content.personas()[persona_id]
        persona = Persona(**{k: raw[k] for k in Persona.model_fields if k in raw})
        account = Account(
            persona=persona,
            xp=raw.get("xp", 0),  # опыт из «Детского банка» — переносится мостом
            done=set(raw.get("done", [])),
            goals=[Goal(id=uuid.uuid4().hex[:6], **g) for g in raw.get("goals", [])],
        )
        now = datetime.now()
        for h in raw.get("history", []):
            account.transactions.append(
                Transaction(
                    id=uuid.uuid4().hex[:8],
                    ts=now - timedelta(days=h.get("days_ago", 1)),
                    amount=h["amount"],
                    direction=h["direction"],
                    counterparty=h["counterparty"],
                    is_new_counterparty=False,
                    channel=h.get("channel", "sbp"),
                    category=_category(h),
                )
            )
        self._accounts[persona_id] = account
        self._touched.add(persona_id)
        return account

    def loaded(self) -> list[Account]:
        """Аккаунты, которые открывали в этой сессии бэкенда."""
        return list(self._accounts.values())

    def get(self, persona_id: str) -> Account:
        if persona_id not in self._accounts:
            saved = store.load(persona_id)
            if saved is None:
                return self.reset(persona_id)
            self._accounts[persona_id] = saved
        self._touched.add(persona_id)
        return self._accounts[persona_id]

    def incoming(
        self, persona_id: str, amount: float, counterparty: str, is_new: bool, flagged: bool | None = None
    ) -> Transaction:
        account = self.get(persona_id)
        if flagged is None:
            # Сценарные зачисления проходят через ту же проверку, что и ручные «Пополнить»
            from app.services.risk import score_incoming

            flagged = score_incoming(account, amount, counterparty, is_new).level != "low"
        tx = Transaction(
            id=uuid.uuid4().hex[:8],
            ts=datetime.now(),
            amount=amount,
            direction="in",
            counterparty=counterparty,
            is_new_counterparty=is_new,
            flagged=flagged,
        )
        account.transactions.append(tx)
        account.persona.balance += amount
        return tx

    def outgoing(
        self, persona_id: str, amount: float, to: str, channel: str = "sbp", category: str = "transfers"
    ) -> Transaction:
        account = self.get(persona_id)
        tx = Transaction(
            id=uuid.uuid4().hex[:8],
            ts=datetime.now(),
            amount=amount,
            direction="out",
            counterparty=to,
            is_new_counterparty=to not in account.known_counterparties(),
            channel=channel,
            category=category,
        )
        account.transactions.append(tx)
        account.persona.balance -= amount
        return tx

    def freeze(self, persona_id: str, operation_id: str) -> Transaction | None:
        account = self.get(persona_id)
        for tx in account.transactions:
            if tx.id == operation_id and tx.direction == "in":
                tx.frozen = True
                return tx
        return None

    def last_suspicious_incoming(self, persona_id: str) -> Transaction | None:
        account = self.get(persona_id)
        for tx in reversed(account.transactions):
            if tx.direction == "in" and tx.is_new_counterparty and not tx.frozen:
                return tx
        return None

    def available(self, persona_id: str) -> float:
        """Баланс без замороженных сумм — их тратить нельзя."""
        account = self.get(persona_id)
        frozen = sum(t.amount for t in account.transactions if t.frozen)
        return account.balance - frozen


bank = FakeBank()
