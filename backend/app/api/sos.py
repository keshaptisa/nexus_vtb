import base64
import binascii
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from app import content
from app.schemas import (
    EvidenceRequest,
    PersonaRequest,
    ReportRequest,
    ReportResponse,
    ReturnFundsRequest,
    ReturnFundsResponse,
    SosActionRequest,
)
from app.services import metrics
from app.services.bank import bank
from app.services.demo import engine

router = APIRouter(prefix="/api/sos", tags=["sos"])

MAX_EVIDENCE_IMAGES = 10
# Вместе ≤ 7 МБ: в base64 это ~9,3 МБ — проходит лимит запроса nginx на стенде (10 МБ, frontend/nginx.conf)
MAX_EVIDENCE_BYTES = 7 * 1024 * 1024


@router.get("/branches")
def branches():
    return content.sos_branches()


@router.get("/legal")
def legal():
    return list(content.legal().values())


@router.post("/return-funds", response_model=ReturnFundsResponse)
def return_funds(req: ReturnFundsRequest):
    tx = bank.freeze(req.persona_id, req.operation_id)
    engine.publish_for_persona(req.persona_id)
    if tx:
        metrics.log(bank.get(req.persona_id), "safe_exit_action", action="return_funds")
    if not tx:
        return ReturnFundsResponse(claim_id="", frozen_amount=0, status="not_found")
    return ReturnFundsResponse(claim_id=f"CLM-{uuid.uuid4().hex[:6].upper()}", frozen_amount=tx.amount, status="frozen")


@router.post("/evidence")
def evidence(req: EvidenceRequest):
    """Прикрепить скриншоты переписки к обращению.

    В демо картинки только проверяем и считаем, но не храним (PLAN.md, раздел 15). В реальной версии они
    шифруются и уходят в банк вместе с обращением, только по согласию клиента.
    """
    if not 1 <= len(req.images_base64) <= MAX_EVIDENCE_IMAGES:
        raise HTTPException(422, f"Прикрепите от 1 до {MAX_EVIDENCE_IMAGES} скриншотов")
    total = 0
    for image in req.images_base64:
        try:
            total += len(base64.b64decode(image.split(",", 1)[-1], validate=True))
        except (binascii.Error, ValueError):
            raise HTTPException(422, "Файл не похож на картинку") from None
    if total > MAX_EVIDENCE_BYTES:
        raise HTTPException(422, "Скриншоты вместе больше 7 МБ — прикрепите меньше")
    account = bank.get(req.persona_id)
    evidence_id = f"EV-{uuid.uuid4().hex[:6].upper()}"
    account.evidence[evidence_id] = len(req.images_base64)
    return {"evidence_id": evidence_id, "count": len(req.images_base64)}


def _attachments(persona_id: str) -> str:
    """Строка о вложениях для черновиков: какие пакеты скриншотов уже прикреплены."""
    packs = bank.get(persona_id).evidence
    if not packs:
        return ""
    return f"\n\nПриложение: скриншоты переписки — {sum(packs.values())} шт. ({', '.join(packs)})."


@router.post("/pause-outgoing")
def pause_outgoing(req: PersonaRequest):
    account = bank.get(req.persona_id)
    account.outgoing_paused_until = datetime.now() + timedelta(hours=24)
    metrics.log(account, "safe_exit_action", action="pause_outgoing")
    return {"paused_until": account.outgoing_paused_until}


# Действия «Безопасного выхода», которые в демо только фиксируются (реальной интеграции нет)
ACTION_RESULTS = {
    "block_contact": "Контакт заблокирован, переписка сохранена",
    "evidence": "Переписка сохранена и прикреплена к обращению",
    "notify_parent": "Готов текст сообщения для взрослого — отправка по вашему решению",
    "report_bank": "Обращение в банк отправлено вместе с хронологией операций",
    "report_police": "Черновик заявления в полицию готов, список доказательств приложен",
    "block_card": "Карта заблокирована, перевыпуск заказан",
    "logout_all": "Вы вышли со всех устройств, пароль нужно сменить при следующем входе",
}


def _rub(x: float) -> str:
    return f"{x:,.0f} ₽".replace(",", " ")


def draft(persona_id: str, kind: str, branch: str | None) -> str | None:
    """Черновик обращения в банк или заявления в полицию по шаблону ветки (content/sos/report_templates.json)."""
    templates = content.report_templates().get(kind, {})
    template = templates.get(branch or "A") or next(iter(templates.values()), None)
    if not template:
        return None
    account = bank.get(persona_id)
    txs = account.transactions
    inc = next((t for t in reversed(txs) if t.direction == "in" and (t.flagged or t.is_new_counterparty)), None)
    out = next((t for t in reversed(txs) if t.direction == "out" and t.is_new_counterparty), None)
    timeline = "\n".join(
        f"{t.ts:%d.%m %H:%M}  {'+' if t.direction == 'in' else '−'}{_rub(t.amount)}  {t.counterparty}"
        for t in txs[-6:]
    )
    return template.format(
        name=account.persona.name,
        age=account.persona.age,
        date=f"{datetime.now():%d.%m.%Y}",
        incoming=f"{_rub(inc.amount)} от «{inc.counterparty}» {inc.ts:%d.%m в %H:%M}" if inc else "—",
        outgoing=f"{_rub(out.amount)} на «{out.counterparty}» {out.ts:%d.%m в %H:%M}" if out else "—",
        timeline=timeline or "—",
    ) + _attachments(persona_id)


@router.post("/action")
def action(req: SosActionRequest):
    metrics.log(bank.get(req.persona_id), "safe_exit_action", action=req.action)
    engine.publish_for_persona(req.persona_id)
    result = {"action": req.action, "result": ACTION_RESULTS.get(req.action, "Готово")}
    if req.action in ("report_bank", "report_police"):
        result["draft"] = draft(req.persona_id, req.action, req.branch)
    return result


@router.post("/report", response_model=ReportResponse)
def report(req: ReportRequest):
    """Черновик обращения в банк по ветке (как в /action с report_bank) — для прямого вызова."""
    account = bank.get(req.persona_id)
    lines = []
    for t in account.transactions[-10:]:
        sign = "+" if t.direction == "in" else "-"
        lines.append(f"{t.ts:%d.%m %H:%M} {sign}{t.amount:.0f} ₽ — {t.counterparty}")
    draft = (
        f"Я, {account.persona.name}, сообщаю, что меня пытались использовать для перевода чужих денег.\n"
        "Хронология операций:\n" + "\n".join(lines) + "\nПереписку прилагаю."
    ) + _attachments(req.persona_id)
    return ReportResponse(draft_text=draft, attachments=list(account.evidence))
