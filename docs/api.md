# Контракты API

Код-версия — `backend/app/schemas.py` (Pydantic) и `frontend/src/api/types.ts`. Меняем **все три места вместе** в одном PR.
Живая документация после запуска: http://localhost:8000/docs

## Демо-движок

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/demo/scenarios` | Список сценариев `[{id, persona, title, steps_count}]` |
| GET | `/api/demo/{id}` | Текущее состояние `DemoState` |
| POST | `/api/demo/{id}/reset` | Сброс сценария и банка персонажа → `DemoState` |
| POST | `/api/demo/{id}/next` | Следующий шаг (применяет `chat` и `bank_events` шага) → `DemoState` |
| GET | `/api/demo/{id}/stream` | SSE: `DemoState` после каждого шага, перевода, действия в SOS |

```jsonc
// DemoState
{
  "scenario_id": "artem",
  "persona": { "id": "artem", "name": "Артём", "age": 16, "balance": 31200, "description": "..." },
  "step_index": 1, "steps_count": 5,
  "step": { "id": "incoming", "title": "Деньги пришли", "hint": "...", "chat": [...], "bank_events": [...], "expect": null },
  "chat_history": [{ "sender": "recruiter", "text": "..." }],
  "risk": { "persona_id": "artem", "score": 0.55, "level": "medium", "signals": ["Зачисление 30 000 ₽ от незнакомого отправителя"] }
}
```

### Формат сценария `content/scenarios/<id>.json`
```jsonc
{
  "persona_id": "artem",                       // из content/personas.json
  "title": "…",
  "steps": [{
    "id": "incoming", "title": "Деньги пришли", "hint": "подсказка для жюри",
    "chat": [{ "sender": "recruiter | user | system", "text": "…" }],
    "bank_events": [{ "type": "incoming | outgoing", "amount": 30000, "counterparty": "Иван К.", "is_new_counterparty": true }],
    "expect": { "action": "transfer", "to": "+79990001234", "amount": 27000 }   // или {"action":"sos","branch":"A"} / {"action":"event","type":"salary"}
  }]
}
```

## Фейковый банк и скоринг

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/personas` | Персонажи с текущим балансом |
| GET | `/api/personas/{id}/transactions` | История операций |
| POST | `/api/payments/transfer` | Попытка перевода → скоринг → `ok` или `intercepted` |
| GET | `/api/risk/{persona_id}/live` | Риск «прямо сейчас» для правой панели |

```jsonc
// POST /api/payments/transfer
{ "persona_id": "artem", "to": "+79990001234", "amount": 27000 }
// →
{
  "status": "intercepted",
  "risk": { "score": 0.9, "level": "high",
            "reasons": ["30 000 ₽ пришли от незнакомца 1 мин назад", "Ты переводишь 90% этой суммы дальше", "Новый получатель…", "Клиенту 16 лет"] },
  "intercept": { "title": "Стоп, подожди", "text": "…", "consequences": ["…"],
                 "actions": ["cancel", "offered_job", "check_message", "continue"] },
  "balance": 31200
}
```
Перехват — при `level == "high"` (score ≥ 0.7). Если исходящие на паузе — `423`.

## Безопасный выход (SOS)

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET | `/api/sos/branches` | Ветки A–D из `content/sos/branches.json` |
| GET | `/api/sos/legal` | Юр. формулировки из `content/legal.json` |
| POST | `/api/sos/return-funds` | `{persona_id, operation_id}` → `{claim_id, frozen_amount, status: "frozen" \| "not_found"}` |
| POST | `/api/sos/evidence` | `{persona_id, images_base64[]}` → `{evidence_id, count}`. 1–10 картинок, вместе до 7 МБ, иначе 422. Картинки не хранятся — только номер пакета и число; пакет попадает в черновики обращений этого клиента |
| POST | `/api/sos/pause-outgoing` | `{persona_id}` → `{paused_until}` |
| POST | `/api/sos/report` | `{persona_id, branch}` → `{draft_text, attachments[]}` — `attachments` — номера пакетов доказательств этого клиента |

## Щит

```jsonc
// POST /api/shield/check
{ "text": "Подработка без опыта! Прими перевод и переведи дальше, 10% твои", "image_base64": null }
// →
{ "risk": "high", "score": 0.95, "scheme": "drop_recruitment",
  "red_flags": ["Просят принять перевод на твою карту", "..."],
  "explanation": "…", "consequences": ["…"], "advice": ["…"],
  "source": "classifier+template" }   // или "classifier+llm"
```
`scheme`: `drop_recruitment` · `phishing` · `relative_in_trouble` · `prize` · `other_fraud` (мошенничество другого типа) · `safe`.

## Уроки, квест, прогресс

| Метод | Путь | Тело → ответ |
|---|---|---|
| POST | `/api/events` | `{persona_id, type, payload}` → `{lesson \| null}`; типы: `p2p_stranger, salary, subscription, overspend, bank_call` |

Условия урока — поле `when` в `content/lessons/triggers.json`. Поля `payload`: `p2p_stranger` → `amount` (≥ 1000), `salary` → `is_first` (true), `subscription` → `active_subscriptions` (≥ 3), `overspend` → `overspend_ratio` (≥ 1.3). Если поля нет в `payload`, условие не проверяется и урок показывается.
| GET | `/api/lessons/{id}` | Урок: `{id, title, xp, cards[], quiz}` |
| GET | `/api/quest/{id}` | Граф квеста: `{start, nodes[{id, speaker, text, choices[{text, next}], ending?}]}` |
| POST | `/api/progress` | `{persona_id, lesson_id \| quest_id}` → `{xp, level}` |

