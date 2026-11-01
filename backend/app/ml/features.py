"""Признаки для скоринга перевода в момент попытки.

Единственный источник правды: им пользуются и бэкенд (app/services/risk.py),
и обучение (ml/src/features.py, ml/src/train_risk.py).

Операция — любой объект с полями ts, amount, direction, counterparty,
is_new_counterparty, channel и (необязательно) frozen: подходят и Transaction
из app.schemas, и Tx из генератора синтетики.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import median

FEATURES = [
    "minutes_since_stranger_incoming",   # минут с последнего зачисления от незнакомца (нет → NO_INCOMING_MINUTES)
    "stranger_incoming_24h",             # сколько ₽ пришло от незнакомцев за 24ч
    "forward_share",                     # перевод / сумма зачислений от незнакомцев за 24ч
    "is_new_recipient",                  # получатель новый
    "unique_stranger_senders_24h",
    "unique_stranger_senders_7d",
    "client_age",
    "card_age_days",
    "turnover_spike",                    # оборот за 24ч / средний дневной оборот за 30д
    "is_night",                          # 00:00–05:59
    "cash_withdrawal_after_incoming",    # снятие наличных после зачисления от незнакомца (24ч)
    "recipient_transfers_30d",           # сколько раз за 30д уже переводили этому получателю (постоянный поставщик ≠ новые реквизиты дропа)
    "stranger_income_days_30d",          # в сколько разных дней за 30д приходили деньги от незнакомцев (регулярная выручка)
    "stranger_median_amount_30d",        # медианное зачисление от незнакомца за 30д (оплаты заказов мельче транзитов)
]

NO_INCOMING_MINUTES = 7 * 24 * 60
MIN_DAILY_TURNOVER = 300.0  # чтобы у тех, кто почти не тратит, не было деления на ноль


@dataclass
class Transfer:
    ts: datetime
    amount: float
    to: str


# Признак → фраза для экрана перехвата (берём топ-3 по SHAP) и условие, когда фраза уместна.
PHRASES = {
    "stranger_incoming_24h": "{value} пришли от незнакомых отправителей за сутки",
    "minutes_since_stranger_incoming": "Деньги пришли от незнакомца {value:.0f} мин назад",
    "forward_share": "Вы переводите {value:.0%} этой суммы дальше",
    "is_new_recipient": "Новый получатель, раньше переводов ему не было",
    "unique_stranger_senders_24h": "{value:.0f} переводов от разных незнакомцев за сутки",
    "unique_stranger_senders_7d": "{value:.0f} разных незнакомых отправителей за неделю",
    "client_age": "Клиенту {value:.0f} лет",
    "card_age_days": "Карте всего {value:.0f} дн.",
    "turnover_spike": "Оборот за сутки в {value:.0f} раз выше обычного",
    "is_night": "Перевод ночью",
    "cash_withdrawal_after_incoming": "Наличные сняли сразу после зачисления",
}

_PHRASE_WHEN = {
    "stranger_incoming_24h": lambda v: v >= 5000,
    "minutes_since_stranger_incoming": lambda v: v < 24 * 60,
    "forward_share": lambda v: v >= 0.5,
    "is_new_recipient": lambda v: v >= 1,
    "unique_stranger_senders_24h": lambda v: v >= 2,
    "unique_stranger_senders_7d": lambda v: v >= 3,
    "client_age": lambda v: v < 18,
    "card_age_days": lambda v: v < 60,
    "turnover_spike": lambda v: v >= 3,
    "is_night": lambda v: v >= 1,
    "cash_withdrawal_after_incoming": lambda v: v >= 1,
}


def phrase(name: str, value: float) -> str | None:
    """Человеческая фраза для признака или None, если значение не подозрительное."""
    if name not in PHRASES or not _PHRASE_WHEN[name](value):
        return None
    if name == "minutes_since_stranger_incoming":
        value = max(value, 1)
    elif name == "forward_share":
        value = min(value, 1)
    elif name == "stranger_incoming_24h":
        value = f"{value:,.0f}".replace(",", " ") + " ₽"
    return PHRASES[name].format(value=value)


def _is_stranger_incoming(tx) -> bool:
    return tx.direction == "in" and tx.is_new_counterparty and not getattr(tx, "frozen", False)


def build_features(history, transfer: Transfer, client_age: int, card_age_days: float,
                   known: set[str] | None = None) -> dict:
    """history — операции клиента ДО перевода, по возрастанию времени.

    known — все контрагенты клиента до перевода. Если передан, history достаточно
    за последние 30 дней (так быстрее считать обучающую выборку).
    """
    now = transfer.ts
    day_ago, week_ago, month_ago = now - timedelta(days=1), now - timedelta(days=7), now - timedelta(days=30)

    last_stranger = None
    stranger_sum_24h = 0.0
    senders_24h, senders_7d = set(), set()
    known = set(known) if known is not None else set()
    turnover_24h = transfer.amount
    turnover_30d = 0.0
    cash_after = False
    to_recipient_30d = 0
    stranger_days_30d, stranger_amounts_30d = set(), []

    for tx in history:
        known.add(tx.counterparty)
        if tx.ts < month_ago:
            continue
        turnover_30d += tx.amount
        if tx.direction == "out" and tx.counterparty == transfer.to:
            to_recipient_30d += 1
        if _is_stranger_incoming(tx):
            stranger_days_30d.add(tx.ts.date())
            stranger_amounts_30d.append(tx.amount)
        if tx.ts >= day_ago:
            turnover_24h += tx.amount
        if _is_stranger_incoming(tx) and tx.ts >= week_ago:
            senders_7d.add(tx.counterparty)
            last_stranger = tx
            if tx.ts >= day_ago:
                senders_24h.add(tx.counterparty)
                stranger_sum_24h += tx.amount

    if last_stranger is not None and last_stranger.ts >= day_ago:
        cash_after = any(
            tx.direction == "out" and tx.channel == "cash" and tx.ts >= last_stranger.ts for tx in history
        )

    minutes = NO_INCOMING_MINUTES
    if last_stranger is not None:
        minutes = min((now - last_stranger.ts).total_seconds() / 60, NO_INCOMING_MINUTES)

    mean_daily = max(turnover_30d / 30, MIN_DAILY_TURNOVER)
    return {
        "minutes_since_stranger_incoming": round(max(minutes, 0.0), 1),
        "stranger_incoming_24h": round(stranger_sum_24h, 0),
        "forward_share": round(min(transfer.amount / stranger_sum_24h, 2.0), 3) if stranger_sum_24h else 0.0,
        "is_new_recipient": int(transfer.to not in known),
        "unique_stranger_senders_24h": len(senders_24h),
        "unique_stranger_senders_7d": len(senders_7d),
        "client_age": client_age,
        "card_age_days": round(card_age_days, 1),
        "turnover_spike": round(turnover_24h / mean_daily, 2),
        "is_night": int(now.hour < 6),
        "cash_withdrawal_after_incoming": int(cash_after),
        "recipient_transfers_30d": to_recipient_30d,
        "stranger_income_days_30d": len(stranger_days_30d),
        "stranger_median_amount_30d": round(median(stranger_amounts_30d), 0) if stranger_amounts_30d else 0.0,
    }


def rule_score(f: dict) -> tuple[float, list[str]]:
    """Прозрачные правила с баллами — бейзлайн и запасной вариант, если модели нет."""
    score, reasons = 0.0, []
    recent = f["minutes_since_stranger_incoming"] <= 60
    if recent:
        score += 0.35
        reasons.append(phrase("minutes_since_stranger_incoming", f["minutes_since_stranger_incoming"]))
        if f["forward_share"] >= 0.7:
            score += 0.3
            reasons.append(phrase("forward_share", f["forward_share"]))
    if f["is_new_recipient"]:
        score += 0.15
        reasons.append(phrase("is_new_recipient", 1))
    if f["client_age"] < 18:
        score += 0.1
        reasons.append(phrase("client_age", f["client_age"]))
    if f["unique_stranger_senders_24h"] >= 3:
        score += 0.2
        reasons.append(phrase("unique_stranger_senders_24h", f["unique_stranger_senders_24h"]))
    return round(min(score, 1.0), 2), reasons
