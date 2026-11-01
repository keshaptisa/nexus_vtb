import type { ReactNode } from 'react'
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native'

import { fonts } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label' | 'money'

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  money: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 42, letterSpacing: -1, fontVariant: ['tabular-nums'] },
}

export function T({
  variant = 'body',
  color,
  muted,
  center,
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; color?: string; muted?: boolean; center?: boolean; children?: ReactNode }) {
  const { c } = useTheme()
  return (
    <Text
      {...rest}
      style={[VARIANTS[variant], { color: color ?? (muted ? c.muted : c.ink) }, center && styles.center, style]}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } })
