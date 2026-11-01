"""Щит на реальных текстах вербовки 2026 года → reports/shield_real.md.

    python src/eval_real.py

Тексты — из открытых источников (новости с цитатами, памятки банков и МВД, каналы по кибербезопасности),
у каждого — ссылка. Файл: data/messages_test_real_2026.csv, столбцы как у ручного теста плюс источник и дата:
text, label, scheme, author, source, date. В обучение эти тексты не попадают.

Проверяется итоговый вердикт Щита в бэкенде (модель + признаки схемы), как в eval_manual.py.
Пока текстов меньше 30, скрипт пишет в отчёт, сколько собрано, и не считает метрики.
"""
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML.parent / "backend"))
from app.services import shield  # noqa: E402

DATA, REPORTS = ML / "data", ML / "reports"
FILE = DATA / "messages_test_real_2026.csv"
COLUMNS = ["text", "label", "scheme", "author", "source", "date"]
MIN_TEXTS, TARGET_RECALL = 30, 0.9


def verdict(text: str) -> str:
    label = shield.classify(text)[0]
    return label if label in ("safe", "drop_recruitment") else "other_fraud"


def main():
    df = pd.read_csv(FILE) if FILE.exists() else pd.DataFrame(columns=COLUMNS)
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"В {FILE.name} нет столбцов: {', '.join(missing)}")
    no_source = df[df.source.isna() | ~df.source.astype(str).str.startswith("http")]
    if len(no_source):
        raise SystemExit(f"У {len(no_source)} текстов нет ссылки на источник — без неё текст в тест не берём")

    lines = [
        "# Щит на реальных текстах вербовки 2026 года", "",
        f"_Сгенерировано `ml/src/eval_real.py` {date.today():%d.%m.%Y}. Данные — `ml/data/messages_test_real_2026.csv`._", "",
    ]
    drops = int((df.label == "drop_recruitment").sum())
    if len(df) < MIN_TEXTS:
        lines += [
            f"**Тест ещё не собран: {len(df)} текстов из {MIN_TEXTS}–50.** Метрики не считаем — на таком числе они ничего не скажут.", "",
            "Что нужно: тексты вербовки 2026 года из открытых источников, у каждого — ссылка. Особенно: «нейросеть-работодатель»,",
            "голос «от друга», «Пушкинская карта», «помоги с переводом для учёбы». Для оценки precision — ещё 10–15 реальных",
            "текстов другого мошенничества. Формат — как у `messages_test_manual_*.csv` плюс `source` и `date`; файл коммитим.", "",
            "Почему пока пусто (поиск 01.11.2026): в публикациях 2026 года схемы вербовки пересказаны, а дословных сообщений",
            "почти нет — проверили [РИА, 10.08.2026](https://ria.ru/20260810/moshenniki-2109893193.html),",
            "[Вести, 10.07.2026](https://www.vesti.ru/ns/v-mvd-rasskazali-kak-moshenniki-vovlekayut-rossiyan-v-dropperstvo),",
            "[АиФ Кубань, 20.06.2026](https://kuban.aif.ru/society/liki-obmana-telefonnye-moshenniki-v-rossii-kak-detey-verbuyut-v-droppery),",
            "[VladNews, 11.07.2026](https://vladnews.ru/2026-07-11/271101/predupredilo_rossiyan), онлайн-урок Банка России",
            "[«Дропы. Кто это и как им не стать?»](https://dni-fg.ru/61). Придумывать тексты нельзя, поэтому следующий шаг —",
            "собрать их вручную: скриншоты из каналов по кибербезопасности и памяток банков, с датой и ссылкой.", "",
        ]
    else:
        df["pred"] = [verdict(t) for t in df.text]
        tp = int(((df.label == "drop_recruitment") & (df.pred == "drop_recruitment")).sum())
        predicted = int((df.pred == "drop_recruitment").sum())
        recall = tp / drops if drops else 0.0
        precision = tp / predicted if predicted else 0.0
        lines += [
            f"Текстов: {len(df)}, из них вербовки — {drops}. Источников: {df.source.nunique()}.", "",
            "| Метрика | Значение | Цель |", "|---|---|---|",
            f"| Вербовка: recall | {recall:.2f} | ≥ {TARGET_RECALL} |",
            f"| Вербовка: precision | {precision:.2f} | ≥ 0.8 |",
            f"| Accuracy | {(df.label == df.pred).mean():.2f} | |", "",
            "## Ошибки", "", "| Текст | Метка | Щит | Источник |", "|---|---|---|---|",
        ]
        for r in df[df.label != df.pred].itertuples():
            lines.append(f"| {r.text[:120]} | {r.label} | {r.pred} | {r.source} |")
        lines.append("")
        if recall < TARGET_RECALL:
            lines += [f"Recall ниже {TARGET_RECALL} — следующий шаг: дообучить на части текстов, а тест держать отдельно.", ""]
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "shield_real.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
