// Нажатие: элемент сжимается до 0.96 за 150 мс (ease-out) и возвращается так же — без пружины.
// Неактивная кнопка не сжимается. Анимирован сам Pressable, поэтому размеры из style работают как у View.
import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'

import { EASE_OUT, PRESS_MS, PRESS_SCALE } from '@/theme/motion'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const TIMING = { duration: PRESS_MS, easing: EASE_OUT }

export function PressableScale({
  children,
  style,
  haptic = false,
  disabled,
  onPress,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  haptic?: boolean
}) {
  const reduce = useReducedMotion()
  const pressed = useSharedValue(0)
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * (1 - PRESS_SCALE) }],
  }))

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      onPressIn={(e) => {
        if (!reduce && !disabled) pressed.set(withTiming(1, TIMING))
        rest.onPressIn?.(e)
      }}
      onPressOut={(e) => {
        pressed.set(withTiming(0, TIMING))
        rest.onPressOut?.(e)
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {})
        onPress?.(e)
      }}
      style={[style, animated, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressable>
  )
}
