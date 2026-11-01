// Фейковый банк: счёт персонажа и операции. Порт backend/app/services/bank.py.
// Функции меняют переданный объект счёта — стор передаёт сюда копию и сохраняет результат.
import { RAW_PERSONAS, type RawHistory } from './content'
import { uid } from './format'
import { scoreIncoming } from './risk'
import type { Account, Transaction } from './types'

// Категория трат по названию магазина — для истории из personas.json, где её нет
const CATEGORY_BY_NAME: Record<string, string> = {
  'Доставка еды': 'food', 'Кофейня': 'food', 'Кофейня у школы': 'food', 'Продукты': 'food', 'Столовая': 'food',
  'Одежда': 'clothes', 'Магазин одежды': 'clothes', 'Магазин кроссовок': 'clothes',
  'Кино': 'fun', 'Кинотеатр': 'fun', 'Игровой магазин': 'fun',
  'Музыкальный сервис': 'subscriptions', 'Онлайн-кинотеатр': 'subscriptions', 'Подписка на музыку': 'subscriptions',
}

/** Категория траты: переводы по СБП — «Переводы», покупки — по названию магазина */
export function guessCategory(counterparty: string, channel: string): string {
  if (channel === 'sbp') return 'transfers'
  return CATEGORY_BY_NAME[counterparty] ?? 'other'
}

function categoryOfRaw(h: RawHistory): string | null {
  if (h.category) return h.category
  if (h.direction !== 'out') return null
  if ((h.channel ?? 'sbp') === 'sbp') return 'transfers'
  return CATEGORY_BY_NAME[h.counterparty] ?? 'other'
}

export function newAccount(personaId: string, now = new Date()): Account {
  const raw = RAW_PERSONAS[personaId]
  if (!raw) throw new Error(`Нет персонажа ${personaId}`)
  const transactions: Transaction[] = (raw.history ?? []).map((h) => ({
    id: uid(8),
    ts: new Date(now.getTime() - (h.days_ago ?? 1) * 86_400_000).toISOString(),
    amount: h.amount,
    direction: h.direction,
    counterparty: h.counterparty,
    is_new_counterparty: false,
    channel: h.channel ?? 'sbp',
    category: categoryOfRaw(h),
    frozen: false,
    flagged: false,
  }))
  transactions.sort((a, b) => a.ts.localeCompare(b.ts))
  return {
    persona: {
      id: raw.id,
      name: raw.name,
      age: raw.age,
      segment: raw.segment ?? 'start',
      pushkin_balance: raw.pushkin_balance ?? null,
      balance: raw.balance,
      description: raw.description,
    },
    transactions,
    outgoingPausedUntil: null,
    xp: raw.xp ?? 0, // опыт из «Детского банка» — переносится мостом
    done: [...(raw.done ?? [])],
    lastIntercept: null,
    goals: (raw.goals ?? []).map((g) => ({ id: uid(6), ...g })),
    evidence: {},
  }
}

export function knownCounterparties(acc: Account): Set<string> {
  return new Set(acc.transactions.map((t) => t.counterparty))
}

export function incoming(
  acc: Account,
  amount: number,
  counterparty: string,
  isNew: boolean,
  flagged?: boolean,
  channel = 'sbp',
  now = new Date(),
): Transaction {
  // Сценарные зачисления проходят через ту же проверку, что и ручное «Пополнить»
  const isFlagged = flagged ?? scoreIncoming(acc, amount, counterparty, isNew, now).level !== 'low'
  const tx: Transaction = {
    id: uid(8),
    ts: now.toISOString(),
    amount,
    direction: 'in',
    counterparty,
    is_new_counterparty: isNew,
    channel,
    category: null,
    frozen: false,
    flagged: isFlagged,
  }
  acc.transactions.push(tx)
  acc.persona.balance += amount
  return tx
}

export function outgoing(
  acc: Account,
  amount: number,
  to: string,
  channel = 'sbp',
  category: string | null = 'transfers',
  now = new Date(),
): Transaction {
  const tx: Transaction = {
    id: uid(8),
    ts: now.toISOString(),
    amount,
    direction: 'out',
    counterparty: to,
    is_new_counterparty: !knownCounterparties(acc).has(to),
    channel,
    category,
    frozen: false,
    flagged: false,
  }
  acc.transactions.push(tx)
  acc.persona.balance -= amount
  return tx
}

export function freeze(acc: Account, operationId: string): Transaction | null {
  const tx = acc.transactions.find((t) => t.id === operationId && t.direction === 'in')
  if (!tx) return null
  tx.frozen = true
  return tx
}

/** Последнее подозрительное зачисление, которое ещё можно вернуть через банк */
export function suspiciousIncoming(acc: Account): Transaction | null {
  for (let i = acc.transactions.length - 1; i >= 0; i--) {
    const t = acc.transactions[i]
    if (t.direction === 'in' && (t.flagged || t.is_new_counterparty) && !t.frozen) return t
  }
  return null
}

/** Баланс без замороженных сумм — их тратить нельзя */
export function available(acc: Account): number {
  const frozen = acc.transactions.filter((t) => t.frozen).reduce((s, t) => s + t.amount, 0)
  return acc.persona.balance - frozen
}
