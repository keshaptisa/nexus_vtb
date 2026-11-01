// Выбор героя: тёмный экран как у заставки и карусель карточек с котиками.
// Активная карточка крупная и яркая, соседние уменьшены и приглушены — всё привязано к прокрутке.
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import { useCallback, useRef, useState, type ComponentRef } from 'react'
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ACCUSATIVE, CatAvatar } from '@/components/cat-avatar'
import { Glow } from '@/components/glow'
import { LogoMark } from '@/components/logo'
import { Icon } from '@/components/ui/icon'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { PERSONA_IDS, PERSONA_TAGS, RAW_PERSONAS, SCENARIOS } from '@/engine/content'
import { enterAs } from '@/store/session'
import { stagger } from '@/theme/motion'
import { fonts, gradients, personaTint } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

const GAP = 14
const SEGMENT: Record<string, string> = { kids: '«Детский банк»', pushkin: 'Без карты «Старт»', start: 'Карта «Старт»' }

function HeroCard({
  id,
  index,
  x,
  step,
  width,
  dark,
  onFocusCard,
}: {
  id: string
  index: number
  x: SharedValue<number>
  step: number
  width: number
  dark: boolean
  onFocusCard: (i: number) => void
}) {
  const p = RAW_PERSONAS[id]
  const scenario = SCENARIOS[id]

  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.get() / step - index)
    return {
      opacity: interpolate(d, [0, 1], [1, 0.5], 'clamp'),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.9], 'clamp') }, { translateY: interpolate(d, [0, 1], [0, 18], 'clamp') }],
    }
  })

  return (
    <Animated.View style={[{ width }, style]}>
      <Pressable onPress={() => onFocusCard(index)} style={[styles.card, { backgroundColor: dark ? '#1b1c27' : '#ffffff' }]}>
        <View style={[styles.cardTop, { backgroundColor: personaTint[id].light }]}>
          <Glow color="#ffffff" size={280} opacity={0.9} style={styles.catGlow} />
          <View style={styles.catWrap}>
            <CatAvatar id={id} size={170} frame="none" />
          </View>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <T variant="caption" color="#16171d" style={{ fontFamily: fonts.bold }}>
                {SEGMENT[p.segment ?? 'start']}
              </T>
            </View>
            <View style={styles.pill}>
              <T variant="caption" color="#16171d" style={{ fontFamily: fonts.bold }}>
                {scenario.steps.length} шагов
              </T>
            </View>
          </View>
        </View>
        <View style={styles.cardBody}>
          <T style={[styles.name, { color: dark ? '#eceef5' : '#16171d' }]}>
            {p.name}, {p.age}
          </T>
          <T variant="small" color={dark ? '#a0a4b4' : '#6b6f7d'} style={{ fontFamily: fonts.semibold }}>
            {PERSONA_TAGS[id]}
          </T>
          <View style={[styles.quote, { backgroundColor: dark ? '#242533' : '#f3f4f7' }]}>
            <T variant="body" color={dark ? '#eceef5' : '#16171d'} numberOfLines={2}>
              {scenario.title}
            </T>
          </View>
          <PressableScale
            haptic
            onPress={() => {
              enterAs(id)
              router.replace('/')
            }}
            style={styles.play}
          >
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <T variant="title" color="#ffffff">
              Играть за {ACCUSATIVE[id]}
            </T>
            <Icon name="send" size={18} color="#ffffff" strokeWidth={2.3} />
          </PressableScale>
        </View>
      </Pressable>
    </Animated.View>
  )
}

function Dot({ index, x, step }: { index: number; x: SharedValue<number>; step: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.get() / step - index)
    return {
      width: interpolate(d, [0, 1], [24, 8], 'clamp'),
      opacity: interpolate(d, [0, 1], [1, 0.4], 'clamp'),
    }
  })
  return <Animated.View style={[styles.dot, style]} />
}

export default function Welcome() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { isDark } = useTheme()
  const cardW = Math.min(width - 72, 340)
  const step = cardW + GAP
  const side = (width - cardW) / 2
  const x = useSharedValue(0)
  const scroller = useRef<ComponentRef<typeof Animated.ScrollView>>(null)
  const [index, setIndex] = useState(0)

  // Экран тёмный в любой теме — значит, статус-бар светлый
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light')
      return () => setStatusBarStyle('auto')
    }, []),
  )

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.set(e.contentOffset.x)
    },
  })

  const focusCard = (i: number) => {
    scroller.current?.scrollTo({ x: i * step, animated: true })
    setIndex(i)
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#120b2e', '#241562', '#4a2ee0']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <Glow color="#ff5fa2" size={520} opacity={0.32} style={{ position: 'absolute', top: -200, right: -220 }} />
      <Glow color="#3cc3f0" size={460} opacity={0.22} style={{ position: 'absolute', bottom: -160, left: -200 }} />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.brand}>
          <LogoMark size={32} />
          <T variant="h3" color="#ffffff" style={{ fontFamily: fonts.extrabold }}>
            Старт
          </T>
        </View>
        <T variant="caption" color={alpha('#ffffff', 0.6)} style={{ fontFamily: fonts.semibold }}>
          Раздел ВТБ Онлайн · 14–22
        </T>
      </View>

      <Enter delay={stagger(0)} style={styles.intro}>
        <T style={styles.title}>Выберите героя</T>
        <T variant="body" color={alpha('#ffffff', 0.72)} center>
          В 14 детский банк заканчивается. Вербовщики — нет. Пройдите историю одного из пятерых.
        </T>
      </Enter>

      <Enter delay={stagger(1)} style={styles.carousel}>
        <Animated.ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / step))}
          contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingVertical: 12 }}
        >
          {PERSONA_IDS.map((id, i) => (
            <HeroCard key={id} id={id} index={i} x={x} step={step} width={cardW} dark={isDark} onFocusCard={focusCard} />
          ))}
        </Animated.ScrollView>
      </Enter>

      <Enter delay={stagger(2)} style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.dotsRow}>
          {Platform.OS === 'web' ? (
            <PressableScale onPress={() => focusCard(Math.max(0, index - 1))} style={styles.arrow} accessibilityLabel="Предыдущий герой">
              <Icon name="back" size={18} color="#ffffff" />
            </PressableScale>
          ) : null}
          <View style={styles.dots}>
            {PERSONA_IDS.map((id, i) => (
              <Dot key={id} index={i} x={x} step={step} />
            ))}
          </View>
          {Platform.OS === 'web' ? (
            <PressableScale
              onPress={() => focusCard(Math.min(PERSONA_IDS.length - 1, index + 1))}
              style={styles.arrow}
              accessibilityLabel="Следующий герой"
            >
              <Icon name="chevron" size={18} color="#ffffff" />
            </PressableScale>
          ) : null}
        </View>
        <T variant="caption" color={alpha('#ffffff', 0.55)} center style={{ marginTop: 12, paddingHorizontal: 28 }}>
          Концепт команды nexus. Данные синтетические, всё считается на телефоне. Это не юридическая консультация.
        </T>
      </Enter>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#120b2e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intro: { paddingHorizontal: 28, marginTop: 26, alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: '#ffffff', textAlign: 'center' },
  carousel: { flex: 1, justifyContent: 'center' },
  card: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  cardTop: { height: 200, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  catGlow: { position: 'absolute', top: -50 },
  catWrap: { marginBottom: -10 },
  pills: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  cardBody: { padding: 20, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  quote: { borderRadius: 16, padding: 12, marginTop: 10, minHeight: 68, justifyContent: 'center' },
  play: {
    marginTop: 14,
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bottom: { paddingTop: 8 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#ffffff' },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
})
