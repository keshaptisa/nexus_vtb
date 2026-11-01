// CatBoost-модель скоринга перевода прямо на телефоне.
// Файл модели — выгрузка backend/app/ml/models/risk.cbm в JSON (scripts/export_risk_model.py):
// «забывчивые» деревья глубины 5 (сейчас 596). Предсказание — сумма листьев по всем деревьям и сигмоида.
import modelJson from '../content/models/risk_model.json'
import { FEATURES, NO_INCOMING_MINUTES, phrase, type FeatureName, type Features } from './features'

interface Tree {
  s: [number, number][] // [номер признака, порог]
  v: number[] // значения листьев
}
interface RiskModel {
  features: string[]
  scale_bias: [number, number[]]
  trees: Tree[]
}

const model = modelJson as unknown as RiskModel

// Пороги из backend/app/ml/models/risk_meta.json и шкала API: перехват от 0.7, «средний» от 0.4.
// У подтверждённых самозанятых порог перехвата выше: между 0.3 и 0.5 — предупреждение вместо остановки
// (ml/reports/self_employed.md)
const THR_MEDIUM = 0.1
const THR_HIGH = 0.3
const THR_HIGH_SELF_EMPLOYED = 0.5
const API_MEDIUM = 0.4
const API_HIGH = 0.7

function raw(x: number[]): number {
  let sum = 0
  for (const tree of model.trees) {
    let index = 0
    for (let j = 0; j < tree.s.length; j++) {
      const [f, border] = tree.s[j]
      if (x[f] > border) index |= 1 << j
    }
    sum += tree.v[index]
  }
  const [scale, bias] = model.scale_bias
  return scale * sum + (bias[0] ?? 0)
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
const vector = (f: Features) => FEATURES.map((name) => f[name])

/** Вероятность, что перевод — транзит дропа */
export function probability(f: Features): number {
  return sigmoid(raw(vector(f)))
}

/** Кусочно-линейно в шкалу API, как to_api_scale в backend/app/ml/risk_model.py */
export function toApiScale(p: number, selfEmployed = false): number {
  const high = selfEmployed ? THR_HIGH_SELF_EMPLOYED : THR_HIGH
  if (p < THR_MEDIUM) return (API_MEDIUM * p) / THR_MEDIUM
  if (p < high) return API_MEDIUM + ((API_HIGH - API_MEDIUM) * (p - THR_MEDIUM)) / (high - THR_MEDIUM)
  return API_HIGH + ((1 - API_HIGH) * (p - high)) / (1 - high)
}

// «Обычные» значения признаков: с ними сравниваем, чтобы понять вклад каждого признака
// (на сервере причины берутся из SHAP; здесь — сколько изменится оценка, если признак сделать обычным)
const BASELINE: Partial<Record<FeatureName, number>> = {
  minutes_since_stranger_incoming: NO_INCOMING_MINUTES,
  stranger_incoming_24h: 0,
  forward_share: 0,
  is_new_recipient: 0,
  unique_stranger_senders_24h: 0,
  unique_stranger_senders_7d: 0,
  client_age: 20,
  card_age_days: 365,
  turnover_spike: 1,
  is_night: 0,
  cash_withdrawal_after_incoming: 0,
}

function contributions(f: Features): { name: FeatureName; delta: number }[] {
  const base = raw(vector(f))
  return FEATURES.map((name) => {
    const b = BASELINE[name]
    if (b === undefined || b === f[name]) return { name, delta: 0 }
    return { name, delta: base - raw(vector({ ...f, [name]: b })) }
  })
}

/** «Сколько пришло» и «когда пришло» — одна мысль: склеиваем в одну причину (замечание из опроса) */
function reasonsFor(picked: FeatureName[], f: Features): string[] {
  const sumKey: FeatureName = 'stranger_incoming_24h'
  const timeKey: FeatureName = 'minutes_since_stranger_incoming'
  if (picked.includes(sumKey) && picked.includes(timeKey)) {
    const amount = (phrase(sumKey, f[sumKey]) ?? '').split(' пришли')[0]
    const merged = `${amount} пришли от незнакомых отправителей, последний перевод — ${Math.round(Math.max(f[timeKey], 1))} мин назад`
    return picked.filter((k) => k !== timeKey).map((k) => (k === sumKey ? merged : phrase(k, f[k]) ?? ''))
  }
  return picked.map((k) => phrase(k, f[k]) ?? '')
}

/** → оценка в шкале API и до трёх причин для экрана перехвата */
export function predict(f: Features, top = 3, selfEmployed = false): { score: number; probability: number; reasons: string[] } {
  const p = probability(f)
  const picked = contributions(f)
    .filter((c) => c.delta > 0 && phrase(c.name, f[c.name]))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, top)
    .map((c) => c.name)
  return { score: Math.round(toApiScale(p, selfEmployed) * 100) / 100, probability: p, reasons: reasonsFor(picked, f).filter(Boolean) }
}

export const MODEL_INFO = { trees: model.trees.length, depth: model.trees[0]?.s.length ?? 0 }
