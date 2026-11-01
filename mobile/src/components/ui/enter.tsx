// Появление блока при монтировании. Анимирует только прозрачность и transform обычным анимированным стилем —
// без механизма layout-анимаций Reanimated, который в браузере сбивает раскладку внутри прокрутки.
// up — сдвиг 12px снизу за 300 мс ease-out; fade — только прозрачность за 200 мс;
// icon — смена иконки по месту: рост с 0.25 за 300 мс по кривой (0.2, 0, 0, 1), без отскока.
// При «уменьшении движения» в системе остаётся только прозрачность.
import { useEffect, type ComponentProps, type ReactNode } from 'react'
import type { ViewProps } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

import { EASE_EMPHASIS, EASE_OUT, ENTER_MS, ENTER_Y, ICON_FROM_SCALE } from '@/theme/motion'

type Kind = 'up' | 'fade' | 'icon'

const DURATION: Record<Kind, number> = { up: ENTER_MS, fade: 200, icon: 300 }

export function Enter({
  kind = 'up',
  delay = 0,
  style,
  children,
  ...rest
}: Omit<ViewProps, 'style'> & { kind?: Kind; delay?: number; style?: ComponentProps<typeof Animated.View>['style']; children?: ReactNode }) {
  const reduce = useReducedMotion()
  const p = useSharedValue(0)

  useEffect(() => {
    p.set(withDelay(delay, withTiming(1, { duration: DURATION[kind], easing: kind === 'icon' ? EASE_EMPHASIS : EASE_OUT })))
  }, [delay, kind, p])

  const animated = useAnimatedStyle(() => {
    const v = p.get()
    if (reduce || kind === 'fade') return { opacity: v }
    if (kind === 'icon') return { opacity: v, transform: [{ scale: ICON_FROM_SCALE + (1 - ICON_FROM_SCALE) * v }] }
    return { opacity: v, transform: [{ translateY: (1 - v) * ENTER_Y }] }
  })

  return (
    <Animated.View {...rest} style={[style, animated]}>
      {children}
    </Animated.View>
  )
}
