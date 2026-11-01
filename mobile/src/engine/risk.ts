// Скоринг операций по профилю клиента. Порт backend/app/services/risk.py. Алгоритм в два этапа:
// 1. Зачисление: насколько оно выбивается из обычного поведения. Помечаем, но не блокируем.
// 2. Перевод: не пытаются ли переслать подозрительные деньги дальше. Решает CatBoost, при высоком риске — перехват.
import { RAW_PERSONAS } from './content'
import { buildFeatures, ruleScore, type Features } from './features'
import { rub, times } from './format'
import * as model from './risk-model'
import type { Account, LiveRisk, Profile, Risk, RiskLevel, Transaction } from './types'

export const HIGH = 0.7
export const MEDIUM = 0.4
const SUSPICIOUS_WINDOW_MS = 24 * 3_600_000

export const level = (score: number): RiskLevel => (score >= HIGH ? 'high' : score >= MEDIUM ? 'medium' : 'low')
const round2 = (x: number) => Math.round(x * 100) / 100
const ms = (t: Transaction) => new Date(t.ts).getTime()

/** Операции, по которым считаем обычное поведение: без подозрительных и без незнакомцев */
const baseline = (acc: Account) => acc.transactions.filter((t) => !t.flagged && !t.is_new_counterparty)

export function profile(acc: Account): Profile {
  const base = baseline(acc)
  const ins = base.filter((t) => t.direction === 'in').map((t) => t.amount)
  const outs = base.filter((t) => t.direction === 'out').map((t) => t.amount)
  const senders = [...new Set(base.filter((t) => t.direction === 'in').map((t) => t.counterparty))]
  const recipients = [...new Set(base.filter((t) => t.direction === 'out' && t.channel === 'sbp').map((t) => t.counterparty))]

  let transit: number | null = null
  acc.transactions.forEach((t, i) => {
    if (t.direction === 'in' && (t.flagged || t.is_new_counterparty)) {
      const next = acc.transactions.slice(i + 1).find((o) => o.direction === 'out')
      if (next) {
        const mins = Math.max(1, Math.floor((ms(next) - ms(t)) / 60_000))
        transit = transit === null ? mins : Math.min(transit, mins)
      }
    }
  })

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0)
  return { avg_topup: avg(ins), avg_spend: avg(outs), known_senders: senders, known_recipients: recipients, min_transit_minutes: transit }
}

function suspiciousIncoming(acc: Account, now: number): Transaction | null {
  for (let i = acc.transactions.length - 1; i >= 0; i--) {
    const t = acc.transactions[i]
    if (t.direction === 'in' && (t.flagged || t.is_new_counterparty) && !t.frozen && now - ms(t) <= SUSPICIOUS_WINDOW_MS) return t
  }
  return null
}

function strangersToday(acc: Account, now: number): Set<string> {
  return new Set(
    acc.transactions
      .filter((t) => t.direction === 'in' && t.is_new_counterparty && now - ms(t) < 86_400_000)
      .map((t) => t.counterparty),
  )
}

/** Этап 1: насколько зачисление выбивается из обычного поведения клиента */
export function scoreIncoming(acc: Account, amount: number, sender: string, isNew: boolean, now = new Date()): Risk {
  const p = profile(acc)
  let score = 0
  const reasons: string[] = []

  // «Незнакомость» решает вызывающий код: для ручного пополнения — по кругу отправителей,
  // для сценария — по флагу события (новый работодатель Кати — не повод для тревоги)
  if (isNew) {
    score += 0.35
    reasons.push(`Отправитель «${sender}» раньше вам не переводил`)
  }
  if (p.avg_topup) {
    const ratio = amount / p.avg_topup
    if (ratio >= 5) {
      score += 0.3
      reasons.push(`Сумма ${times(ratio)} больше вашего обычного пополнения (${rub(p.avg_topup)})`)
    } else if (ratio >= 2.5) {
      score += 0.15
      reasons.push(`Сумма ${times(ratio)} больше обычного пополнения (${rub(p.avg_topup)})`)
    }
  }
  if (isNew && acc.persona.age < 18) {
    score += 0.1
    reasons.push(`Клиенту ${acc.persona.age} лет — подростков чаще вербуют в дропы`)
  }
  const strangers = strangersToday(acc, now.getTime())
  if (isNew) strangers.add(sender)
  if (isNew && strangers.size >= 2) {
    score += 0.2
    reasons.push(`${strangers.size} зачисления от разных незнакомцев за сутки`)
  }
  score = round2(Math.min(score, 1))
  return { score, level: level(score), reasons }
}

