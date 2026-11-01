from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_artem_transfer_is_intercepted():
    client.post("/api/demo/artem/reset")
    client.post("/api/demo/artem/next")  # деньги пришли
    r = client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "+79990001234", "amount": 27000})
    body = r.json()
    assert body["status"] == "intercepted"
    assert body["risk"]["level"] == "high"
    assert body["intercept"]["consequences"]


def test_normal_transfer_passes():
    client.post("/api/demo/katya/reset")
    r = client.post("/api/payments/transfer", json={"persona_id": "katya", "to": "Онлайн-кинотеатр", "amount": 299})
    assert r.json()["status"] == "ok"


def test_return_funds_freezes_incoming():
    client.post("/api/demo/artem/reset")
    client.post("/api/demo/artem/next")
    txs = client.get("/api/personas/artem/transactions").json()
    incoming = next(t for t in txs if t["direction"] == "in" and t["is_new_counterparty"])
    r = client.post("/api/sos/return-funds", json={"persona_id": "artem", "operation_id": incoming["id"]})
    assert r.json()["status"] == "frozen"
    assert r.json()["frozen_amount"] == 30000


def test_shield_detects_drop_recruitment():
    text = "Подработка без опыта! Прими перевод и переведи дальше, 10% оставь себе"
    body = client.post("/api/shield/check", json={"text": text}).json()
    assert body["scheme"] == "drop_recruitment"
    assert body["risk"] == "high"


def test_all_scenarios_walk_through():
    for s in client.get("/api/demo/scenarios").json():
        state = client.post(f"/api/demo/{s['id']}/reset").json()
        for _ in range(s["steps_count"]):
            state = client.post(f"/api/demo/{s['id']}/next").json()
        assert state["step_index"] == s["steps_count"] - 1


def test_every_trigger_has_lesson():
    for event in ["p2p_stranger", "salary", "subscription", "overspend", "bank_call"]:
        lesson = client.post("/api/events", json={"persona_id": "katya", "type": event}).json()["lesson"]
        assert lesson and lesson["cards"]


def test_topup_from_parent_is_ok_and_stranger_is_flagged():
    client.post("/api/personas/artem/reset")
    mom = client.post("/api/payments/topup", json={"persona_id": "artem", "sender": "Мама", "amount": 1500}).json()
    assert mom["status"] == "ok"
    stranger = client.post("/api/payments/topup", json={"persona_id": "artem", "sender": "Неизвестный", "amount": 30000}).json()
    assert stranger["status"] == "flagged"
    assert stranger["transaction"]["flagged"]
    assert any("раз больше" in r for r in stranger["risk"]["reasons"])


def test_forwarding_flagged_money_is_intercepted_and_shown_live():
    client.post("/api/personas/artem/reset")
    client.post("/api/payments/topup", json={"persona_id": "artem", "sender": "Неизвестный", "amount": 30000})
    r = client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "+79990001234", "amount": 27000}).json()
    assert r["status"] == "intercepted"
    live = client.get("/api/risk/artem/live").json()
    assert live["level"] == "high"
    assert {"Мама", "Папа"} <= set(live["profile"]["known_senders"])


def test_confirmed_transfer_passes_and_known_recipient_is_low():
    client.post("/api/personas/artem/reset")
    r = client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "Саша (друг)", "amount": 300}).json()
    assert r["status"] == "ok" and r["risk"]["level"] == "low"


def test_pay_and_assistant():
    client.post("/api/personas/katya/reset")
    r = client.post("/api/payments/pay", json={"persona_id": "katya", "merchant": "Магазин одежды", "category": "clothes", "amount": 1990}).json()
    assert r["status"] == "ok"
    a = client.post("/api/assistant/chat", json={"persona_id": "katya", "message": "что такое дроп?"}).json()
    assert "Дроп" in a["reply"] and a["suggestions"]


