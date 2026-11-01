"""CatBoost-модель скоринга перевода. Обучается в ml/src/train_risk.py.

Если файла модели нет или catboost не установлен — available() == False,
и app/services/risk.py работает на правилах.
"""
import json
from functools import lru_cache
from pathlib import Path

from app.ml.features import FEATURES, phrase

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODELS_DIR / "risk.cbm"
META_PATH = MODELS_DIR / "risk_meta.json"

# Шкала в API: перехват при score ≥ 0.7, «medium» при ≥ 0.4 (docs/api.md).
# Пороги модели подбираются на валидации и линейно переводятся в эту шкалу.
API_HIGH, API_MEDIUM = 0.7, 0.4


@lru_cache
def _load():
    if not MODEL_PATH.exists() or not META_PATH.exists():
        return None
    try:
        from catboost import CatBoostClassifier
    except ImportError:
        return None
    model = CatBoostClassifier()
    model.load_model(str(MODEL_PATH))
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    return model, meta


def available() -> bool:
    return _load() is not None


def to_api_scale(p: float, thr_medium: float, thr_high: float) -> float:
    """Кусочно-линейно: [0, thr_medium] → [0, 0.4], [thr_medium, thr_high] → [0.4, 0.7], [thr_high, 1] → [0.7, 1]."""
    if p < thr_medium:
        return API_MEDIUM * p / thr_medium
    if p < thr_high:
        return API_MEDIUM + (API_HIGH - API_MEDIUM) * (p - thr_medium) / (thr_high - thr_medium)
    return API_HIGH + (1 - API_HIGH) * (p - thr_high) / (1 - thr_high)


def predict(features: dict, top: int = 3, self_employed: bool = False) -> tuple[float, list[str]]:
    """→ (score в шкале API, причины для экрана перехвата из SHAP).

    У подтверждённых самозанятых порог перехвата выше (thr_high_self_employed): оплата поставщику
    после выручки похожа на транзит. Между обычным порогом и порогом самозанятых — «medium»,
    то есть предупреждение вместо остановки перевода.
    """
    from catboost import Pool

    model, meta = _load()
    row = [[features[name] for name in FEATURES]]
    proba = float(model.predict_proba(row)[0][1])
    thr_high = meta.get("thr_high_self_employed", meta["thr_high"]) if self_employed else meta["thr_high"]
    score = to_api_scale(proba, meta["thr_medium"], thr_high)

    shap = model.get_feature_importance(Pool(row, feature_names=FEATURES), type="ShapValues")[0][:-1]
    picked = []
    for i in sorted(range(len(FEATURES)), key=lambda i: -shap[i]):
        if shap[i] <= 0 or len(picked) >= top:
            break
        if phrase(FEATURES[i], features[FEATURES[i]]):
            picked.append(FEATURES[i])
    return round(score, 2), _reasons(picked, features)


def _reasons(picked: list[str], features: dict) -> list[str]:
    """Фразы для экрана перехвата. «Сколько пришло» и «когда пришло» — одна мысль, поэтому
    склеиваем их в одну причину (замечание респондента из опроса: пункты дублировали друг друга)."""
    sum_key, time_key = "stranger_incoming_24h", "minutes_since_stranger_incoming"
    if sum_key in picked and time_key in picked:
        amount = phrase(sum_key, features[sum_key]).split(" пришли")[0]
        minutes = max(features[time_key], 1)
        merged = f"{amount} пришли от незнакомых отправителей, последний перевод — {minutes:.0f} мин назад"
        picked = [k for k in picked if k != time_key]
        return [merged if k == sum_key else phrase(k, features[k]) for k in picked]
    return [phrase(k, features[k]) for k in picked]
