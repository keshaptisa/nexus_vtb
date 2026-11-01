// «Безопасный выход», уроки и XP, копилка, мост из «Детского банка», «Пушкинская карта», перевод с перехватом.
// Порт backend/app/api/{sos,learning,channels,payments}.py. Всё работает на копии счёта, которую передаёт стор.
import * as bank from './bank'
import { LEGAL, lessonById, QUEST, REPORT_TEMPLATES, TRIGGERS } from './content'
import { ddmm, ddmmyyyy, hhmm, rub, uid } from './format'
import { profile, scoreIncoming, scoreTransfer } from './risk'
import type { Account, Goal, Lesson, OperationResult, Progress, TransferResult } from './types'

// ---------- Платежи ----------
// Имена «неизвестных» отправителей в песочнице — так выглядят переводы от вербовщиков
const STRANGER_NAMES = ['Иван К.', 'Олег П.', 'Марина С.', 'Руслан Т.', 'Алина В.', 'Тимур Н.']
const INTERCEPT_CONSEQUENCES = ['uk187', 'cbr_base']
const INTERCEPT_MAX_REASONS = 2

/** Этап 1: зачисление проходит всегда, но подозрительное — помечается */
export function topup(acc: Account, sender: string, amount: number): OperationResult {
  const isNew = !profile(acc).known_senders.includes(sender)
  const name = sender === 'Неизвестный' ? STRANGER_NAMES[Math.floor(Math.random() * STRANGER_NAMES.length)] : sender
  const risk = scoreIncoming(acc, amount, name, isNew)
  const flagged = risk.level !== 'low'
  const tx = bank.incoming(acc, amount, name, isNew, flagged)
  return {
    status: flagged ? 'flagged' : 'ok',
    transaction: tx,
    risk,
    message: flagged
      ? 'Зачисление выглядит необычно. Не переводите эти деньги дальше, даже «обратно» по просьбе отправителя — сначала разберитесь, откуда они.'
      : 'Зачисление в пределах вашего обычного поведения.',
  }
}

/** Оплата картой. Покупки в магазинах — не транзит, отдельного скоринга не требуют */
export function pay(acc: Account, merchant: string, category: string, amount: number): OperationResult {
  const empty = { score: 0, level: 'low' as const, reasons: [] }
  if (amount > bank.available(acc)) return { status: 'rejected', transaction: null, risk: empty, message: 'Недостаточно средств' }
  const tx = bank.outgoing(acc, amount, merchant, 'card', category)
  return { status: 'ok', transaction: tx, risk: empty, message: 'Оплачено' }
}

/** Этап 2: перевод подозрительных денег дальше перехватывается */
export function transfer(acc: Account, to: string, amount: number, confirmed = false): TransferResult {
  const empty = { score: 0, level: 'low' as const, reasons: [] }
  if (acc.outgoingPausedUntil && new Date(acc.outgoingPausedUntil) > new Date())
    return { status: 'error', risk: empty, intercept: null, message: 'Исходящие переводы на паузе по вашей просьбе' }
  if (amount > bank.available(acc))
    return { status: 'error', risk: empty, intercept: null, message: 'Недостаточно средств: замороженные суммы переводить нельзя' }

  const { score, level, reasons } = scoreTransfer(acc, to, amount)
  const risk = { score, level, reasons }
  if (level === 'high' && !confirmed) {
    acc.lastIntercept = risk // полный список причин остаётся для «Что видит банк»
    return {
      status: 'intercepted',
      risk: { ...risk, reasons: reasons.slice(0, INTERCEPT_MAX_REASONS) },
      intercept: {
        title: 'Перевод остановлен',
        text: 'Похоже, через вашу карту хотят провести чужие деньги. Отвечать за такой перевод будет владелец карты.',
        consequences: INTERCEPT_CONSEQUENCES.filter((k) => LEGAL[k]).map((k) => LEGAL[k].short),
        actions: ['cancel', 'offered_job', 'call_bank', 'check_message', 'continue'],
      },
    }
  }
  bank.outgoing(acc, amount, to)
  acc.lastIntercept = null
  return { status: 'ok', risk, intercept: null }
}

// ---------- XP ----------
export const XP_PER_LEVEL = 100
export const ACTION_XP: Record<string, number> = { safe_exit: 50, first_goal_deposit: 20, bridge: 30, pushkin_start: 30 }

export const progressOf = (acc: Account, gained = 0): Progress => ({
  xp: acc.xp,
  level: 1 + Math.floor(acc.xp / XP_PER_LEVEL),
  done: [...acc.done].sort(),
  gained,
})

/** XP один раз за урок, квест или правильное действие */
export function award(acc: Account, key: string, xp: number): number {
  if (acc.done.includes(key)) return 0
  acc.done.push(key)
  acc.xp += xp
  return xp
}
export const awardLesson = (acc: Account, lesson: Lesson) => award(acc, `lesson:${lesson.id}`, lesson.xp ?? 20)
export const awardQuest = (acc: Account) => award(acc, `quest:${QUEST.id}`, QUEST.xp ?? 50)
export const awardAction = (acc: Account, action: string) => award(acc, `action:${action}`, ACTION_XP[action] ?? 0)

// ---------- Триггеры уроков ----------
const OPS: Record<string, (a: unknown, b: unknown) => boolean> = {
  '==': (a, b) => a === b,
  '>=': (a, b) => (a as number) >= (b as number),
  '>': (a, b) => (a as number) > (b as number),
  '<=': (a, b) => (a as number) <= (b as number),
  '<': (a, b) => (a as number) < (b as number),
}

/** Событие + условия → урок. Полей, которых нет в payload, не проверяем */
export function lessonForEvent(type: string, payload: Record<string, unknown> = {}): Lesson | null {
  for (const t of TRIGGERS) {
    if (t.event !== type) continue
    const ok = (t.when ?? []).every((c) => !(c.field in payload) || OPS[c.op](payload[c.field], c.value))
    if (ok) return lessonById(t.lesson_id)
  }
  return null
}

// ---------- «Безопасный выход» ----------
export const ACTION_RESULTS: Record<string, string> = {
  block_contact: 'Контакт заблокирован, переписка сохранена',
  evidence: 'Переписка сохранена и прикреплена к обращению',
  notify_parent: 'Готов текст сообщения для взрослого — отправка по вашему решению',
  report_bank: 'Обращение в банк отправлено вместе с хронологией операций',
  report_police: 'Черновик заявления в полицию готов, список доказательств приложен',
  block_card: 'Карта заблокирована, перевыпуск заказан',
  logout_all: 'Вы вышли со всех устройств, пароль нужно сменить при следующем входе',
}

export const ACTION_LABEL: Record<string, string> = {
  return_funds: 'Вернуть через банк',
  block_contact: 'Заблокировать контакт',
  evidence: 'Сохранить переписку',
  notify_parent: 'Подготовить сообщение взрослому',
  pause_outgoing: 'Поставить переводы на паузу',
  report_bank: 'Сообщить банку',
  report_police: 'Подготовить заявление',
  block_card: 'Заблокировать карту',
  logout_all: 'Выйти со всех устройств',
}

export function returnFunds(acc: Account): { claimId: string; frozen: number } | null {
  const inc = bank.suspiciousIncoming(acc)
  if (!inc) return null
  bank.freeze(acc, inc.id)
  return { claimId: `CLM-${uid(6).toUpperCase()}`, frozen: inc.amount }
}

export function addEvidence(acc: Account, count: number): string {
  const id = `EV-${uid(6).toUpperCase()}`
  acc.evidence[id] = count
  return id
}

export function pauseOutgoing(acc: Account): void {
  acc.outgoingPausedUntil = new Date(Date.now() + 24 * 3_600_000).toISOString()
}

function attachments(acc: Account): string {
  const ids = Object.keys(acc.evidence)
  if (!ids.length) return ''
  const total = Object.values(acc.evidence).reduce((s, n) => s + n, 0)
  return `\n\nПриложение: скриншоты переписки — ${total} шт. (${ids.join(', ')}).`
}

/** Черновик обращения в банк или заявления в полицию по шаблону ветки */
export function draft(acc: Account, kind: string, branch?: string): string | null {
  const templates = REPORT_TEMPLATES[kind]
  if (!templates || typeof templates === 'string') return null
  const template = templates[branch ?? 'A'] ?? Object.values(templates)[0]
  if (!template) return null
  const txs = acc.transactions
  const inc = [...txs].reverse().find((t) => t.direction === 'in' && (t.flagged || t.is_new_counterparty))
  const out = [...txs].reverse().find((t) => t.direction === 'out' && t.is_new_counterparty)
  const when = (iso: string) => `${ddmm(new Date(iso))} в ${hhmm(new Date(iso))}`
  const timeline = txs
    .slice(-6)
    .map((t) => `${ddmm(new Date(t.ts))} ${hhmm(new Date(t.ts))}  ${t.direction === 'in' ? '+' : '−'}${rub(t.amount)}  ${t.counterparty}`)
    .join('\n')
  const values: Record<string, string> = {
    name: acc.persona.name,
    age: String(acc.persona.age),
    date: ddmmyyyy(new Date()),
    incoming: inc ? `${rub(inc.amount)} от «${inc.counterparty}» ${when(inc.ts)}` : '—',
    outgoing: out ? `${rub(out.amount)} на «${out.counterparty}» ${when(out.ts)}` : '—',
    timeline: timeline || '—',
  }
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m) + attachments(acc)
}

// ---------- Копилка ----------
export function createGoal(acc: Account, title: string, target: number): Goal {
  const goal = { id: uid(6), title, target, saved: 0 }
  acc.goals.push(goal)
  return goal
}

export function deposit(acc: Account, goalId: string, amount: number): { message: string; gained: number } {
  const goal = acc.goals.find((g) => g.id === goalId)
  if (!goal) throw new Error('Нет такой цели')
  if (amount > bank.available(acc)) throw new Error('Недостаточно средств')
  acc.persona.balance -= amount
  goal.saved += amount
  const gained = awardAction(acc, 'first_goal_deposit')
  const left = Math.max(goal.target - goal.saved, 0)
  let message = `В копилке «${goal.title}» ${rub(goal.saved)}`
  message += left === 0 ? ' — цель достигнута!' : `, осталось ${rub(left)}`
  if (gained) message += ` · +${gained} XP`
  return { message, gained }
}

// ---------- Мост «Детский банк» → «Старт» ----------
export function migrateBridge(acc: Account): { message: string; stories: number; gained: number } {
  if (acc.persona.segment !== 'kids') throw new Error('Аккаунт уже в «Старте»')
  acc.persona.segment = 'start'
  acc.persona.age = Math.max(acc.persona.age, 14)
  const gained = awardAction(acc, 'bridge')
  return {
    message: 'Добро пожаловать в «Старт»! Цели, копилка и опыт сохранены, карта теперь оформлена на вас.',
    stories: acc.done.filter((k) => k.startsWith('lesson:')).length,
    gained,
  }
}

// ---------- «Пушкинская карта» → «Старт» ----------
// Офферы витрины. «Молодёжь Плюс» (Яндекс Плюс, −50% на связь ВТБ Мобайл) — условия ВТБ с FINOPOLIS 2025
export const PUSHKIN_OFFERS = [
  'Карта «Старт» бесплатно: обслуживание и переводы без комиссии',
  'Яндекс Плюс — бесплатно в «Молодёжь Плюс»',
  '−50% на мобильную связь ВТБ Мобайл',
  'Копилка на накопительном счёте для 14–25 лет',
  'Защита от вербовки в дропы и «Безопасный выход»',
]

export function activatePushkin(acc: Account): { message: string; gained: number } {
  if (acc.persona.segment !== 'pushkin') throw new Error('Карта «Старт» уже оформлена')
  acc.persona.segment = 'start'
  const gained = awardAction(acc, 'pushkin_start')
  return { message: 'Карта «Старт» оформлена. «Пушкинская карта» остаётся в приложении рядом.', gained }
}
