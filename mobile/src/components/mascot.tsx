// Бит — маскот помощника: скруглённый квадрат с глазами (как на сайте). Моргает раз в несколько секунд.
import { useEffect, useId } from 'react'
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

export function Mascot({ size = 44, mood = 'calm' }: { size?: number; mood?: 'calm' | 'alert' }) {
  const reduce = useReducedMotion()
  const blink = useSharedValue(1)
  useEffect(() => {
    if (reduce) return
    blink.set(
      withRepeat(
        withSequence(withDelay(3200, withTiming(0.1, { duration: 90 })), withTiming(1, { duration: 120 })),
        -1,
        false,
      ),
    )
  }, [blink, reduce])
  const eye = useAnimatedProps(() => ({ ry: 5 * blink.get() }))
  const id = `m-${mood}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={mood === 'alert' ? '#ff6b5a' : '#5b3df5'} />
          <Stop offset="1" stopColor={mood === 'alert' ? '#ff5fa2' : '#3cc3f0'} />
        </LinearGradient>
      </Defs>
      <Rect x="2" y="4" width="44" height="40" rx="16" fill={`url(#${id})`} />
      <Rect x="21" y="0" width="6" height="7" rx="3" fill="#c8f135" />
      <AnimatedEllipse cx="17" cy="22" rx="4" fill="white" animatedProps={eye} />
      <AnimatedEllipse cx="31" cy="22" rx="4" fill="white" animatedProps={eye} />
      <Circle cx="18" cy="23" r="2" fill="#16171d" />
      <Circle cx="32" cy="23" r="2" fill="#16171d" />
      <Path
        d={mood === 'alert' ? 'M18 34h12' : 'M18 32c3 3 9 3 12 0'}
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}
