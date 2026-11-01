from fastapi import APIRouter, HTTPException

from app import content
from app.schemas import ShieldRequest, ShieldResponse
from app.services import metrics, shield
from app.services.bank import bank

router = APIRouter(prefix="/api/shield", tags=["shield"])


@router.post("/check", response_model=ShieldResponse)
def check(req: ShieldRequest):
    if not req.text and not req.image_base64:
        raise HTTPException(422, "Нужен text или image_base64")
    try:
        result = shield.check(req.text, req.image_base64)
    except shield.OcrUnavailable as e:
        raise HTTPException(503, str(e))
    except ValueError:
        raise HTTPException(422, "Не удалось прочитать картинку")
    if req.persona_id in content.personas():
        metrics.log(bank.get(req.persona_id), "shield_checked", risk=result.risk)
    return result
