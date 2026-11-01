"""Сохранение фейкового банка в PostgreSQL.

Аккаунты живут в памяти (services/bank.py), после каждого изменяющего запроса затронутые аккаунты
записываются снимком в таблицу account_state, а после перезапуска бэкенда читаются оттуда.
Если база недоступна (локальный запуск без Docker, тесты), работаем только в памяти, как раньше.
"""
import logging
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.schemas import Goal, Persona, Risk, Transaction

log = logging.getLogger(__name__)

_enabled: bool | None = None  # None — ещё не проверяли подключение


def to_state(account) -> dict:
    return {
        "persona": account.persona.model_dump(mode="json"),
        "transactions": [t.model_dump(mode="json") for t in account.transactions],
        "outgoing_paused_until": account.outgoing_paused_until.isoformat() if account.outgoing_paused_until else None,
        "xp": account.xp,
        "done": sorted(account.done),
        "last_intercept": account.last_intercept.model_dump(mode="json") if account.last_intercept else None,
        "goals": [g.model_dump(mode="json") for g in account.goals],
        "evidence": account.evidence,
        "events": account.events,
    }


def from_state(state: dict):
    from app.services.bank import Account

    paused = state.get("outgoing_paused_until")
    intercept = state.get("last_intercept")
    return Account(
        persona=Persona(**state["persona"]),
        transactions=[Transaction(**t) for t in state.get("transactions", [])],
        outgoing_paused_until=datetime.fromisoformat(paused) if paused else None,
        xp=state.get("xp", 0),
        done=set(state.get("done", [])),
        last_intercept=Risk(**intercept) if intercept else None,
        goals=[Goal(**g) for g in state.get("goals", [])],
        evidence=state.get("evidence", {}),
        events=state.get("events", []),
    )


def enabled() -> bool:
    """Доступна ли база. Проверяем один раз: при первой ошибке остаёмся в памяти до перезапуска."""
    global _enabled
    if _enabled is None:
        if not settings.persist_state:
            _enabled = False
            return False
        try:
            from app.db.models import Base
            from app.db.session import engine

            Base.metadata.create_all(engine)
            _enabled = True
            log.info("Состояние банка сохраняется в PostgreSQL")
        except SQLAlchemyError as e:
            _enabled = False
            log.warning("PostgreSQL недоступна — состояние банка только в памяти: %s", e.__class__.__name__)
    return _enabled


def load(persona_id: str):
    """Аккаунт из базы или None."""
    if not enabled():
        return None
    from app.db.models import AccountState
    from app.db.session import SessionLocal

    try:
        with SessionLocal() as s:
            row = s.get(AccountState, persona_id)
            return from_state(row.state) if row else None
    except (SQLAlchemyError, ValueError, KeyError) as e:
        # повреждённый или устаревший снимок — начинаем аккаунт заново, а не роняем демо
        log.warning("Не удалось прочитать аккаунт %s: %s", persona_id, e)
        return None


def save(accounts: dict) -> None:
    """Записать снимки аккаунтов {persona_id: Account}."""
    if not accounts or not enabled():
        return
    from app.db.models import AccountState
    from app.db.session import SessionLocal

    rows = [{"persona_id": pid, "state": to_state(acc)} for pid, acc in accounts.items()]
    stmt = insert(AccountState).values(rows)
    stmt = stmt.on_conflict_do_update(index_elements=["persona_id"], set_={"state": stmt.excluded.state, "updated_at": datetime.now()})
    try:
        with SessionLocal() as s, s.begin():
            s.execute(stmt)
    except SQLAlchemyError as e:
        log.warning("Не удалось сохранить состояние банка: %s", e)