## Песочница и профиль клиента (ветка `ariasokuss`)

Алгоритм в два этапа (`backend/app/services/risk.py`):
1. **Зачисление** — `score_incoming`: сравнение с профилем (свои отправители, средний чек пополнения). Подозрительное зачисление не блокируется, а помечается `flagged: true`.
2. **Перевод** — `score_transfer`: если помеченные деньги пытаются переслать дальше (транзит), при риске ≥ 0.7 перевод перехватывается.

| Метод | Путь | Что делает |
|---|---|---|
| POST | `/api/personas/{id}/reset` | Сброс аккаунта к истории из `content/personas.json` |
| GET | `/api/personas/{id}/profile` | `Profile`: `avg_topup`, `avg_spend`, `known_senders`, `known_recipients`, `min_transit_minutes` |
| POST | `/api/payments/topup` | `{persona_id, sender: "Мама" \| "Папа" \| "Неизвестный", amount}` → `OperationResponse` (`ok` / `flagged`) |
| POST | `/api/payments/pay` | `{persona_id, merchant, category, amount}` → `OperationResponse` |
| POST | `/api/payments/transfer` | + поле `confirmed: bool` — «Это мои деньги» после перехвата |
| POST | `/api/sos/action` | `{persona_id, action}` — демо-действия «Безопасного выхода» (блокировка контакта, заявление и т. п.) |
| POST | `/api/assistant/chat` | `{persona_id, message, history}` → `{reply, suggestions, action, source}`; правила, или LLM при `LLM_PROVIDER=ollama` |

`Transaction` дополнен полями `category` и `flagged`; `LiveRisk` — полем `profile`.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/lessons` | Все уроки как сторис (`short` — подпись плитки, `cta` — кнопка в конце), по полю `order` |
| GET | `/api/progress/{id}` | `{xp, level, done, gained}` |
| POST | `/api/progress` | `{persona_id, lesson_id \| quest_id \| action}` — XP начисляется один раз; `action: "safe_exit"` даёт +50 |

### Сценарии с окнами банка

В шаге сценария (`content/scenarios/*.json`) необязательное поле `popup` — какое окно показать после переписки:
`incoming` (необычное зачисление, «Вернуть через банк»), `request_transfer` (просьба перевести), `pressure` / `threat` (давление, угрозы),
`history` (банк заметил транзит), `lesson` (`title`, `text` — предложение посмотреть сторис), `done` (итог, `text` — что сделал персонаж).
В `bank_events` можно указать `channel` и `category` для трат (`"channel": "card", "category": "food"`).

| Метод | Путь | Что делает |
|---|---|---|
| Метод | Путь | Что делает |
|---|---|---|
| POST | `/api/shield/check` | `{image_base64}` — скриншот: EasyOCR → проверка; в ответе `recognized_text`. Без EasyOCR — 503 |
| GET | `/api/quest/{id}` | Квест: `nodes` с `choices`, финалы `ending: good / bad`; XP — `POST /api/progress {quest_id}` |

## Каналы роста: копилка, мост, «Пушкинская карта»

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET | `/api/goals/{persona_id}` | Цели: `[{id, title, target, saved}]` |
| POST | `/api/goals` | `{persona_id, title, target}` → цель |
| POST | `/api/goals/{goal_id}/deposit` | `{persona_id, amount}` → `{goal, balance, message}`; 422 — не хватает денег; +20 XP за первое пополнение |
| POST | `/api/bridge/migrate` | `{persona_id, parent_consent}` → `{persona, carried_goals, carried_xp, carried_stories, message}`; 403 без согласия родителя, 409 если уже в «Старте» |
| GET | `/api/pushkin/offers` | Офферы витрины «Старта» для держателей «Пушкинской карты» |
| POST | `/api/pushkin/{persona_id}/activate` | → `{persona, offers, message}`; 409 если карта «Старт» уже есть |

У персонажа есть `segment`: `kids` («Детский банк»), `start` («Старт»), `pushkin` (только «Пушкинская карта»), и `pushkin_balance`.
Новые типы окон сценария: `birthday`, `bridge`, `pushkin`, `goal`; новые `expect.action`: `bridge`, `pushkin`, `goal` (`{goal, target, amount}`).

## Метрики демо

Продукт измеряет себя уже в демо: события пишутся в аккаунт и сохраняются вместе с ним, «сначала» их обнуляет.
Определения метрик и решения по ним — `docs/business/metrics.md`.

| Метод | Путь | Тело → ответ |
|---|---|---|
| POST | `/api/metrics/events` | `{persona_id, name, action?}` → `{ok}`. Только события, которые решаются в интерфейсе: `intercept_cancelled` (`action`: `cancel`, `call_bank`, `offered_job`) и `safe_exit_opened`; остальные имена — 422 |
| GET | `/api/metrics/summary?persona_id=` | `{events, intercept_cancel_rate, safe_exit_conversion, median_seconds_to_action, prevented_transits}`; без `persona_id` — по всем аккаунтам этой сессии бэкенда; доли `null`, пока нет знаменателя |

Остальные события пишет бэкенд сам:

| Событие | Где |
|---|---|
| `intercept_shown` | `POST /api/payments/transfer` → `intercepted` |
| `intercept_continued` | `POST /api/payments/transfer` с `confirmed: true` после перехвата |
| `safe_exit_action` | `POST /api/sos/action`, `/api/sos/return-funds` (`action: return_funds`), `/api/sos/pause-outgoing` |
| `lesson_completed` | `POST /api/progress` с `lesson_id` (первое прохождение) |
| `shield_checked` | `POST /api/shield/check` с `persona_id` (поле необязательное, нужно только для метрик) |
