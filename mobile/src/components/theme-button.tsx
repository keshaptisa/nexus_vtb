// Переключатель темы: системная → светлая → тёмная. Иконка поворачивается с пружиной.
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useApp, type ThemePref } from '@/store/app-store'
import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { EASE_EMPHASIS } from '@/theme/motion'

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemePref, string> = { system: 'Тема как в системе', light: 'Светлая тема', dark: 'Тёмная тема' }

export function ThemeButton() {
  const { c, isDark } = useTheme()
  const pref = useApp((s) => s.theme)
  const turn = useSharedValue(0)
  useEffect(() => {
    turn.set(withTiming(isDark ? 1 : 0, { duration: 300, easing: EASE_EMPHASIS }))
  }, [isDark, turn])
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }))
  return (
    <PressableScale
      haptic
      accessibilityLabel={LABEL[pref]}
      onPress={() => {
        const next = NEXT[pref]
        useApp.getState().setTheme(next)
        useUi.getState().notify(LABEL[next])
      }}
      style={[styles.button, { backgroundColor: c.surface }]}
    >
      <Animated.View style={style}>
        <Icon name={isDark ? 'moon' : 'sun'} size={19} color={c.ink} />
      </Animated.View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
})
