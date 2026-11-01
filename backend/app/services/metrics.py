"""Продуктовые события демо и сводка метрик (docs/business/metrics.md).

События пишем в аккаунт (Account.events) — они сохраняются вместе со снимком в PostgreSQL (services/store.py)
и сбрасываются кнопкой «сначала». В пилоте те же события уйдут в аналитический поток банка.
"""
from datetime import datetime
from statistics import median

# Названия событий — как в docs/business/metrics.md
EVENTS = {
    "intercept_shown",  # показан экран перехвата
    "intercept_cancelled",  # после перехвата перевод не ушёл: отмена, звонок в банк или «мне предложили подработку»
    "intercept_continued",  # «Это мои деньги» — перевод проведён после второго подтверждения
    "safe_exit_opened",  # открыт «Безопасный выход»
    "safe_exit_action",  # действие «Безопасного выхода»: вернуть через банк, заблокировать контакт, обращение…
    "lesson_completed",
    "shield_checked",
}
# Что считаем предотвращённым транзитом (North Star): перевод не ушёл после перехвата
# или чужие деньги заморожены для возврата. В пилоте — только кейсы, подтверждённые аналитиком
PREVENTED_ACTIONS = {"return_funds"}


def log(account, name: str, **data) -> None:
    if name not in EVENTS:
        raise ValueError(f"Неизвестное событие {name}")
    account.events.append({"name": name, "at": datetime.now().isoformat(), "data": data})


def _rate(part: int, whole: int) -> float | None:
    return round(part / whole, 2) if whole else None


def summary(accounts: list) -> dict:
    events = sorted(
        ((datetime.fromisoformat(e["at"]), e["name"], e.get("data", {}), acc) for acc in accounts for e in acc.events),
        key=lambda x: x[0],
    )
    count = {name: 0 for name in EVENTS}
    for _, name, _, _ in events:
        count[name] += 1

    returned = sum(1 for _, n, d, _ in events if n == "safe_exit_action" and d.get("action") in PREVENTED_ACTIONS)

    # Конверсия «Безопасный выход» → действие: открытие засчитано, если до следующего открытия было действие
    opened = converted = 0
    for acc in accounts:
        session_open = False
        for e in acc.events:
            if e["name"] == "safe_exit_opened":
                opened += 1
                session_open = True
            elif e["name"] == "safe_exit_action" and session_open:
                converted += 1
                session_open = False

    # Время от подозрительного зачисления до первого защитного действия (отмена после перехвата или действие выхода)
    delays = []
    for acc in accounts:
        actions = sorted(
            datetime.fromisoformat(e["at"]) for e in acc.events if e["name"] in ("intercept_cancelled", "safe_exit_action")
        )
        for t in acc.transactions:
            if t.direction == "in" and t.flagged:
                after = [a for a in actions if a >= t.ts]
                if after:
                    delays.append((after[0] - t.ts).total_seconds())

    return {
        "events": count,
        "intercept_cancel_rate": _rate(count["intercept_cancelled"], count["intercept_shown"]),
        "safe_exit_conversion": _rate(converted, opened),
        "median_seconds_to_action": round(median(delays)) if delays else None,
        "prevented_transits": count["intercept_cancelled"] + returned,
    }
