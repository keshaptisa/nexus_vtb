# ML

| Модель | Задача | Владелец |
|---|---|---|
| Скоринг перевода | Правила + CatBoost: перехватывать ли перевод, причины из SHAP | Даша |
| Классификатор сообщений | `drop_recruitment` / `other_fraud` / `safe` для Щита | Даша |

Бейзлайны уже работают в бэкенде (`backend/app/services/risk.py`, `shield.py`) —
модели из этой папки должны их **побеждать по метрикам** и затем заменить.

## Порядок работы

```bash
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
python src/gen_transactions.py                   # data/transactions.parquet + clients.parquet (3000 клиентов, 60 дней)
python src/train_risk.py                         # → backend/app/ml/models/risk.cbm + risk_meta.json
python src/gen_messages.py                       # data/messages.csv (~1000 сообщений из шаблонов)
python src/train_shield.py                       # → backend/app/ml/models/shield.json
python src/eval.py                               # → reports/metrics.md
python src/gen_transactions.py --seed-personas   # история демо-персонажей в content/personas.json
```

**Дополнительно (тяжёлые зависимости, ставятся отдельно):**
```bash
# rubert-tiny2 для Щита — сравнение с TF-IDF, результат в reports/rubert.json → metrics.md
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install sentence-transformers
python src/train_shield_rubert.py

# сравнение LLM для объяснений Щита → reports/llm_comparison.md, ответы для ручной оценки — reports/llm_answers.csv
ollama pull qwen2.5:7b-instruct && ollama pull qwen2.5:3b-instruct
python src/eval_llm.py --ollama qwen2.5:7b-instruct qwen2.5:3b-instruct
python src/eval_llm.py --gigachat     # нужен ключ: set GIGACHAT_CREDENTIALS=...
python src/eval_llm.py --summarize    # после ручной оценки понятности
```
Если на диске C мало места — ставить на другой диск: модели Ollama через переменную `OLLAMA_MODELS`, кэш HuggingFace через `HF_HOME`.

**Где что лежит**
- Признаки и токенизация — `backend/app/ml/features.py`, `backend/app/ml/text.py`: один код для обучения и бэкенда.
- Готовые модели — `backend/app/ml/models/` (коммитим, они маленькие). Бэкенд подхватывает их сам;
  если файла нет — работает на правилах (`rule_score`) и ключевых словах.
- Скоринг: CatBoost, причины перехвата — SHAP (встроен в CatBoost) → фразы из `PHRASES`.
- Щит: TF-IDF + логрег, выгружен в JSON — бэкенду не нужен scikit-learn.

## Ручной тест Щита (150 сообщений, без LLM)

Каждая пишет **50 сообщений** в свой файл: `data/messages_test_manual_<имя>.csv` (`dasha`, `masha`, `lead`). Эти файлы коммитим, остальное в `data/` — нет.

| Столбец | Что писать |
|---|---|
| `text` | Сообщение, как его прислали бы в Telegram, ВК или SMS: сленг, опечатки, эмодзи — как в жизни |
| `label` | `drop_recruitment` — вербовка в дропы · `other_fraud` — другое мошенничество · `safe` — нормальное сообщение |
| `scheme` | Только для `other_fraud`: `phishing` («служба безопасности», коды, ссылки) · `relative_in_trouble` · `prize` · `investment` · `marketplace` · `other`. Для остальных — пусто |
| `author` | Твоё имя (`dasha`) |

**Примерная раскладка на 50:** 20 вербовки, 15 другого мошенничества, 15 нормальных.

- Вербовка — по-разному: «подработка», «прими перевод от клиента», «нужна карта на пару дней», «оформи карту — 3к», «обмен крипты», «курьер с наличкой», вербовка через игры и друзей.
- Среди нормальных — **трудные примеры**: легальные вакансии с оплатой на карту, «скинь 300 за пиццу», «верни долг», родители «перевела тебе 500», сбор денег на подарок. Без них модель научится видеть мошенничество в любом «переведи».
- Номера телефонов — только вымышленные вида `+7 900 000-12-34`, карты — `*1234`. Имена — выдуманные.
- Не подглядывать в обучающий датасет (`data/messages.csv`) и не просить LLM — иначе тест будет нечестным.

**Как писать:** удобнее всего в Google Таблицах (4 столбца, первая строка — заголовок `text,label,scheme,author`) → Файл → Скачать → CSV → сохранить поверх своего файла. Excel на Windows сохраняет CSV в другой кодировке и с `;`, поэтому лучше через Google Таблицы.

**Проверка перед коммитом:**
```bash
python src/check_manual.py dasha
```
Скрипт проверяет формат, метки, дубли и номера, похожие на настоящие.

## Правила
- Только синтетика. Никаких реальных переписок, имён, номеров.
- Тест классификатора — `data/messages_test_manual_*.csv`: 150 примеров, написанных командой **вручную, без LLM**. Его не используем в обучении.
- Для скоринга обязательно считаем долю ложных перехватов у «нормальных» подростков.
- В отчёте честно пишем, что данные синтетические, и как модель дообучится на данных банка.

## Ложные перехваты по людям и самозанятые

```bash
python src/eval_clients.py          # → reports/false_intercepts_clients.md: у какой доли честных клиентов был хотя бы один перехват
python src/eval_self_employed.py    # → reports/self_employed.md: SHAP по ложным перехватам самозанятых, «было/стало»,
                                    #   порог для самозанятых → thr_high_self_employed в backend/app/ml/models/risk_meta.json
```
После изменения признаков в `backend/app/ml/features.py`: `train_risk.py` → `eval_self_employed.py` → `eval.py` →
`eval_clients.py`, затем выгрузка модели в приложение (`mobile/scripts/export_risk_model.py`) и сверка `npm run check:engine`.

## Щит на реальных текстах 2026 года

`data/messages_test_real_2026.csv` — тексты вербовки из открытых источников, у каждого ссылка (`source`) и дата (`date`),
остальные столбцы — как у ручного теста. `python src/eval_real.py` → `reports/shield_real.md`. Пока текстов меньше 30,
метрики не считаются. В обучение эти тексты не попадают.

## Дополнительный тест Щита (не ручной)

`data/messages_test_extra.csv` — 90 синтетических сообщений с новыми формулировками вне шаблонов генератора
и «трудными» легальными случаями. `python src/eval_extra.py` → `reports/shield_extra.md` с таблицей и списком ошибок.
Ручной тест команды (`messages_test_manual_*.csv`, PLAN.md 9.2) это не заменяет. Правила Щита под этот набор не подгоняем.
