from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import content
from app.services import metrics
from app.services.bank import bank

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


class ClientEvent(BaseModel):
    persona_id: str
    name: Literal["intercept_cancelled", "safe_exit_opened"]
    action: str | None = None  # для intercept_cancelled: cancel, call_bank или offered_job


@router.post("/events")
def client_event(req: ClientEvent):
    """События, которые решаются в интерфейсе без запроса к банку: отмена после перехвата, открытие «Безопасного выхода»."""
    if req.persona_id not in content.personas():
        raise HTTPException(404, f"Нет персонажа {req.persona_id}")
    data = {"action": req.action} if req.action else {}
    metrics.log(bank.get(req.persona_id), req.name, **data)
    return {"ok": True}


@router.get("/summary")
def summary(persona_id: str | None = None):
    """Метрики по текущей сессии демо: по одному аккаунту или по всем, кого открывали."""
    if persona_id is not None:
        if persona_id not in content.personas():
            raise HTTPException(404, f"Нет персонажа {persona_id}")
        accounts = [bank.get(persona_id)]
    else:
        accounts = bank.loaded()
    return metrics.summary(accounts)
