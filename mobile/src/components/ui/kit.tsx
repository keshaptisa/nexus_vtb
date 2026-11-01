// Базовые элементы: кнопки, карточки, чипы, полоски прогресса, иконка в плашке.
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { fonts, gradients, radius } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

import { Icon } from './icon'
import { PressableScale } from './pressable-scale'
import { T } from './text'
import { EASE_EMPHASIS } from '@/theme/motion'

type ButtonKind = 'primary' | 'ghost' | 'danger' | 'light' | 'lime' | 'outline' | 'gradient'

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string
  onPress?: () => void
  kind?: ButtonKind
  icon?: string
  disabled?: boolean
  loading?: boolean
  small?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { c } = useTheme()
  const bg: Record<ButtonKind, string> = {
    primary: c.brand,
    ghost: c.page,
    danger: c.riskHigh,
    light: '#ffffff',
    lime: c.lime,
    outline: 'transparent',
    gradient: 'transparent',
  }
  const fg: Record<ButtonKind, string> = {
    primary: '#ffffff',
    ghost: c.ink,
    danger: '#ffffff',
    light: '#16171d',
    lime: '#16171d',
    outline: c.brand,
    gradient: '#ffffff',
  }
  const body = (
    <>
      {loading ? <ActivityIndicator color={fg[kind]} /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg[kind]} /> : null}
      <T variant="title" color={fg[kind]} style={[small && { fontSize: 14 }]} numberOfLines={1}>
        {title}
      </T>
    </>
  )
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      style={[
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg[kind] },
        kind === 'outline' && { borderWidth: 1.5, borderColor: alpha(c.brand, 0.35) },
        kind === 'gradient' && { overflow: 'hidden' },
        style,
      ]}
    >
      {kind === 'gradient' ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {body}
    </PressableScale>
  )
}

export function TextButton({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  const { c } = useTheme()
  return (
    <PressableScale onPress={onPress} style={styles.textButton}>
      <T variant="bodyStrong" color={color ?? c.muted} center>
        {title}
      </T>
    </PressableScale>
  )
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, isDark } = useTheme()
  const base = [
    styles.card,
    { backgroundColor: c.surface, shadowColor: c.shadow, shadowOpacity: isDark ? 0.35 : 0.06 },
    style,
  ]
  if (onPress)
    return (
      <PressableScale onPress={onPress} style={base}>
        {children}
      </PressableScale>
    )
  return <View style={base}>{children}</View>
}

/** Иконка в цветной плашке */
export function IconTile({ name, color, bg, size = 44, iconSize }: { name: string; color: string; bg: string; size?: number; iconSize?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: bg }]}>
      <Icon name={name} size={iconSize ?? size * 0.46} color={color} />
    </View>
  )
}

export function Chip({ label, active, onPress, tone }: { label: string; active?: boolean; onPress?: () => void; tone?: string }) {
  const { c } = useTheme()
  const color = tone ?? c.brand
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        { borderColor: active ? color : c.line, backgroundColor: active ? alpha(color, 0.12) : c.surface },
      ]}
    >
      <T variant="small" color={active ? color : c.ink} style={{ fontFamily: fonts.semibold }}>
        {label}
      </T>
    </PressableScale>
  )
}

/** Полоска прогресса с пружиной */
export function Progress({ value, color, track, height = 8, gradient }: { value: number; color?: string; track?: string; height?: number; gradient?: readonly [string, string, ...string[]] }) {
  const { c } = useTheme()
  const w = useSharedValue(0)
  useEffect(() => {
    w.set(withTiming(Math.max(0, Math.min(1, value)), { duration: 600, easing: EASE_EMPHASIS }))
  }, [value, w])
  const style = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }))
  return (
    <View style={[styles.track, { height, borderRadius: height, backgroundColor: track ?? c.page }]}>
      <Animated.View style={[styles.fill, { borderRadius: height, backgroundColor: gradient ? undefined : color ?? c.brand }, style]}>
        {gradient ? <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      </Animated.View>
    </View>
  )
}

/** Появление с прозрачностью — для подсказок «ждём действия» */
export function Pulse({ color }: { color: string }) {
  const s = useSharedValue(0)
  useEffect(() => {
    s.set(withRepeat(withTiming(1, { duration: 1200 }), -1, false))
  }, [s])
  const ring = useAnimatedStyle(() => ({ opacity: 1 - s.get(), transform: [{ scale: 1 + s.get() * 1.6 }] }))
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: color }, ring]} />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  )
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme()
  return (
    <View style={styles.sectionHeader}>
      <T variant="h3">{title}</T>
      {action && onAction ? (
        <PressableScale onPress={onAction} style={styles.sectionAction}>
          <T variant="small" color={c.brand} style={{ fontFamily: fonts.bold }}>
            {action}
          </T>
          <Icon name="chevron" size={14} color={c.brand} strokeWidth={2.4} />
        </PressableScale>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSmall: { minHeight: 40, borderRadius: radius.sm, paddingHorizontal: 14 },
  textButton: { paddingVertical: 12, alignItems: 'center' },
  card: {
    borderRadius: radius.xl,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 3,
  },
  tile: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%', overflow: 'hidden' },
  pulseWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6 },
})
