// Признаки для скоринга перевода. Порт backend/app/ml/features.py — один в один, чтобы модель
// на телефоне получала те же числа, на которых её обучали.
import { rub } from './format'
import type { Transaction } from './types'

export const FEATURES = [
  'minutes_since_stranger_incoming',
  'stranger_incoming_24h',
  'forward_share',
  'is_new_recipient',
  'unique_stranger_senders_24h',
  'unique_stranger_senders_7d',
  'client_age',
  'card_age_days',
  'turnover_spike',
  'is_night',
  'cash_withdrawal_after_incoming',
  'recipient_transfers_30d', // сколько раз за 30 дней уже переводили этому получателю
  'stranger_income_days_30d', // в сколько разных дней за 30 дней приходили деньги от незнакомцев
  'stranger_median_amount_30d', // медианное зачисление от незнакомца за 30 дней
] as const
export type FeatureName = (typeof FEATURES)[number]
export type Features = Record<FeatureName, number>

export const NO_INCOMING_MINUTES = 7 * 24 * 60
const MIN_DAILY_TURNOVER = 300

const PHRASE_WHEN: Record<FeatureName, (v: number) => boolean> = {
  stranger_incoming_24h: (v) => v >= 5000,
  minutes_since_stranger_incoming: (v) => v < 24 * 60,
  forward_share: (v) => v >= 0.5,
  is_new_recipient: (v) => v >= 1,
  unique_stranger_senders_24h: (v) => v >= 2,
  unique_stranger_senders_7d: (v) => v >= 3,
  client_age: (v) => v < 18,
  card_age_days: (v) => v < 60,
  turnover_spike: (v) => v >= 3,
  is_night: (v) => v >= 1,
  cash_withdrawal_after_incoming: (v) => v >= 1,
  // Эти признаки говорят скорее в пользу клиента — фраз для экрана перехвата у них нет
  recipient_transfers_30d: () => false,
  stranger_income_days_30d: () => false,
  stranger_median_amount_30d: () => false,
}

/** Человеческая фраза для признака или null, если значение не подозрительное */
export function phrase(name: FeatureName, value: number): string | null {
  if (!PHRASE_WHEN[name](value)) return null
  switch (name) {
    case 'stranger_incoming_24h':
      return `${rub(value)} пришли от незнакомых отправителей за сутки`
    case 'minutes_since_stranger_incoming':
      return `Деньги пришли от незнакомца ${Math.round(Math.max(value, 1))} мин назад`
    case 'forward_share':
      return `Вы переводите ${Math.round(Math.min(value, 1) * 100)}% этой суммы дальше`
    case 'is_new_recipient':
      return 'Новый получатель, раньше переводов ему не было'
    case 'unique_stranger_senders_24h':
      return `${Math.round(value)} переводов от разных незнакомцев за сутки`
    case 'unique_stranger_senders_7d':
      return `${Math.round(value)} разных незнакомых отправителей за неделю`
    case 'client_age':
      return `Клиенту ${Math.round(value)} лет`
    case 'card_age_days':
      return `Карте всего ${Math.round(value)} дн.`
    case 'turnover_spike':
      return `Оборот за сутки в ${Math.round(value)} раз выше обычного`
    case 'is_night':
      return 'Перевод ночью'
    case 'cash_withdrawal_after_incoming':
      return 'Наличные сняли сразу после зачисления'
    default:
      return null
  }
}

const isStrangerIncoming = (t: Transaction) => t.direction === 'in' && t.is_new_counterparty && !t.frozen

const round = (x: number, digits: number) => {
  const k = 10 ** digits
  return Math.round(x * k) / k
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const localDay = (ts: number) => new Date(ts).toDateString()

/** history — операции клиента ДО перевода, по возрастанию времени */
export function buildFeatures(
  history: Transaction[],
  transfer: { ts: Date; amount: number; to: string },
  clientAge: number,
  cardAgeDays: number,
): Features {
  const now = transfer.ts.getTime()
  const dayAgo = now - 86_400_000
  const weekAgo = now - 7 * 86_400_000
  const monthAgo = now - 30 * 86_400_000

  let lastStranger: Transaction | null = null
  let strangerSum24h = 0
  const senders24h = new Set<string>()
  const senders7d = new Set<string>()
  const known = new Set<string>()
  let turnover24h = transfer.amount
  let turnover30d = 0
  let cashAfter = false
  let toRecipient30d = 0
  const strangerDays30d = new Set<string>()
  const strangerAmounts30d: number[] = []

  for (const tx of history) {
    known.add(tx.counterparty)
    const ts = new Date(tx.ts).getTime()
    if (ts < monthAgo) continue
    turnover30d += tx.amount
    if (tx.direction === 'out' && tx.counterparty === transfer.to) toRecipient30d += 1
    if (isStrangerIncoming(tx)) {
      strangerDays30d.add(localDay(ts))
      strangerAmounts30d.push(tx.amount)
    }
    if (ts >= dayAgo) turnover24h += tx.amount
    if (isStrangerIncoming(tx) && ts >= weekAgo) {
      senders7d.add(tx.counterparty)
      lastStranger = tx
      if (ts >= dayAgo) {
        senders24h.add(tx.counterparty)
        strangerSum24h += tx.amount
      }
    }
  }

  if (lastStranger && new Date(lastStranger.ts).getTime() >= dayAgo) {
    const from = new Date(lastStranger.ts).getTime()
    cashAfter = history.some((tx) => tx.direction === 'out' && tx.channel === 'cash' && new Date(tx.ts).getTime() >= from)
  }

  let minutes = NO_INCOMING_MINUTES
  if (lastStranger) minutes = Math.min((now - new Date(lastStranger.ts).getTime()) / 60_000, NO_INCOMING_MINUTES)

  const meanDaily = Math.max(turnover30d / 30, MIN_DAILY_TURNOVER)
  return {
    minutes_since_stranger_incoming: round(Math.max(minutes, 0), 1),
    stranger_incoming_24h: Math.round(strangerSum24h),
    forward_share: strangerSum24h ? round(Math.min(transfer.amount / strangerSum24h, 2), 3) : 0,
    is_new_recipient: known.has(transfer.to) ? 0 : 1,
    unique_stranger_senders_24h: senders24h.size,
    unique_stranger_senders_7d: senders7d.size,
    client_age: clientAge,
    card_age_days: round(cardAgeDays, 1),
    turnover_spike: round(turnover24h / meanDaily, 2),
    is_night: transfer.ts.getHours() < 6 ? 1 : 0,
    cash_withdrawal_after_incoming: cashAfter ? 1 : 0,
    recipient_transfers_30d: toRecipient30d,
    stranger_income_days_30d: strangerDays30d.size,
    stranger_median_amount_30d: strangerAmounts30d.length ? Math.round(median(strangerAmounts30d)) : 0,
  }
}

/** Прозрачные правила с баллами — запасной вариант, если модель не загрузилась */
export function ruleScore(f: Features): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const push = (r: string | null) => r && reasons.push(r)
  if (f.minutes_since_stranger_incoming <= 60) {
    score += 0.35
    push(phrase('minutes_since_stranger_incoming', f.minutes_since_stranger_incoming))
    if (f.forward_share >= 0.7) {
      score += 0.3
      push(phrase('forward_share', f.forward_share))
    }
  }
  if (f.is_new_recipient) {
    score += 0.15
    push(phrase('is_new_recipient', 1))
  }
  if (f.client_age < 18) {
    score += 0.1
    push(phrase('client_age', f.client_age))
  }
  if (f.unique_stranger_senders_24h >= 3) {
    score += 0.2
    push(phrase('unique_stranger_senders_24h', f.unique_stranger_senders_24h))
  }
  return { score: round(Math.min(score, 1), 2), reasons }
}
