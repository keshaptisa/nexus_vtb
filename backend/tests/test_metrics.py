from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

STRANGER = {"persona_id": "artem", "sender": "Неизвестный", "amount": 30000}
TRANSIT = {"persona_id": "artem", "to": "+79990001234", "amount": 27000}


def summary(persona_id="artem"):
    return client.get("/api/metrics/summary", params={"persona_id": persona_id}).json()


def test_summary_is_empty_after_reset():
    client.post("/api/personas/artem/reset")
    s = summary()
    assert s["events"]["intercept_shown"] == 0
    assert s["intercept_cancel_rate"] is None and s["safe_exit_conversion"] is None
    assert s["median_seconds_to_action"] is None and s["prevented_transits"] == 0


def test_cancel_after_intercept_counts_as_prevented_transit():
    client.post("/api/personas/artem/reset")
    client.post("/api/payments/topup", json=STRANGER)
    assert client.post("/api/payments/transfer", json=TRANSIT).json()["status"] == "intercepted"
    client.post("/api/metrics/events", json={"persona_id": "artem", "name": "intercept_cancelled", "action": "cancel"})
    s = summary()
    assert s["events"]["intercept_shown"] == 1
    assert s["intercept_cancel_rate"] == 1.0
    assert s["prevented_transits"] == 1
    assert s["median_seconds_to_action"] is not None and s["median_seconds_to_action"] >= 0


def test_continue_after_intercept_is_not_prevented():
    client.post("/api/personas/artem/reset")
    client.post("/api/payments/topup", json=STRANGER)
    client.post("/api/payments/transfer", json=TRANSIT)
    assert client.post("/api/payments/transfer", json={**TRANSIT, "confirmed": True}).json()["status"] == "ok"
    s = summary()
    assert s["events"]["intercept_continued"] == 1
    assert s["intercept_cancel_rate"] == 0.0 and s["prevented_transits"] == 0


def test_safe_exit_conversion_and_return_funds():
    client.post("/api/personas/artem/reset")
    tx = client.post("/api/payments/topup", json=STRANGER).json()["transaction"]
    client.post("/api/metrics/events", json={"persona_id": "artem", "name": "safe_exit_opened"})
    client.post("/api/sos/return-funds", json={"persona_id": "artem", "operation_id": tx["id"]})
    client.post("/api/metrics/events", json={"persona_id": "artem", "name": "safe_exit_opened"})  # открыл и закрыл
    s = summary()
    assert s["safe_exit_conversion"] == 0.5
    assert s["prevented_transits"] == 1


def test_lesson_and_shield_events():
    client.post("/api/personas/katya/reset")
    lesson_id = client.get("/api/lessons").json()[0]["id"]
    client.post("/api/progress", json={"persona_id": "katya", "lesson_id": lesson_id})
    client.post("/api/shield/check", json={"persona_id": "katya", "text": "Подработка: прими перевод и перешли дальше, 10% твои"})
    events = summary("katya")["events"]
    assert events["lesson_completed"] == 1 and events["shield_checked"] == 1


def test_unknown_client_event_is_rejected():
    r = client.post("/api/metrics/events", json={"persona_id": "artem", "name": "intercept_shown"})
    assert r.status_code == 422  # такие события пишет только бэкенд
    assert client.get("/api/metrics/summary", params={"persona_id": "nobody"}).status_code == 404
