// Знак раздела «Старт»: стрелка вверх в скруглённом квадрате с градиентом (как favicon сайта),
// и анимированная заставка при запуске.
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useId } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg'

import { fonts, gradients } from '@/theme/tokens'

import { T } from './ui/text'
import { EASE_OUT, EASE_EMPHASIS } from '@/theme/motion'

const ARROW = 'M12 19V5M6 11l6-6 6 6'
const ARROW_LEN = 32 // длина пути стрелки в единицах viewBox 24×24 (14 + 2 × 8,5)

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Статичный знак */
export function LogoMark({ size = 36 }: { size?: number }) {
  const id = `logo-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gradients.logo[0]} />
          <Stop offset="1" stopColor={gradients.logo[1]} />
        </SvgGradient>
      </Defs>
      <Rect width="36" height="36" rx="12" fill={`url(#${id})`} />
      <Path d={ARROW} transform="translate(9 9) scale(0.75)" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  )
}

export function Logo({ size = 34, color }: { size?: number; color?: string }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <T variant="h3" color={color} style={{ fontFamily: fonts.extrabold, fontSize: size * 0.58 }}>
        Старт
      </T>
    </View>
  )
}

const LETTERS = ['С', 'т', 'а', 'р', 'т']

function Letter({ ch, index, progress }: { ch: string; index: number; progress: { get: () => number } }) {
  const style = useAnimatedStyle(() => {
    const p = interpolate(progress.get(), [index * 0.12, index * 0.12 + 0.4], [0, 1], 'clamp')
    return { opacity: p, transform: [{ translateY: (1 - p) * 12 }] }
  })
  return (
    <Animated.Text style={[styles.letter, style]} allowFontScaling={false}>
      {ch}
    </Animated.Text>
  )
}

/** Заставка при запуске: знак влетает с пружиной, стрелка рисуется и «взлетает», буквы появляются по одной */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const mark = useSharedValue(0)
  const draw = useSharedValue(0)
  const lift = useSharedValue(0)
  const word = useSharedValue(0)
  const out = useSharedValue(0)

  useEffect(() => {
    if (reduce) {
      mark.set(1)
      draw.set(1)
      word.set(1)
      out.set(withDelay(500, withTiming(1, { duration: 300 }, (f) => f && scheduleOnRN(onDone))))
      return
    }
    mark.set(withTiming(1, { duration: 700, easing: EASE_EMPHASIS }))
    draw.set(withDelay(250, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })))
    lift.set(withDelay(900, withSequence(withTiming(1, { duration: 220, easing: EASE_OUT }), withTiming(0, { duration: 320, easing: EASE_EMPHASIS }))))
    word.set(withDelay(700, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })))
    out.set(withDelay(2100, withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }, (f) => f && scheduleOnRN(onDone))))
  }, [draw, lift, mark, onDone, out, reduce, word])

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mark.get(), [0, 0.3], [0, 1], 'clamp'),
    transform: [
      { scale: interpolate(mark.get(), [0, 1], [0.35, 1]) },
      { rotate: `${interpolate(mark.get(), [0, 1], [-8, 0])}deg` },
    ],
  }))
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.get() * 8 }] }))
  const arrowProps = useAnimatedProps(() => ({ strokeDashoffset: ARROW_LEN * (1 - draw.get()) }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(draw.get(), [0.6, 1], [0, 0.55], 'clamp') * (1 - out.get()),
    transform: [{ scale: interpolate(word.get(), [0, 1], [0.6, 1.25]) }],
  }))
  const tagStyle = useAnimatedStyle(() => ({ opacity: interpolate(word.get(), [0.6, 1], [0, 1], 'clamp') }))
  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - out.get(),
    transform: [{ scale: 1 + out.get() * 0.08 }],
  }))

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.splash, rootStyle]} pointerEvents="none">
      <LinearGradient colors={['#120b2e', '#2b1a6b', '#5b3df5']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.glow, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="splash-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#ff5fa2" stopOpacity="0.9" />
              <Stop offset="0.45" stopColor="#8b3df5" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#5b3df5" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#splash-glow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.mark, markStyle]}>
        <LinearGradient colors={gradients.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={arrowStyle}>
          <Svg width={64} height={64} viewBox="0 0 24 24">
            <AnimatedPath
              d={ARROW}
              stroke="#fff"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[ARROW_LEN, ARROW_LEN]}
              animatedProps={arrowProps}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
      <View style={styles.word}>
        {LETTERS.map((ch, i) => (
          <Letter key={i} ch={ch} index={i} progress={word} />
        ))}
      </View>
      <Animated.View style={tagStyle}>
        <T variant="bodyStrong" color="rgba(255,255,255,0.75)" center>
          Раздел для 14–22 лет
        </T>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splash: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  glow: { position: 'absolute', width: 420, height: 420 },
  mark: {
    width: 112,
    height: 112,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff5fa2',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  word: { flexDirection: 'row', marginTop: 28, marginBottom: 8 },
  letter: { fontFamily: fonts.display, fontSize: 46, color: '#ffffff', letterSpacing: 1 },
})
