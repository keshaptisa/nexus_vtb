from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.ml import risk_model
from app.ml.features import Transfer, build_features, rule_score
from app.schemas import Transaction

client = TestClient(app)
NOW = datetime(2026, 10, 7, 15, 0)


def _tx(minutes_ago, amount, direction, counterparty, new=False):
    return Transaction(id=str(minutes_ago), ts=NOW - timedelta(minutes=minutes_ago), amount=amount,
                       direction=direction, counterparty=counterparty, is_new_counterparty=new)


def test_features_for_drop_transfer():
    history = [_tx(3 * 1440, 1500, "in", "Мама"), _tx(2 * 1440, 300, "out", "Кофейня"), _tx(2, 30000, "in", "Иван К.", new=True)]
    f = build_features(history, Transfer(ts=NOW, amount=27000, to="+79990001234"), client_age=16, card_age_days=400)
    assert f["minutes_since_stranger_incoming"] == 2
    assert f["forward_share"] == 0.9
    assert f["stranger_incoming_24h"] == 30000
    assert f["is_new_recipient"] == 1
    assert rule_score(f)[0] >= 0.7


def test_features_for_normal_transfer():
    history = [_tx(3 * 1440, 1500, "in", "Мама"), _tx(1440, 200, "out", "Саша (друг)")]
    f = build_features(history, Transfer(ts=NOW, amount=200, to="Саша (друг)"), client_age=16, card_age_days=400)
    assert f["forward_share"] == 0 and f["is_new_recipient"] == 0
    assert rule_score(f)[0] < 0.7


def test_new_features_count_recipient_and_regular_income():
    history = [_tx(3 * 1440, 4000, "in", "Клиент 1", new=True), _tx(2 * 1440, 6000, "in", "Клиент 2", new=True),
               _tx(2 * 1440 - 300, 3000, "out", "Поставщик"), _tx(60, 5000, "in", "Клиент 3", new=True)]
    f = build_features(history, Transfer(ts=NOW, amount=2500, to="Поставщик"), client_age=20, card_age_days=700)
    assert f["recipient_transfers_30d"] == 1
    assert f["stranger_income_days_30d"] == 3
    assert f["stranger_median_amount_30d"] == 5000


def test_self_employed_threshold_is_softer():
    if not risk_model.available():
        return
    history = [_tx(2, 30000, "in", "Иван К.", new=True)]
    f = build_features(history, Transfer(ts=NOW, amount=12000, to="+79990001234"), client_age=20, card_age_days=700)
    assert risk_model.predict(f, self_employed=True)[0] <= risk_model.predict(f)[0]


def test_api_scale_keeps_thresholds():
    assert risk_model.to_api_scale(0.3, 0.1, 0.3) == 0.7
    assert risk_model.to_api_scale(0.1, 0.1, 0.3) == 0.4
    assert risk_model.to_api_scale(0.05, 0.1, 0.3) < risk_model.to_api_scale(0.2, 0.1, 0.3) < risk_model.to_api_scale(0.9, 0.1, 0.3)


def test_rules_fallback_still_intercepts(monkeypatch):
    monkeypatch.setattr(risk_model, "available", lambda: False)
    client.post("/api/demo/artem/reset")
    client.post("/api/demo/artem/next")
    r = client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "+79990001234", "amount": 27000})
    assert r.json()["status"] == "intercepted"


def test_intercept_reasons_are_human():
    client.post("/api/demo/artem/reset")
    client.post("/api/demo/artem/next")
    reasons = client.post("/api/payments/transfer", json={"persona_id": "artem", "to": "+79990001234", "amount": 27000}).json()["risk"]["reasons"]
    assert reasons and all("{" not in r for r in reasons)


def test_shield_other_fraud_and_safe():
    phishing = client.post("/api/shield/check", json={"text": "Служба безопасности банка: по вашей карте попытка списания, назовите код из СМС"}).json()
    assert phishing["scheme"] not in ("safe", "drop_recruitment")
    safe = client.post("/api/shield/check", json={"text": "скинь 300 за пиццу пж"}).json()
    assert safe["scheme"] == "safe"


def test_lesson_trigger_conditions():
    def lesson(event, payload):
        return client.post("/api/events", json={"persona_id": "katya", "type": event, "payload": payload}).json()["lesson"]

    assert lesson("subscription", {"active_subscriptions": 2}) is None
    assert lesson("subscription", {"active_subscriptions": 3})["id"] == "subscriptions"
    assert lesson("overspend", {"overspend_ratio": 1.1}) is None
    assert lesson("salary", {"is_first": False}) is None
    assert lesson("salary", {})  # без деталей — урок показываем
