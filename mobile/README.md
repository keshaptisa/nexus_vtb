# «Старт» — мобильное приложение

Молодёжный раздел банка для 14–22 лет на Expo (React Native). **Бэкенд не нужен:** скоринг переводов (CatBoost),
Щит (TF-IDF + логрег), сценарии, «Безопасный выход», уроки и XP считаются прямо на телефоне. Состояние сохраняется
на устройстве (AsyncStorage). Данные синтетические.

## Запуск

```bash
cd mobile
npm install
npx expo start          # QR-код → открыть в Expo Go (телефон и компьютер в одной Wi-Fi)
npm run web             # то же приложение в браузере
```

Совет: держите `mobile/` вне синхронизации OneDrive или исключите `node_modules` — там десятки тысяч файлов.

## Сборка APK без Android Studio

```bash
npx eas-cli@latest login     # бесплатный аккаунт Expo
npm run build:apk            # облачная сборка (профиль preview в eas.json), в конце — ссылка на .apk
```

Для iPhone нужен платный аккаунт Apple Developer; без него — показ через Expo Go.

## Что внутри

| Раздел | Что есть |
|---|---|
| Выбор героя | Комикс-карточки пяти героев, как на главной сайта |
| Главная | Сторис, карта с анимированным балансом, быстрые действия, «Проиграть сценарий», уровень и копилка, «Что видит банк», траты за месяц |
| Платежи | Перевод, пополнение, оплата, свои получатели, история |
| Расти | Уровень и XP, истории по событию, квест, копилка |
| Забота | «Безопасный выход», Щит, Бит, «Что видит банк», что грозит по закону |
| Сценарий | Сообщения вербовщика приходят пушами «мессенджера», окна банка — нативными шторками, панель шагов сверху |

Структура разделов повторяет логику ВТБ Онлайн 2026 («Расти», «Почувствуй заботу»), а цвета, шрифты и знак —
собственные, как у сайта «Старта»: логотип и фирменный стиль ВТБ не используем без разрешения организаторов.

## Что перенесено с бэкенда

| Сервер | Телефон |
|---|---|
| `backend/app/services/bank.py` | `src/engine/bank.ts` |
| `services/risk.py`, `ml/features.py` | `src/engine/risk.ts`, `src/engine/features.ts` |
| `ml/risk_model.py` + `risk.cbm` | `src/engine/risk-model.ts` + `src/content/models/risk_model.json` (596 деревьев, 14 признаков, свой порог для самозанятых — `ml/reports/self_employed.md`) |
| `services/shield.py`, `ml/text.py`, `ml/shield_model.py` | `src/engine/shield.ts` + `src/content/models/shield.json` |
| `api/payments.py`, `sos.py`, `learning.py`, `channels.py` | `src/engine/services.ts` |
| `services/assistant.py` | `src/engine/assistant.ts` (только правила, без LLM) |
| `services/demo.py` + логика `Cabinet.tsx` | `src/store/scenario-store.ts` |

Отличия от сайта: Бит отвечает по правилам (без LLM), нет распознавания скриншотов в Щите (OCR работает на сервере),
причины перехвата берутся по вкладу признаков в оценку модели (на сервере — SHAP; сами оценки совпадают).

## Проверки

```bash
npm run typecheck        # TypeScript
npm run check:engine     # CatBoost на TS против эталонов Python, перехват, Щит
npx expo-doctor          # зависимости и конфигурация
```

CatBoost на телефоне совпадает с Python до 7 знаков; Щит даёт те же вероятности и вердикты, что сервер.

## Обновить контент и модели

```bash
npm run sync-content                     # content/*.json и модель Щита из репозитория
python scripts/export_risk_model.py      # CatBoost → JSON (нужен Python с catboost, например ml/.venv)
```

## Структура

```
src/app/          экраны (Expo Router): (tabs)/ — вкладки, остальное — модальные окна
src/engine/       логика банка, скоринг, Щит, «Безопасный выход», уроки — без React
src/store/        состояние: счета героев, сценарий, уведомления
src/components/   интерфейс: карта, сторис, шкала риска, пуши, панель сценария, анимации
src/content/      копия content/ и модели
```