def test_lessons_as_stories_and_xp_once():
    stories = client.get("/api/lessons").json()
    assert stories[0]["id"] == "dont_share_card" and all(s["cards"] and s["short"] for s in stories)
    client.post("/api/personas/katya/reset")
    first = client.post("/api/progress", json={"persona_id": "katya", "lesson_id": "ndfl"}).json()
    again = client.post("/api/progress", json={"persona_id": "katya", "lesson_id": "ndfl"}).json()
    assert first["gained"] == 20 and again["gained"] == 0 and again["xp"] == 20
    assert "lesson:ndfl" in client.get("/api/progress/katya").json()["done"]


SHIELD_CASES = [
    # (сообщение, ожидаемая схема) — «живая» речь, на которой одна модель ошибалась
    ("алаллалалала я тебе дам денег на лапу ты нах переведи кому надо дааааааа", "drop_recruitment"),
    ("прими перевод 15к, 3к твои, остальное скинешь по номеру", "drop_recruitment"),
    ("нужна твоя карта на пару дней, заплачу 5к", "drop_recruitment"),
    ("привет, это мой новый номер, мам скинь денег срочно", "relative_in_trouble"),
    ("Здравствуйте, служба безопасности банка, назовите код из смс", "phishing"),
    ("переведи мне 300 за пиццу плиз", "safe"),
    ("срочно скинь фотки с вечеринки", "safe"),
    ("у меня скидка 20% в кофейне, пошли", "safe"),
]


def test_shield_verdicts_on_live_speech():
    for text, scheme in SHIELD_CASES:
        body = client.post("/api/shield/check", json={"text": text}).json()
        assert body["scheme"] == scheme, text
        if scheme == "safe":
            assert body["risk"] == "low" and body["red_flags"] == [], text
        else:
            assert body["risk"] == "high" and body["red_flags"], text


def test_shield_source_has_no_control_chars_and_squeezes_repeats():
    # Регресс: при записи файла \1 и \b превращались в невидимые символы, и нормализация молча не работала
    from pathlib import Path

    from app.services.shield import _norm
    src = (Path(__file__).resolve().parents[1] / "app" / "services" / "shield.py").read_text(encoding="utf-8")
    assert not [c for c in src if ord(c) < 32 and c not in "\n\t"]
    assert _norm("прииииими дааааа") == "приими даа"


def test_keyword_baseline_for_eval_is_available():
    # ml/src/eval.py сравнивает модель с этим бейзлайном в metrics.md
    from app.services.shield import DROP_PATTERNS, _classify_keywords
    assert DROP_PATTERNS and _classify_keywords("прими перевод и переведи дальше", ["a", "b"])[0] == "drop_recruitment"


def test_intercept_screen_is_short_and_offers_call():
    # Итоги опроса: экран перегружен текстом, возраст ответственности знают 45% — он первым
    client.post("/api/personas/artem/reset")
    client.post("/api/payments/topup", json={"persona_id": "artem", "sender": "Неизвестный", "amount": 30000})
    r = client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "+79990001234", "amount": 27000}).json()
    assert r["status"] == "intercepted"
    assert len(r["risk"]["reasons"]) <= 2
    assert len(r["intercept"]["consequences"]) == 2
    assert "16 лет" in r["intercept"]["consequences"][0]
    assert "call_bank" in r["intercept"]["actions"]


def test_sos_report_drafts_by_branch():
    client.post("/api/personas/dima/reset")
    client.post("/api/payments/topup", json={"persona_id": "dima", "sender": "Неизвестный", "amount": 20000})
    bank_b = client.post("/api/sos/action", json={"persona_id": "dima", "action": "report_bank", "branch": "B"}).json()
    assert "меня использовали" in bank_b["draft"] and "Дима" in bank_b["draft"] and "20 000 ₽" in bank_b["draft"]
    police = client.post("/api/sos/action", json={"persona_id": "dima", "action": "report_police", "branch": "B"}).json()
    assert police["draft"].startswith("Начальнику отдела полиции")
    other = client.post("/api/sos/action", json={"persona_id": "dima", "action": "block_contact"}).json()
    assert "draft" not in other


