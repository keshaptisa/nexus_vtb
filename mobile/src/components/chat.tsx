// Элементы переписки: пузыри, «печатает…», шапка чата. Общие для мессенджера сценария, квеста и Бита.
import { router } from 'expo-router'
import { useEffect, type ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'
import { Enter } from '@/components/ui/enter'

function Dot({ delay }: { delay: number }) {
  const { c } = useTheme()
  const y = useSharedValue(0)
  useEffect(() => {
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1)))
  }, [delay, y])
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }))
  return <Animated.View style={[styles.dot, { backgroundColor: c.muted }, style]} />
}

export function TypingDots() {
  const { c } = useTheme()
  return (
    <Enter kind="fade" style={[styles.typing, { backgroundColor: c.surface }]}>
      <Dot delay={0} />
      <Dot delay={120} />
      <Dot delay={240} />
    </Enter>
  )
}

export function Bubble({ mine, children, tint }: { mine?: boolean; children: ReactNode; tint?: string }) {
  const { c } = useTheme()
  return (
    <Enter style={[styles.row, mine && { justifyContent: 'flex-end' }]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: tint ?? c.bubble, borderBottomRightRadius: 6 }
            : { backgroundColor: c.surface, borderBottomLeftRadius: 6, shadowColor: c.shadow },
        ]}
      >
        {typeof children === 'string' ? (
          <T variant="body" color={tint ? '#fff' : c.ink}>
            {children}
          </T>
        ) : (
          children
        )}
      </View>
    </Enter>
  )
}

export function SystemLine({ children }: { children: string }) {
  return (
    <Enter>
      <T variant="caption" muted center style={{ fontFamily: 'Manrope_600SemiBold', marginVertical: 4 }}>
        {children}
      </T>
    </Enter>
  )
}

export function ChatHeader({ title, subtitle, avatar, onClose }: { title: string; subtitle: string; avatar: ReactNode; onClose?: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: (Platform.OS === 'ios' ? 12 : insets.top + 6), backgroundColor: c.surface, borderBottomColor: c.line }]}>
      {avatar}
      <View style={{ flex: 1 }}>
        <T variant="title">{title}</T>
        <T variant="caption" muted>
          {subtitle}
        </T>
      </View>
      <PressableScale onPress={onClose ?? (() => router.back())} style={[styles.close, { backgroundColor: c.page }]} accessibilityLabel="Закрыть">
        <Icon name="close" size={18} color={c.ink} strokeWidth={2.2} />
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, opacity: 0.6 },
  typing: { flexDirection: 'row', gap: 5, alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  row: { flexDirection: 'row' },
  bubble: {
    maxWidth: '84%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
})
