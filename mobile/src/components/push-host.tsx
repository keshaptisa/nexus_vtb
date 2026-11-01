// Пуш сверху экрана — как уведомление от банка, мессенджера или Бита. Падает с пружиной, смахивается вверх.
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { useUi, type PushData } from '@/store/ui-store'
import { fonts } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

import { LogoMark } from './logo'
import { Mascot } from './mascot'
import { Icon } from './ui/icon'
import { T } from './ui/text'
import { EASE_OUT, EASE_EMPHASIS } from '@/theme/motion'

const SHOW_MS = 4800
const APP_NAME = { bank: 'Старт', chat: 'Мессенджер', bit: 'Бит' } as const

export function PushHost() {
  const push = useUi((s) => s.push)
  if (!push) return null
  return <Banner key={push.id} push={push} />
}

function Banner({ push }: { push: PushData }) {
  const { c, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const y = useSharedValue(-160)
  const drag = useSharedValue(0)
  const hide = useUi((s) => s.hidePush)

  useEffect(() => {
    y.set(withTiming(0, { duration: 320, easing: EASE_EMPHASIS }))
    const t = setTimeout(() => y.set(withTiming(-160, { duration: 260 }, (f) => f && scheduleOnRN(hide))), SHOW_MS)
    return () => clearTimeout(t)
  }, [hide, y])

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet'
      drag.set(Math.min(e.translationY, 24))
    },
    onDeactivate: (e) => {
      'worklet'
      if (e.translationY < -30) y.set(withTiming(-200, { duration: 200 }, (f) => f && scheduleOnRN(hide)))
      drag.set(withTiming(0, { duration: 150, easing: EASE_OUT }))
    },
  })

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() + drag.get() }] }))
  const open = () => {
    hide()
    if (push.href) router.push(push.href as never)
  }
  const accent = push.tone === 'danger' ? c.riskHigh : push.tone === 'ok' ? c.riskLow : null
  const app = push.app as keyof typeof APP_NAME

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, { top: insets.top + 6 }, style]}>
        <Pressable onPress={open} style={[styles.card, { shadowColor: c.shadow, borderColor: accent ?? alpha(c.ink, 0.06) }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(c.surface, 0.98) }]} />
          )}
          {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
          <View style={styles.icon}>
            {app === 'bank' ? (
              <LogoMark size={40} />
            ) : app === 'bit' ? (
              <Mascot size={40} />
            ) : (
              <View style={[styles.chatIcon, { backgroundColor: '#2aabee' }]}>
                <Icon name="chat" size={20} color="#fff" strokeWidth={2.2} />
              </View>
            )}
          </View>
          <View style={styles.body}>
            <View style={styles.head}>
              <T variant="caption" muted style={{ fontFamily: fonts.semibold }}>
                {APP_NAME[app] ?? 'Старт'}
              </T>
              <T variant="caption" muted>
                сейчас
              </T>
            </View>
            <T variant="title" numberOfLines={1} color={accent && push.tone === 'danger' ? c.riskHigh : c.ink}>
              {push.title}
            </T>
            <T variant="small" numberOfLines={2} style={{ color: alpha(c.ink, 0.75) }}>
              {push.text}
            </T>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 900, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  icon: { paddingTop: 2 },
  chatIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
})