function cardAgeDays(acc: Account, now: number): number {
  const raw = RAW_PERSONAS[acc.persona.id]
  if (raw?.card_age_days !== undefined) return raw.card_age_days
  const first = acc.transactions.length ? Math.min(...acc.transactions.map(ms)) : now
  return (now - first) / 86_400_000
}

export function transferFeatures(acc: Account, to: string, amount: number, now = new Date()): Features {
  const history = acc.transactions.filter((t) => ms(t) <= now.getTime()).sort((a, b) => ms(a) - ms(b))
  return buildFeatures(history, { ts: now, amount, to }, acc.persona.age, cardAgeDays(acc, now.getTime()))
}

/** Пояснения по профилю клиента — дополняют причины модели, на оценку не влияют */
function profileReasons(acc: Account, amount: number, now: number): string[] {
  const p = profile(acc)
  const reasons: string[] = []
  const inc = suspiciousIncoming(acc, now)
  if (inc?.flagged) reasons.push(`Вы пытаетесь переслать деньги, которые банк уже пометил как подозрительные (${rub(inc.amount)})`)
  if (p.avg_spend && amount / p.avg_spend >= 5) reasons.push(`Сумма ${times(amount / p.avg_spend)} больше ваших обычных трат (${rub(p.avg_spend)})`)
  return reasons
}

export type ScoreSource = 'model' | 'rules'

/** Этап 2: не пытаются ли переслать подозрительные деньги дальше */
export function scoreTransfer(acc: Account, to: string, amount: number, now = new Date()): Risk & { source: ScoreSource; features: Features } {
  const features = transferFeatures(acc, to, amount, now)
  let score: number
  let reasons: string[]
  let source: ScoreSource = 'model'
  try {
    ;({ score, reasons } = model.predict(features, 3, acc.persona.self_employed ?? false))
  } catch {
    ;({ score, reasons } = ruleScore(features))
    source = 'rules'
  }
  if (score >= MEDIUM) reasons = [...reasons, ...profileReasons(acc, amount, now.getTime()).filter((r) => !reasons.includes(r))]
  return { score, level: level(score), reasons, source, features }
}

/** Риск «прямо сейчас» для панели «Что видит банк» — без конкретного перевода */
export function liveRisk(acc: Account, now = new Date()): LiveRisk {
  let score = 0.05
  const signals: string[] = []
  const t = now.getTime()

  const inc = suspiciousIncoming(acc, t)
  if (inc) {
    // Зачисление оцениваем относительно истории ДО него
    const before: Account = { ...acc, transactions: acc.transactions.filter((x) => ms(x) < ms(inc)) }
    const r = scoreIncoming(before, inc.amount, inc.counterparty, inc.is_new_counterparty, new Date(inc.ts))
    score += r.score
    signals.push(...r.reasons)
    if (acc.transactions.some((x) => x.direction === 'out' && ms(x) >= ms(inc))) {
      score += 0.35
      signals.push('Деньги уходят дальше вскоре после зачисления (транзит)')
    }
  }

  if (acc.lastIntercept) {
    score = Math.max(score, acc.lastIntercept.score)
    const first = acc.lastIntercept.reasons[0]
    signals.push(first ? `Перевод остановлен: ${first.charAt(0).toLowerCase()}${first.slice(1)}` : 'Перевод остановлен')
  }

  const frozen = acc.transactions.filter((x) => x.frozen)
  if (frozen.length) {
    signals.push(`Заморожено ${rub(frozen.reduce((s, x) => s + x.amount, 0))} — банк вернёт отправителю`)
    score = Math.min(score, 0.3)
  }

  score = round2(Math.min(score, 1))
  return { persona_id: acc.persona.id, score, level: level(score), signals, profile: profile(acc) }
}
