// Награда за XP: значок «+50 XP» выпрыгивает с пружиной, вокруг разлетается конфетти.
import * as Haptics from 'expo-haptics'
import { useEffect, useMemo } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useUi } from '@/store/ui-store'
import { fonts, palette } from '@/theme/tokens'

import { Icon } from './ui/icon'
import { T } from './ui/text'
import { EASE_EMPHASIS } from '@/theme/motion'

const COLORS = [palette.brand, palette.pink, palette.lime, palette.sky, palette.orange, palette.coral]
const COUNT = 28

export function Celebrate() {
  const celebrate = useUi((s) => s.celebrate)
  if (!celebrate) return null
  return <Burst key={celebrate.id} xp={celebrate.xp} />
}

function Burst({ xp }: { xp: number }) {
  const reduce = useReducedMotion()
  const t = useSharedValue(0)
  const badge = useSharedValue(0)
  const fade = useSharedValue(1)

  // Каждой частице — свой угол, скорость, размер и вращение (детерминированно от номера)
  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2 + ((i * 37) % 10) / 10
        const speed = 160 + ((i * 53) % 120)
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed - 120,
          size: 6 + ((i * 7) % 7),
          spin: ((i % 2 ? 1 : -1) * (180 + ((i * 29) % 360))),
          color: COLORS[i % COLORS.length],
          round: i % 3 === 0,
        }
      }),
    [],
  )

  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    badge.set(withTiming(1, { duration: 300, easing: EASE_EMPHASIS }))
    if (!reduce) t.set(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }))
    fade.set(
      withDelay(
        1500,
        withTiming(0, { duration: 350 }, (f) => {
          if (f) scheduleOnRN(() => useUi.setState({ celebrate: null }))
        }),
      ),
    )
  }, [badge, fade, reduce, t])

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ scale: interpolate(badge.get(), [0, 1], [0.9, 1]) }, { translateY: interpolate(badge.get(), [0, 1], [12, 0]) }],
  }))

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {parts.map((p, i) => (
        <Particle key={i} p={p} t={t} fade={fade} />
      ))}
      <Animated.View style={[styles.badge, badgeStyle]}>
        <View style={styles.star}>
          <Icon name="star" size={26} color="#16171d" strokeWidth={2.4} />
        </View>
        <T style={styles.xp}>+{xp} XP</T>
      </Animated.View>
    </View>
  )
}

function Particle({
  p,
  t,
  fade,
}: {
  p: { dx: number; dy: number; size: number; spin: number; color: string; round: boolean }
  t: SharedValue<number>
  fade: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const k = t.get()
    // Парабола: разлёт плюс «гравитация»
    return {
      opacity: fade.get() * (k > 0 ? 1 : 0),
      transform: [
        { translateX: p.dx * k },
        { translateY: p.dy * k + 260 * k * k },
        { rotate: `${p.spin * k}deg` },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        styles.particle,
        { width: p.size, height: p.round ? p.size : p.size * 1.8, borderRadius: p.round ? p.size : 2, backgroundColor: p.color },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 950 },
  particle: { position: 'absolute' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#16171d',
    paddingLeft: 8,
    paddingRight: 20,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: palette.lime,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  star: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  xp: { fontFamily: fonts.display, fontSize: 26, color: '#ffffff' },
})

