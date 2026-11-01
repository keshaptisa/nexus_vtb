// Сторис на весь экран: карточки → вопрос → награда. Касание справа — дальше, слева — назад, смахнуть вниз — закрыть.
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { Glow } from '@/components/glow'
import { StoryArt, storyTheme } from '@/components/story-art'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { LESSONS } from '@/engine/content'
import * as svc from '@/engine/services'
import { useApp } from '@/store/app-store'
import { onStoryFinished } from '@/store/scenario-store'
import { fonts, palette } from '@/theme/tokens'
import { EASE_OUT, EASE_EMPHASIS } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

const SLIDE_MS = 7000

function Bar({ state, slideKey }: { state: 'done' | 'active' | 'auto' | 'todo'; slideKey: string }) {
  const w = useSharedValue(state === 'done' || state === 'active' ? 1 : 0)
  useEffect(() => {
    if (state === 'auto') {
      w.set(0)
      w.set(withTiming(1, { duration: SLIDE_MS, easing: Easing.linear }))
    } else w.set(state === 'todo' ? 0 : 1)
  }, [state, slideKey, w])
  const style = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }))
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, style]} />
    </View>
  )
}

export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const [si, setSi] = useState(() => Math.max(0, LESSONS.findIndex((l) => l.id === id)))
  const [ci, setCi] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  const [gained, setGained] = useState<number | null>(null)
  const done = useApp((s) => (s.personaId ? s.accounts[s.personaId]?.done ?? [] : []))

  const story = LESSONS[si]
  const slides = story.cards.length + (story.quiz ? 1 : 0) + 1
  const isQuiz = !!story.quiz && ci === story.cards.length
  const isFinal = ci === slides - 1
  const auto = !isQuiz && !isFinal
  const theme = storyTheme(story.id)

  const goStory = (k: number) => {
    if (k < 0) return
    if (k >= LESSONS.length) return router.back()
    setSi(k)
    setCi(0)
    setAnswer(null)
    setGained(null)
  }
  const next = () => (ci < slides - 1 ? setCi(ci + 1) : goStory(si + 1))
  const prev = () => (ci > 0 ? setCi(ci - 1) : goStory(si - 1))

  useEffect(() => {
    if (!auto) return
    const t = setTimeout(next, SLIDE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [si, ci, auto])

  // На финальном слайде начисляем XP один раз за историю
  useEffect(() => {
    if (!isFinal || gained !== null) return
    const xp = useApp.getState().mutate((acc) => svc.awardLesson(acc, story))
    setGained(xp)
    if (xp && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onStoryFinished()
  }, [gained, isFinal, story])

  // Иллюстрация «парит»; на вопросе и награде уменьшается
  const float = useSharedValue(0)
  useEffect(() => {
    if (!reduce) float.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [float, reduce])
  const small = useSharedValue(0)
  useEffect(() => {
    small.set(withTiming(isQuiz || isFinal ? 1 : 0, { duration: 300, easing: EASE_EMPHASIS }))
  }, [isQuiz, isFinal, small])
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(small.get(), [0, 1], [1, 0.5]),
    transform: [{ translateY: float.get() * -10 }, { scale: interpolate(small.get(), [0, 1], [1, 0.7]) }],
  }))

  // Смахнуть вниз — закрыть
  const drag = useSharedValue(0)
  const pan = usePanGesture({
    activeOffsetY: 12,
    failOffsetX: [-20, 20],
    onUpdate: (e) => {
      'worklet'
      drag.set(Math.max(0, e.translationY))
    },
    onDeactivate: (e) => {
      'worklet'
      if (e.translationY > 120) scheduleOnRN(router.back)
      else drag.set(withTiming(0, { duration: 150, easing: EASE_OUT }))
    },
  })
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.get() }, { scale: 1 - Math.min(drag.get() / 2000, 0.06) }],
    borderRadius: Math.min(drag.get() / 3, 34),
  }))

  const correct = answer !== null && story.quiz && answer === story.quiz.answer
  const already = done.includes(`lesson:${story.id}`) && gained === 0

  return (
    <View style={styles.backdrop}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <LinearGradient colors={[theme.from, theme.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow color={theme.glow} size={520} opacity={0.6} style={styles.glow} />

          <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
            <View style={styles.bars}>
              {Array.from({ length: slides }).map((_, k) => (
                <Bar key={k} slideKey={`${si}-${ci}`} state={k < ci ? 'done' : k === ci ? (auto ? 'auto' : 'active') : 'todo'} />
              ))}
            </View>
            <View style={styles.topRow}>
              <View style={styles.tag}>
                <T variant="small" color="#fff" style={{ fontFamily: fonts.semibold }}>
                  {story.short} · +{story.xp} XP
                </T>
              </View>
              <PressableScale onPress={() => router.back()} style={styles.close} accessibilityLabel="Закрыть">
                <Icon name="close" size={18} color="#16171d" strokeWidth={2.6} />
              </PressableScale>
            </View>
          </View>

          <View style={styles.middle}>
            <Enter key={story.id} style={artStyle}>
              <StoryArt id={story.id} uid="viewer" size={280} />
            </Enter>
            {auto ? (
              <>
                <Pressable style={[styles.zone, { left: 0, width: '33%' }]} onPress={prev} accessibilityLabel="Назад" />
                <Pressable style={[styles.zone, { right: 0, width: '67%' }]} onPress={next} accessibilityLabel="Дальше" />
              </>
            ) : null}
          </View>

          <View key={`${si}-${ci}`} style={[styles.bottom, { paddingBottom: insets.bottom + 22 }]}>
            {auto ? (
              <Enter>
                <T style={styles.h}>{story.cards[ci].title}</T>
                <T variant="body" color="rgba(255,255,255,0.86)" style={{ marginTop: 10, fontSize: 17, lineHeight: 25 }}>
                  {story.cards[ci].text}
                </T>
                <Button kind="light" title="Дальше" onPress={next} style={{ marginTop: 22 }} />
              </Enter>
            ) : null}

            {isQuiz && story.quiz ? (
              <Enter>
                <T variant="label" color="rgba(255,255,255,0.6)">
                  Проверьте себя
                </T>
                <T style={[styles.h, { fontSize: 25, lineHeight: 30, marginTop: 4 }]}>{story.quiz.question}</T>
                <View style={{ gap: 8, marginTop: 16 }}>
                  {story.quiz.options.map((o, k) => {
                    const right = k === story.quiz!.answer
                    const bg =
                      answer === null ? 'rgba(255,255,255,0.13)' : right ? palette.riskLow : k === answer ? palette.riskHigh : 'rgba(255,255,255,0.07)'
                    return (
                      <PressableScale
                        key={o}
                        haptic
                        disabled={answer !== null}
                        onPress={() => {
                          setAnswer(k)
                          if (Platform.OS !== 'web')
                            Haptics.notificationAsync(right ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {})
                        }}
                        style={[styles.option, { backgroundColor: bg, opacity: answer !== null && !right && k !== answer ? 0.55 : 1 }]}
                      >
                        <T variant="bodyStrong" color="#fff">
                          {o}
                        </T>
                      </PressableScale>
                    )
                  })}
                </View>
                {answer !== null ? (
                  <Enter kind="fade">
                    <T variant="body" color="rgba(255,255,255,0.82)" style={{ marginTop: 12 }}>
                      {correct ? 'Верно.' : 'Не совсем — правильный ответ подсвечен зелёным.'}
                    </T>
                    <Button kind="lime" title="Дальше" onPress={next} style={{ marginTop: 14 }} />
                  </Enter>
                ) : null}
              </Enter>
            ) : null}

            {isFinal ? (
              <Enter style={{ alignItems: 'center' }}>
                <View style={styles.star}>
                  <Icon name="star" size={40} color="#16171d" strokeWidth={2.3} />
                </View>
                <T style={[styles.h, { textAlign: 'center', marginTop: 18 }]}>
                  {gained === null ? 'Считаем…' : already ? 'Уже пройдено' : `+${gained} XP`}
                </T>
                <T variant="body" color="rgba(255,255,255,0.78)" center style={{ marginTop: 6 }}>
                  {already ? 'Очки за эту историю вы уже получили.' : 'История пройдена. Очки добавлены к вашему уровню.'}
                </T>
                <View style={{ gap: 8, marginTop: 20, alignSelf: 'stretch' }}>
                  {story.cta ? (
                    <Button
                      kind="light"
                      title={story.cta.label}
                      onPress={() => {
                        const map: Record<string, string> = { open_sos: '/sos', open_shield: '/shield', open_quest: '/quest' }
                        const href = map[story.cta!.action]
                        if (href) router.replace(href as never)
                        else router.back()
                      }}
                    />
                  ) : null}
                  {si < LESSONS.length - 1 ? (
                    <Button kind="lime" title={`Следующая: ${LESSONS[si + 1].short}`} onPress={() => goStory(si + 1)} />
                  ) : (
                    <Button kind="lime" title="Готово" onPress={() => router.back()} />
                  )}
                </View>
              </Enter>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}


const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  sheet: { flex: 1, overflow: 'hidden' },
  glow: { position: 'absolute', top: -160, right: -200 },
  top: { paddingHorizontal: 16, zIndex: 3 },
  bars: { flexDirection: 'row', gap: 5 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: '#fff' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  tag: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  bottom: { paddingHorizontal: 24 },
  h: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 36, letterSpacing: -0.6, color: '#fff' },
  option: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15 },
  star: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.lime,
    shadowOpacity: 0.7,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
})
