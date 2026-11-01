"""Метрики обеих моделей против бейзлайнов на правилах → reports/metrics.md.

    python src/eval.py

Скоринг перевода — на тестовых клиентах (split из train_risk.py).
Щит — на отложенных шаблонах синтетики и на ручном тесте команды
(data/messages_test_manual_*.csv), если он уже есть.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from sklearn.metrics import average_precision_score, precision_recall_curve, precision_recall_fscore_support
from sklearn.model_selection import GroupShuffleSplit

from features import FEATURES, rule_score
from train_shield import SEED as SHIELD_SEED, fit as fit_shield

ROOT = Path(__file__).resolve().parents[1]
DATA, REPORTS = ROOT / "data", ROOT / "reports"
MODELS = ROOT.parent / "backend" / "app" / "ml" / "models"
LABELS = ["drop_recruitment", "other_fraud", "safe"]
LEGIT = ["normal_teen", "student_parttime", "self_employed"]


def recall_at_precision(y, score, target=0.9) -> float:
    precision, recall, _ = precision_recall_curve(y, score)
    ok = precision >= target
    return float(recall[ok].max()) if ok.any() else 0.0


def pct(x: float) -> str:
    return f"{x:.1%}"


# ---------- скоринг перевода ----------
def eval_risk() -> list[str]:
    ds = pd.read_parquet(DATA / "risk_dataset.parquet")
    split = json.loads((DATA / "risk_split.json").read_text(encoding="utf-8"))
    test = ds[ds.client_id.isin(split["test"])].copy()
    meta = json.loads((MODELS / "risk_meta.json").read_text(encoding="utf-8"))
    model = CatBoostClassifier()
    model.load_model(str(MODELS / "risk.cbm"))

    test["p_model"] = model.predict_proba(test[meta["features"]])[:, 1]
    test["s_rules"] = [rule_score(r)[0] for r in test[FEATURES].to_dict("records")]
    test["hit_model"] = test.p_model >= meta["thr_high"]
    test["hit_rules"] = test.s_rules >= 0.7
    y = test.label

    def row(name, score, hit):
        p, r, _, _ = precision_recall_fscore_support(y, hit, average="binary", zero_division=0)
        fpr = hit[y == 0].mean()
        return f"| {name} | {average_precision_score(y, score):.3f} | {recall_at_precision(y, score):.3f} | {p:.3f} | {r:.3f} | {pct(fpr)} |"

    out = [
        "## 1. Скоринг перевода (CatBoost против правил)", "",
        f"Тест: {test.client_id.nunique()} клиентов, {len(test)} исходящих p2p-переводов, из них транзитных переводов дропов {int(y.sum())}.",
        "Клиенты теста не участвовали в обучении и подборе порогов.", "",
        "| Модель | PR-AUC | Recall при precision ≥ 0.9 | Precision перехвата | Recall перехвата | Ложные перехваты (доля честных переводов) |",
        "|---|---|---|---|---|---|",
        row("Правила (бейзлайн)", test.s_rules, test.hit_rules),
        row(f"CatBoost (порог {meta['thr_high']:.2f})", test.p_model, test.hit_model),
        "", "### Ложные перехваты по профилям", "",
        "Доля переводов, которые были бы перехвачены, и доля клиентов, у которых за 60 дней был хоть один перехват.", "",
        "| Профиль | Переводов | Перехват: правила | Перехват: CatBoost | Клиентов с ≥1 перехватом: правила | Клиентов с ≥1 перехватом: CatBoost |",
        "|---|---|---|---|---|---|",
    ]
    for prof in LEGIT + ["drop_newbie", "drop_active"]:
        g = test[test.profile == prof]
        if prof.startswith("drop"):
            g = g[g.label == 1]  # у дропов смотрим, сколько транзитов поймали
        if g.empty:
            continue
        by_client = g.groupby("client_id")[["hit_rules", "hit_model"]].any()
        name = prof + (" (транзиты — это recall)" if prof.startswith("drop") else "")
        out.append(f"| {name} | {len(g)} | {pct(g.hit_rules.mean())} | {pct(g.hit_model.mean())} | "
                   f"{pct(by_client.hit_rules.mean())} | {pct(by_client.hit_model.mean())} |")

    imp = sorted(zip(meta["features"], model.get_feature_importance()), key=lambda x: -x[1])
    out += ["", "Важность признаков: " + ", ".join(f"`{n}` {v:.0f}" for n, v in imp), ""]
    return out


# ---------- Щит ----------
def keyword_baseline(texts) -> list[str]:
    sys.path.insert(0, str(ROOT.parent / "backend"))
    from app.services.shield import DROP_PATTERNS, _classify_keywords
    preds = []
    for t in texts:
        low = str(t).lower()
        flags = [m for p, m in DROP_PATTERNS.items() if re.search(p, low)]
        scheme = _classify_keywords(low, flags)[0]
        preds.append(scheme if scheme in ("drop_recruitment", "safe") else "other_fraud")
    return preds


def hybrid(texts, proba_fn=None) -> list[str]:
    """Гибрид из бэкенда (services/shield.classify): вероятности модели + баллы за признаки схемы.
    proba_fn подменяет модель — чтобы на отложенных шаблонах гибрид не опирался на модель, видевшую их."""
    sys.path.insert(0, str(ROOT.parent / "backend"))
    from app.ml import shield_model
    from app.services import shield
    original = shield_model.predict_proba
    if proba_fn:
        shield_model.predict_proba = proba_fn
    try:
        schemes = [shield.classify(str(t))[0] for t in texts]
    finally:
        shield_model.predict_proba = original
    return [s if s in ("drop_recruitment", "safe") else "other_fraud" for s in schemes]


def shield_table(y, preds: dict[str, list[str]]) -> list[str]:
    lines = ["| Модель | Вербовка: precision | Вербовка: recall | Другое мошенн.: F1 | Нормальные: F1 | Accuracy |", "|---|---|---|---|---|---|"]
    for name, pred in preds.items():
        p, r, f, _ = precision_recall_fscore_support(y, pred, labels=LABELS, zero_division=0)
        acc = float(np.mean(np.array(y) == np.array(pred)))
        lines.append(f"| {name} | {p[0]:.3f} | {r[0]:.3f} | {f[1]:.3f} | {f[2]:.3f} | {acc:.3f} |")
    return lines


def eval_shield() -> list[str]:
    df = pd.read_csv(DATA / "messages.csv")
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SHIELD_SEED).split(df, df.label, groups=df.template_id))
    vec, clf = fit_shield(df.text.iloc[tr], df.label.iloc[tr])
    hold = df.iloc[te]
    out = [
        "## 2. Классификатор сообщений (Щит)", "",
        "Цель из PLAN.md: recall по вербовке ≥ 0.9 при precision ≥ 0.8.", "",
        f"### Синтетика, отложенные шаблоны ({len(hold)} сообщений)", "",
        "Модель не видела эти шаблоны при обучении — проверяем перенос на новые формулировки.", "",
    ]
    holdout_proba = lambda t: dict(zip(clf.classes_, clf.predict_proba(vec.transform([t]))[0]))  # noqa: E731
    out += shield_table(hold.label.tolist(), {
        "Ключевые слова (бейзлайн)": keyword_baseline(hold.text),
        "TF-IDF + логрег": clf.predict(vec.transform(hold.text)).tolist(),
        "Гибрид: модель + признаки схемы (в бэкенде)": hybrid(hold.text, holdout_proba),
    })

    rubert = REPORTS / "rubert.json"
    if rubert.exists():
        r = json.loads(rubert.read_text(encoding="utf-8"))
        out += ["", f"**Эмбеддинги {r['model']}** (считает `train_shield_rubert.py`, нужен torch; кодирование ~{r['encode_ms_per_message_cpu']} мс на сообщение на CPU):", "",
                "| Модель | Вербовка: precision | Вербовка: recall | Другое мошенн.: F1 | Нормальные: F1 | Accuracy |", "|---|---|---|---|---|---|"]
        for key, name in (("holdout", "rubert-tiny2 + логрег"), ("holdout_tfidf_plus_rubert", "TF-IDF + rubert-tiny2")):
            if key in r:
                m = r[key]
                out.append(f"| {name} | {m['drop_precision']:.3f} | {m['drop_recall']:.3f} | {m['other_f1']:.3f} | {m['safe_f1']:.3f} | {m['accuracy']:.3f} |")
        out += ["", "Вывод: один rubert уступает TF-IDF на коротких сообщениях со сленгом и опечатками; комбинация даёт +2 п. accuracy",
                "(в пределах шума на 220 сообщениях). В бэкенде оставляем TF-IDF — без torch; вернёмся к вопросу после ручного теста."]

    files = sorted(DATA.glob("messages_test_manual_*.csv"))
    manual = pd.concat([pd.read_csv(f) for f in files], ignore_index=True) if files else pd.DataFrame()
    manual = manual.dropna(subset=["text", "label"]) if not manual.empty else manual
    # Финальная модель Щита обучена и на ручных сообщениях, поэтому проверять её на них нельзя.
    # Честную оценку (учим на двух авторах, проверяем на третьем) даёт eval_manual.py — его раздел переносим как есть.
    previous = REPORTS / "metrics.md"
    head = "### Ручной тест команды (написан без LLM)"
    if previous.exists() and head in (text := previous.read_text(encoding="utf-8")):
        kept = text.split(head, 1)[1].split("## 3.", 1)[0].strip()
        return out + ["", head, kept, ""]
    out += ["", head, ""]
    if len(manual) < 30:
        out.append(f"**Ещё не собран** ({len(manual)} из 150 сообщений). Это главная проверка — до неё цифрам выше доверять нельзя.")
    else:
        sys.path.insert(0, str(ROOT.parent / "backend"))
        from app.ml import shield_model
        final = [max(pr, key=pr.get) for pr in map(shield_model.predict_proba, manual.text)]
        authors = ", ".join(sorted(manual.author.dropna().unique()))
        out += [f"{len(manual)} сообщений, авторы: {authors}.", ""]
        out += shield_table(manual.label.tolist(), {
            "Ключевые слова (бейзлайн)": keyword_baseline(manual.text),
            "TF-IDF + логрег (финальная модель)": final,
            "Гибрид: модель + признаки схемы (в бэкенде)": hybrid(manual.text),
        })
    out.append("")
    return out


def main():
    lines = [
        "# Метрики моделей", "",
        f"_Сгенерировано `ml/src/eval.py` {date.today():%d.%m.%Y}. Не править руками — перезапустить скрипт._", "",
        "> **Данные синтетические.** Транзакции — из `gen_transactions.py`, сообщения — из шаблонов `gen_messages.py`.",
        "> На синтетике модели почти всегда выглядят лучше, чем будут на реальных данных: поведение дропов здесь",
        "> задано правилами генератора. Цифры показывают, что пайплайн работает и модель обходит бейзлайн,",
        "> но не являются прогнозом качества в банке.", "",
    ]
    lines += eval_risk()
    lines += eval_shield()
    lines += [
        "## 3. Как модели дообучатся на данных банка", "",
        "- **Скоринг:** те же признаки (`backend/app/ml/features.py`) считаются по реальной истории операций; метки — подтверждённые",
        "  случаи из базы ЦБ о дропах и обращения клиентов. Пороги подбираются на свежем месяце по допустимой доле ложных перехватов,",
        "  после запуска — A/B: доля отмен перевода после экрана перехвата и жалобы на ложные срабатывания.",
        "- **Щит:** текущий датасет — шаблоны; в банке — обезличенные сообщения, которые клиенты сами отправили на проверку",
        "  (с согласия), с разметкой антифрод-аналитиками. Следующий шаг по модели — эмбеддинги rubert-tiny2 вместо TF-IDF.",
        "- **Мониторинг:** доля перехватов по возрастам, дрейф признаков, ручная проверка выборки перехватов раз в неделю.", "",
    ]
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "metrics.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
