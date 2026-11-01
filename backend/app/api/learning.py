from fastapi import APIRouter, HTTPException

from app import content
from app.schemas import EventRequest, ProgressRequest, ProgressResponse
from app.services import metrics
from app.services.bank import bank

router = APIRouter(prefix="/api", tags=["learning"])

XP_PER_LEVEL = 100


_OPS = {
    "==": lambda a, b: a == b,
    ">=": lambda a, b: a >= b,
    ">": lambda a, b: a > b,
    "<=": lambda a, b: a <= b,
    "<": lambda a, b: a < b,
}


def _matches(trigger: dict, payload: dict) -> bool:
    """Условия из triggers.json ("when"). Поля, которых нет в payload, не проверяем:
    фронт может прислать событие без деталей — тогда урок показываем."""
    for cond in trigger.get("when", []):
        if cond["field"] in payload and not _OPS[cond["op"]](payload[cond["field"]], cond["value"]):
            return False
    return True


@router.post("/events")
def event(req: EventRequest):
    """Движок триггеров: событие + условия по payload → урок.

    Примеры payload: {"amount": 30000} для p2p_stranger, {"is_first": true} для salary,
    {"active_subscriptions": 3} для subscription, {"overspend_ratio": 1.4} для overspend.
    """
    for trig in content.lesson_triggers():
        if trig["event"] == req.type and _matches(trig, req.payload):
            return {"lesson": content.lesson(trig["lesson_id"])}
    return {"lesson": None}


@router.get("/lessons")
def lessons():
    """Все уроки в виде сторис, по порядку показа."""
    return content.lessons()


@router.get("/lessons/{lesson_id}")
def lesson(lesson_id: str):
    try:
        return content.lesson(lesson_id)
    except FileNotFoundError:
        raise HTTPException(404, "Нет такого урока")


@router.get("/quest/{quest_id}")
def quest(quest_id: str):
    try:
        return content.quest(quest_id)
    except FileNotFoundError:
        raise HTTPException(404, "Нет такого квеста")


ACTION_XP = {"safe_exit": 50, "first_goal_deposit": 20, "bridge": 30, "pushkin_start": 30}


def _progress(account, gained: int = 0) -> ProgressResponse:
    return ProgressResponse(
        xp=account.xp, level=1 + account.xp // XP_PER_LEVEL, done=sorted(account.done), gained=gained
    )


@router.get("/progress/{persona_id}", response_model=ProgressResponse)
def get_progress(persona_id: str):
    return _progress(bank.get(persona_id))


@router.post("/progress", response_model=ProgressResponse)
def progress(req: ProgressRequest):
    """Начисляет XP один раз за каждый урок, квест или правильное действие."""
    account = bank.get(req.persona_id)
    key, xp = None, 0
    if req.lesson_id:
        key, xp = f"lesson:{req.lesson_id}", content.lesson(req.lesson_id).get("xp", 20)
    elif req.quest_id:
        key, xp = f"quest:{req.quest_id}", content.quest(req.quest_id).get("xp", 50)
    elif req.action:
        key, xp = f"action:{req.action}", ACTION_XP.get(req.action, 0)
    if not key or key in account.done:
        return _progress(account)
    account.done.add(key)
    account.xp += xp
    if req.lesson_id:
        metrics.log(account, "lesson_completed", lesson_id=req.lesson_id)
    return _progress(account, gained=xp)
