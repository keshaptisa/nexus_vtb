// Форматирование сумм, дат и слов. Без Intl в горячих местах: на Android он есть не везде целиком.

const NBSP = ' '

/** 30000 → «30 000 ₽» */
export function rub(x: number): string {
  const n = Math.round(x)
  const sign = n < 0 ? '−' : ''
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${sign}${digits}${NBSP}₽`
}

/** «в 20 раз», «в 2,5 раза», «в 3 раза» — как в backend/app/services/risk.py */
export function times(x: number): string {
  const n = x >= 3 ? Math.round(x) : Math.round(x * 10) / 10
  if (!Number.isInteger(n)) return `в ${String(n).replace('.', ',')} раза`
  const word = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'раза' : 'раз'
  return `в ${n} ${word}`
}

/** Склонение: plural(3, ['сигнал', 'сигнала', 'сигналов']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const pad = (n: number) => String(n).padStart(2, '0')

export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const ddmm = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
export const ddmmyyyy = (d: Date) => `${ddmm(d)}.${d.getFullYear()}`

/** «Сегодня, 14:05», «Вчера, 09:12», «12 октября» */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (diff === 0) return `Сегодня, ${hhmm(d)}`
  if (diff === 1) return `Вчера, ${hhmm(d)}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Заголовок группы в истории операций */
export function dayTitle(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
}

/** Короткий случайный id, как uuid4().hex[:n] на бэкенде */
export function uid(n = 8): string {
  let s = ''
  while (s.length < n) s += Math.random().toString(16).slice(2)
  return s.slice(0, n)
}
