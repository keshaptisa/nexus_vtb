import { useColorScheme } from 'react-native'

import { useApp } from '@/store/app-store'

import { dark, light, type Colors } from './tokens'

export function useTheme(): { c: Colors; isDark: boolean } {
  const pref = useApp((s) => s.theme)
  const system = useColorScheme()
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark'
  return { c: isDark ? dark : light, isDark }
}

/** Цвет с прозрачностью: alpha('#5b3df5', 0.12) */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Смешать цвет с фоном — замена color-mix() из CSS сайта */
export function mix(hex: string, base: string, amount: number): string {
  const parse = (x: string) => {
    const n = parseInt(x.replace('#', ''), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const [r1, g1, b1] = parse(hex)
  const [r2, g2, b2] = parse(base)
  const m = (a: number, b: number) => Math.round(a * amount + b * (1 - amount))
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`
}
