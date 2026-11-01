"""Выгрузка CatBoost-модели скоринга в компактный JSON для телефона.

    python scripts/export_risk_model.py            # из папки mobile/, нужен Python с catboost (ml/.venv)

Читает backend/app/ml/models/risk.cbm, пишет src/content/models/risk_model.json:
признаки, scale/bias и для каждого «забывчивого» дерева — пары [номер признака, порог] и значения листьев.
Вычисление на телефоне — src/engine/risk-model.ts; сверка с Python — scripts/engine-check.ts.
"""
import json
from pathlib import Path

from catboost import CatBoostClassifier

APP = Path(__file__).resolve().parents[1]
MODELS = APP.parent / "backend" / "app" / "ml" / "models"
OUT = APP / "src" / "content" / "models" / "risk_model.json"

model = CatBoostClassifier()
model.load_model(str(MODELS / "risk.cbm"))
full = OUT.with_suffix(".full.json")
model.save_model(str(full), format="json")
data = json.loads(full.read_text(encoding="utf-8"))
full.unlink()

compact = {
    "features": json.loads((MODELS / "risk_meta.json").read_text(encoding="utf-8"))["features"],
    "scale_bias": data["scale_and_bias"],
    "trees": [
        {
            "s": [[sp["float_feature_index"], round(sp["border"], 6)] for sp in tree["splits"]],
            "v": [round(v, 7) for v in tree["leaf_values"]],
        }
        for tree in data["oblivious_trees"]
    ],
}
OUT.write_text(json.dumps(compact, separators=(",", ":")), encoding="utf-8")
print(f"{len(compact['trees'])} деревьев → {OUT} ({OUT.stat().st_size // 1024} КБ)")
