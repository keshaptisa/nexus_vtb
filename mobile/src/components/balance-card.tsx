// Карта «Старт» на главной: градиент, плавающие пятна, блик пробегает по карте, баланс «досчитывается».
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated'

import { rub } from '@/engine/format'
import type { Persona } from '@/engine/types'
import { fonts, gradients } from '@/theme/tokens'

import { LogoMark } from './logo'
import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'
import { Enter } from '@/components/ui/enter'

/** Число плавно «досчитывается» до нового значения */
export function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = Date.now()
    const a = from.current
    let raf = 0
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration)
      const eased = 1 - (1 - k) ** 3
      setShown(a + (value - a) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return shown
}

export function BalanceCard({
  persona,
  suspicious,
  frozen,
  onPress,
}: {
  persona: Persona
  suspicious: number
  frozen: number
  onPress?: () => void
}) {
  const reduce = useReducedMotion()
  const pushkin = persona.segment === 'pushkin'
  const kids = persona.segment === 'kids'
  const amount = pushkin ? persona.pushkin_balance ?? 0 : persona.balance
  const shown = useCountUp(amount)
  const [width, setWidth] = useState(340)

  const shine = useSharedValue(0)
  const blob = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    shine.set(withRepeat(withSequence(withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })), -1))
    blob.set(withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [blob, reduce, shine])

  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + shine.get() * (width + 320) }, { rotate: '20deg' }] }))
  const blobA = useAnimatedStyle(() => ({ transform: [{ translateX: blob.get() * -18 }, { translateY: blob.get() * 12 }, { scale: 1 + blob.get() * 0.08 }] }))
  const blobB = useAnimatedStyle(() => ({ transform: [{ translateX: blob.get() * 14 }, { translateY: blob.get() * -10 }] }))

  const label = kids ? '«Детский банк» · карта к счёту мамы' : pushkin ? '«Пушкинская карта»' : 'Карта «Старт» · •• 4821'
  const colors = pushkin ? (['#ff9f43', '#ff5fa2', '#8b3df5'] as const) : kids ? (['#3cc3f0', '#5b3df5', '#ff9f43'] as const) : gradients.brand

  return (
    <PressableScale onPress={onPress} style={styles.shadow}>
      <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1.1, y: 1.2 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.blob, styles.blobA, blobA]} />
        <Animated.View style={[styles.blob, styles.blobB, blobB]} />
        <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.top}>
          <T variant="small" color="rgba(255,255,255,0.8)" style={{ flex: 1 }} numberOfLines={1}>
            {label}
          </T>
          <LogoMark size={30} />
        </View>
        <T style={styles.amount}>{rub(shown)}</T>
        {pushkin ? (
          <T variant="small" color="rgba(255,255,255,0.8)">
            на театр, кино и концерты
          </T>
        ) : null}

        {suspicious > 0 || frozen > 0 ? (
          <View style={styles.flags}>
            {suspicious > 0 ? (
              <Enter kind="fade" style={styles.flag}>
                <Icon name="alert" size={16} color="#fff" />
                <T variant="small" color="#fff" style={{ fontFamily: fonts.semibold, flex: 1 }}>
                  {rub(suspicious)} под проверкой — не переводите
                </T>
              </Enter>
            ) : null}
            {frozen > 0 ? (
              <Enter kind="fade" style={styles.flag}>
                <Icon name="lock" size={16} color="#fff" />
                <T variant="small" color="#fff" style={{ fontFamily: fonts.semibold, flex: 1 }}>
                  {rub(frozen)} заморожено, вернётся отправителю
                </T>
              </Enter>
            ) : null}
          </View>
        ) : (
          <View style={styles.chipRow}>
            <View style={styles.cardChip}>
              <View style={styles.chipLine} />
              <View style={[styles.chipLine, { width: 14 }]} />
            </View>
            <T variant="caption" color="rgba(255,255,255,0.7)" style={{ fontFamily: fonts.semibold, letterSpacing: 2 }}>
              {persona.name.toUpperCase()}
            </T>
          </View>
        )}
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 28,
    shadowColor: '#5b3df5',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  card: { borderRadius: 28, padding: 22, overflow: 'hidden', minHeight: 196 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: { width: 190, height: 190, right: -50, top: -70, backgroundColor: 'rgba(255,255,255,0.12)' },
  blobB: { width: 150, height: 150, right: 40, bottom: -80, backgroundColor: 'rgba(200,241,53,0.22)' },
  shine: { position: 'absolute', top: -60, bottom: -60, width: 110 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 48, letterSpacing: -1.2, color: '#fff', marginTop: 14, fontVariant: ['tabular-nums'] },
  flags: { marginTop: 14, gap: 8 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26 },
  cardChip: { width: 42, height: 30, borderRadius: 7, backgroundColor: 'rgba(255,228,138,0.85)', justifyContent: 'center', paddingHorizontal: 6, gap: 4 },
  chipLine: { height: 2, width: 22, borderRadius: 1, backgroundColor: 'rgba(120,80,0,0.45)' },
})
