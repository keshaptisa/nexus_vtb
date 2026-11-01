// Дизайн-токены «Старта» — те же, что у сайта (frontend/src/index.css).
// Собственный стиль раздела: логотипы и фирменные цвета банков не используем.

export const palette = {
  brand: '#5b3df5',
  brandDeep: '#4a2ee0',
  violet: '#8b3df5',
  lime: '#c8f135',
  coral: '#ff6b5a',
  sky: '#3cc3f0',
  pink: '#ff5fa2',
  orange: '#ff9f43',
  riskHigh: '#f0443a',
  riskMedium: '#f5a524',
  riskLow: '#22b07d',
  ink: '#16171d',
  white: '#ffffff',
} as const

export const light = {
  ...palette,
  page: '#f3f4f7',
  surface: '#ffffff',
  surface2: '#f7f7fa',
  ink: '#16171d',
  muted: '#6b6f7d',
  line: '#e7e8ee',
  night: '#16171d',
  ok: '#137a55',
  bubble: '#dcf8c6',
  chat: '#eef1f5',
  brandSoft: '#eeeaff',
  dangerSoft: '#fdecea',
  overlay: 'rgba(14, 15, 20, 0.45)',
  shadow: '#16171d',
}

export type Colors = Record<keyof typeof light, string>

export const dark: Colors = {
  ...light,
  page: '#0e0f14',
  surface: '#191a22',
  surface2: '#20212b',
  ink: '#eceef5',
  muted: '#a0a4b4',
  line: '#2c2e3a',
  night: '#2b2d3b',
  ok: '#5bd6a0',
  bubble: '#1f4a37',
  chat: '#111218',
  brandSoft: '#262046',
  dangerSoft: '#3a1d1f',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
}

export const gradients = {
  brand: ['#5b3df5', '#8b3df5', '#ff5fa2'] as const,
  logo: ['#5b3df5', '#ff5fa2'] as const,
  danger: ['#f0443a', '#ff5fa2'] as const,
  good: ['#22b07d', '#3cc3f0'] as const,
  lime: ['#c8f135', '#3cc3f0'] as const,
  night: ['#1e1650', '#5b3df5'] as const,
}

// Градиент аватарки у каждого героя — как на сайте
export const avatarGradient: Record<string, readonly [string, string]> = {
  artem: ['#5b3df5', '#3cc3f0'],
  dima: ['#ff6b5a', '#ff5fa2'],
  katya: ['#22b07d', '#c8f135'],
  sonya: ['#ff9f43', '#ff5fa2'],
  lev: ['#16171d', '#5b3df5'],
}

// Фон карточки героя в комикс-стиле (scn-* на сайте)
export const personaTint: Record<string, { light: string; dark: string }> = {
  artem: { light: '#ece7ff', dark: '#272048' },
  dima: { light: '#ffe1dc', dark: '#3a2228' },
  katya: { light: '#eaf8cf', dark: '#22301d' },
  sonya: { light: '#ffe6cf', dark: '#3a2a1d' },
  lev: { light: '#dcf1ff', dark: '#1b2c40' },
}

export const radius = { xs: 10, sm: 14, md: 18, lg: 24, xl: 28, xxl: 34, pill: 999 } as const
export const space = (n: number) => n * 4

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  display: 'Unbounded_800ExtraBold',
  displaySemi: 'Unbounded_600SemiBold',
} as const

export const riskColor = { low: palette.riskLow, medium: palette.riskMedium, high: palette.riskHigh } as const
export const riskLabel = { low: 'Низкий', medium: 'Средний', high: 'Высокий' } as const

export const CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  food: { label: 'Еда', color: '#ff9f43', icon: 'food' },
  clothes: { label: 'Одежда', color: '#ff5fa2', icon: 'shirt' },
  subscriptions: { label: 'Подписки', color: '#5b3df5', icon: 'music' },
  fun: { label: 'Развлечения', color: '#3cc3f0', icon: 'film' },
  transfers: { label: 'Переводы', color: '#22b07d', icon: 'user' },
  other: { label: 'Остальное', color: '#b7bccb', icon: 'card' },
}