def test_llm_without_provider_returns_none():
    from app.services import llm
    assert llm.complete_json("system", "user") is None


PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="


def test_evidence_is_per_persona_and_goes_into_drafts():
    client.post("/api/personas/artem/reset")
    client.post("/api/personas/dima/reset")
    r = client.post("/api/sos/evidence", json={"persona_id": "artem", "images_base64": [PNG_1PX, PNG_1PX]}).json()
    assert r["count"] == 2 and r["evidence_id"].startswith("EV-")
    draft = client.post("/api/sos/action", json={"persona_id": "artem", "action": "report_bank", "branch": "A"}).json()["draft"]
    assert "скриншоты переписки — 2 шт." in draft and r["evidence_id"] in draft
    # чужие доказательства в обращение другого клиента не попадают
    other = client.post("/api/sos/report", json={"persona_id": "dima", "branch": "B"}).json()
    assert other["attachments"] == [] and "скриншоты" not in other["draft_text"]
    # сброс аккаунта очищает доказательства
    client.post("/api/personas/artem/reset")
    assert client.post("/api/sos/report", json={"persona_id": "artem", "branch": "A"}).json()["attachments"] == []


def test_evidence_rejects_garbage():
    assert client.post("/api/sos/evidence", json={"persona_id": "artem", "images_base64": []}).status_code == 422
    assert client.post("/api/sos/evidence", json={"persona_id": "artem", "images_base64": ["не картинка!"]}).status_code == 422


def test_account_snapshot_roundtrip():
    """Снимок для PostgreSQL сохраняет всё состояние аккаунта: операции, цели, XP, доказательства, перехват."""
    from app.services import store
    from app.services.bank import bank

    client.post("/api/demo/artem/reset")
    client.post("/api/demo/artem/next")
    client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "+79990001234", "amount": 27000})
    client.post("/api/sos/evidence", json={"persona_id": "artem", "images_base64": [PNG_1PX]})
    client.post("/api/progress", json={"persona_id": "artem", "lesson_id": "spot_fraud"})
    account = bank.get("artem")

    restored = store.from_state(store.to_state(account))
    assert restored.persona == account.persona
    assert restored.transactions == account.transactions
    assert restored.xp == account.xp and restored.done == account.done
    assert restored.evidence == account.evidence and restored.goals == account.goals
    assert restored.last_intercept == account.last_intercept is not None


def test_pushkin_buyout_offer_opens_lesson():
    """Предложение «выкупить» Пушкинскую карту в сценарии Льва открывает историю о схеме."""
    lesson = client.post("/api/events", json={"persona_id": "lev", "type": "pushkin_offer", "payload": {}}).json()["lesson"]
    assert lesson["id"] == "pushkin_scam" and lesson["quiz"]["answer"] == 1
    assert client.post("/api/demo/lev/reset").json()["steps_count"] == 4


def test_shield_catches_short_slang_recruitment():
    r = client.post("/api/shield/check", json={"text": "Подработка, придёт 30к, перешли 27 на карту, 3к твои"})
    assert r.json()["scheme"] == "drop_recruitment" and r.json()["risk"] == "high"


def test_intercept_for_under_16_starts_with_what_threatens_now():
    # Младше 16 строка «С 16 лет — уголовная ответственность» читается как «мне можно»
    client.post("/api/personas/lev/reset")
    client.post("/api/payments/topup", json={"persona_id": "lev", "sender": "Неизвестный", "amount": 30000})
    r = client.post("/api/payments/transfer", json={"persona_id": "lev", "to": "+79990001234", "amount": 27000}).json()
    assert r["status"] == "intercepted"
    assert r["intercept"]["consequences"][0].startswith("До 16 лет")
