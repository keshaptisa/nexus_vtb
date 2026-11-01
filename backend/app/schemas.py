"""Pydantic-схемы. Это код-версия контрактов из docs/api.md — меняем вместе."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["high", "medium", "low"]


# ---------- Банк ----------
class Transaction(BaseModel):
    id: str
    ts: datetime
    amount: float
    direction: Literal["in", "out"]
    counterparty: str
    is_new_counterparty: bool
    channel: Literal["sbp", "card", "cash", "salary"] = "sbp"
    category: str | None = None
    frozen: bool = False
    flagged: bool = False  # зачисление показалось алгоритму подозрительным (этап 1)


class Persona(BaseModel):
    id: str
    name: str
    age: int
    # kids — «Детский банк» (6–13), start — раздел «Старт» (14–22), pushkin — есть только «Пушкинская карта» ВТБ
    segment: Literal["kids", "start", "pushkin"] = "start"
    pushkin_balance: float | None = None  # остаток по «Пушкинской карте», если она есть
    balance: float
    description: str = ""


class TransferRequest(BaseModel):
    persona_id: str
    to: str
    amount: float = Field(gt=0)
    confirmed: bool = False  # «Это мои деньги» после перехвата — второе подтверждение


class TopUpRequest(BaseModel):
    persona_id: str
    sender: str  # «Мама», «Папа» или «Неизвестный»
    amount: float = Field(gt=0)


class PaymentRequest(BaseModel):
    persona_id: str
    merchant: str
    category: str
    amount: float = Field(gt=0)


class Profile(BaseModel):
    """Обычное поведение клиента — с ним алгоритм сравнивает каждую операцию."""
    avg_topup: float
    avg_spend: float
    known_senders: list[str]
    known_recipients: list[str]
    min_transit_minutes: int | None  # самый быстрый «пришло от незнакомца → ушло дальше»


class Risk(BaseModel):
    score: float
    level: RiskLevel
    reasons: list[str]


class Intercept(BaseModel):
    title: str
    text: str
    consequences: list[str]
    actions: list[Literal["cancel", "offered_job", "call_bank", "check_message", "continue"]]


class TransferResponse(BaseModel):
    status: Literal["ok", "intercepted"]
    risk: Risk
    intercept: Intercept | None = None
    balance: float


class OperationResponse(BaseModel):
    status: Literal["ok", "flagged", "rejected"]
    transaction: Transaction | None = None
    risk: Risk
    message: str = ""
    balance: float


class LiveRisk(BaseModel):
    persona_id: str
    score: float
    level: RiskLevel
    signals: list[str]
    profile: Profile | None = None


class AssistantRequest(BaseModel):
    persona_id: str
    message: str
    history: list[dict] = []


class AssistantResponse(BaseModel):
    reply: str
    suggestions: list[str] = []
    action: str | None = None  # подсказка фронту: open_sos, open_shield, open_topup …
    source: Literal["rules", "llm"] = "rules"


# ---------- Демо ----------
class ChatMessage(BaseModel):
    sender: Literal["recruiter", "user", "system"]
    text: str


class BankEvent(BaseModel):
    type: Literal["incoming", "outgoing", "push"]
    amount: float | None = None
    counterparty: str | None = None
    is_new_counterparty: bool = True
    channel: Literal["sbp", "card", "cash", "salary"] = "sbp"
    category: str | None = None
    text: str | None = None


class DemoStep(BaseModel):
    id: str
    title: str
    hint: str = ""
    chat: list[ChatMessage] = []
    bank_events: list[BankEvent] = []
    expect: dict | None = None  # что жюри должно сделать на шаге, напр. {"action": "transfer", ...}
    popup: dict | None = None  # какое окно банка показать на шаге: incoming, request_transfer, threat, lesson, done …


class DemoState(BaseModel):
    scenario_id: str
    persona: Persona
    step_index: int
    steps_count: int
    step: DemoStep
    chat_history: list[ChatMessage]
    risk: LiveRisk


class ScenarioInfo(BaseModel):
    id: str
    persona: str
    title: str
    steps_count: int


# ---------- Безопасный выход ----------
class ReturnFundsRequest(BaseModel):
    persona_id: str
    operation_id: str


class ReturnFundsResponse(BaseModel):
    claim_id: str
    frozen_amount: float
    status: Literal["frozen", "not_found"]


class EvidenceRequest(BaseModel):
    persona_id: str
    images_base64: list[str]


class ReportRequest(BaseModel):
    persona_id: str
    branch: Literal["A", "B", "C", "D"]


class ReportResponse(BaseModel):
    draft_text: str
    attachments: list[str]


class SosActionRequest(BaseModel):
    persona_id: str
    action: str
    branch: Literal["A", "B", "C", "D"] | None = None  # для черновиков обращений


class PersonaRequest(BaseModel):
    persona_id: str


# ---------- Щит ----------
class ShieldRequest(BaseModel):
    text: str | None = None
    image_base64: str | None = None
    persona_id: str | None = None  # чей кабинет — только для метрик демо (событие shield_checked)


class ShieldResponse(BaseModel):
    risk: RiskLevel
    score: float
    scheme: Literal["drop_recruitment", "phishing", "relative_in_trouble", "prize", "other_fraud", "safe"]
    red_flags: list[str]
    explanation: str
    consequences: list[str]
    advice: list[str]
    source: Literal["classifier+llm", "classifier+template"]
    recognized_text: str | None = None  # что распознали на скриншоте


# ---------- Уроки / прогресс ----------
class EventRequest(BaseModel):
    persona_id: str
    type: str
    payload: dict = {}


class ProgressRequest(BaseModel):
    persona_id: str
    lesson_id: str | None = None
    quest_id: str | None = None
    action: str | None = None  # правильное действие вне уроков, напр. "safe_exit"
    result: str = "done"


class ProgressResponse(BaseModel):
    xp: int
    level: int
    done: list[str] = []
    gained: int = 0


# ---------- Цели и копилка ----------
class Goal(BaseModel):
    id: str
    title: str
    target: float = Field(gt=0)
    saved: float = 0


class GoalCreate(BaseModel):
    persona_id: str
    title: str = Field(min_length=1, max_length=40)
    target: float = Field(gt=0)


class GoalDeposit(BaseModel):
    persona_id: str
    amount: float = Field(gt=0)


class GoalResponse(BaseModel):
    goal: Goal
    balance: float
    message: str


# ---------- Мост «Детский банк» → «Старт» и «Пушкинская карта» ----------
class BridgeRequest(BaseModel):
    persona_id: str
    parent_consent: bool


class BridgeResponse(BaseModel):
    persona: Persona
    carried_goals: list[Goal]
    carried_xp: int
    carried_stories: int
    message: str


class PushkinActivateResponse(BaseModel):
    persona: Persona
    offers: list[str]
    message: str
