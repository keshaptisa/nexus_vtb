"""Ложные перехваты по людям, а не по переводам → reports/false_intercepts_clients.md.

    python src/eval_clients.py

Доля ложных перехватов среди переводов (metrics.md) может быть маленькой, но если перехваты
приходятся на одних и тех же людей, честный клиент всё равно видит «блокировку». Поэтому считаем,
у какой доли честных клиентов за 60 дней был хотя бы один перехват. Тестовые клиенты — те же,
что в eval.py; metrics.md этот скрипт не трогает.

Столбец «Итог» — как в бэкенде: модель, плюс переводы на свой счёт в этом же банке не проверяем,
плюс у самозанятых свой порог (thr_high_self_employed). Разбор — eval_self_employed.py.
"""
import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd
from catboost import CatBoostClassifier

from features import FEATURES, rule_score

ROOT = Path(__file__).resolve().parents[1]
DATA, REPORTS = ROOT / "data", ROOT / "reports"
MODELS = ROOT.parent / "backend" / "app" / "ml" / "models"
LEGIT = ["normal_teen", "student_parttime", "self_employed"]
CLIENT_LIMIT, SEGMENT_LIMIT = 0.03, 0.05  # цели из business_model.md, раздел 6


def main():
    ds = pd.read_parquet(DATA / "risk_dataset.parquet")
    split = json.loads((DATA / "risk_split.json").read_text(encoding="utf-8"))
    test = ds[ds.client_id.isin(split["test"]) & ds.profile.isin(LEGIT)].copy()
    meta = json.loads((MODELS / "risk_meta.json").read_text(encoding="utf-8"))
    model = CatBoostClassifier()
    model.load_model(str(MODELS / "risk.cbm"))

    tx = pd.read_parquet(DATA / "transactions.parquet", columns=["tx_id", "counterparty"]).set_index("tx_id")
    own = tx.loc[test.tx_id, "counterparty"].str.startswith("Свой ").to_numpy()
    p = model.predict_proba(test[meta["features"]])[:, 1]
    thr_se = meta.get("thr_high_self_employed", meta["thr_high"])
    test["hit_model"] = p >= meta["thr_high"]
    test["hit_final"] = (p >= [thr_se if pr == "self_employed" else meta["thr_high"] for pr in test.profile]) & ~own
    test["hit_rules"] = [rule_score(r)[0] >= 0.7 for r in test[FEATURES].to_dict("records")]
    clients = test.groupby(["client_id", "profile"])[["hit_rules", "hit_model", "hit_final"]].any().reset_index()

    def row(name, g):
        n, k = len(g), int(g.hit_final.sum())
        ok = "да" if k / n <= (CLIENT_LIMIT if name == "**Все честные клиенты**" else SEGMENT_LIMIT) else "**нет**"
        return f"| {name} | {n} | {g.hit_rules.mean():.1%} | {g.hit_model.mean():.1%} | {g.hit_final.mean():.1%} ({k} из {n}) | {ok} |"

    lines = [
        "# Ложные перехваты по людям", "",
        f"_Сгенерировано `ml/src/eval_clients.py` {date.today():%d.%m.%Y}. Данные синтетические, тестовые клиенты — как в `metrics.md`._", "",
        f"Доля честных клиентов, у которых за 60 дней был хотя бы один перехват. Правила — от 0.7; CatBoost — порог {meta['thr_high']:.2f};",
        f"итог — CatBoost, переводы на свой счёт в этом же банке не проверяем, у самозанятых порог {thr_se:.2f}.",
        f"Цель: не больше {CLIENT_LIMIT:.0%} в целом и не больше {SEGMENT_LIMIT:.0%} в любом сегменте.", "",
        "| Сегмент | Клиентов | Правила | CatBoost | Итог | В пределах цели |",
        "|---|---|---|---|---|---|",
        row("**Все честные клиенты**", clients),
    ]
    for prof in LEGIT:
        lines.append(row(prof, clients[clients.profile == prof]))
    lines += [
        "",
        "Вывод: самозанятых модель путает с дропами чаще остальных. В генераторе у них ~70% оплат приходят от незнакомых",
        "людей, а вечером того же дня 30–90% выручки уходит поставщику — для модели это похоже на транзит. Признаки",
        "регулярности выручки и свой порог для подтверждённых самозанятых снизили долю, но до цели 5% пока не дотягиваем.",
        "Разбор и «было/стало» — `ml/reports/self_employed.md`.", "",
    ]
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "false_intercepts_clients.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
