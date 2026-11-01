// «Перевод остановлен»: банк объясняет, почему, что грозит и что делать. Главный экран демо.
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'

import { LegalNote } from '@/components/legal-note'
import { SheetScreen } from '@/components/sheet-screen'
import { Icon } from '@/components/ui/icon'
import { Button, TextButton } from '@/components/ui/kit'
import { T } from '@/components/ui/text'
import { LEGAL_LIST } from '@/engine/content'
import { rub } from '@/engine/format'
import * as svc from '@/engine/services'
import { useApp } from '@/store/app-store'
import { lastRecruiterMessage } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts } from '@/theme/tokens'
import { mix, useTheme } from '@/theme/use-theme'
import { STAGGER_MS, EASE_OUT } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

function Siren() {
  const reduce = useReducedMotion()
  const shake = useSharedValue(0)
  const ring = useSharedValue(0)
  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    if (reduce) return
    shake.set(withSequence(withTiming(-1, { duration: 60 }), withRepeat(withTiming(1, { duration: 90 }), 5, true), withTiming(0, { duration: 100, easing: EASE_OUT })))
    ring.set(withRepeat(withTiming(1, { duration: 1500 }), -1, false))
  }, [reduce, ring, shake])
  const lock = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.get() * 10}deg` }] }))
  const pulse = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.get()), transform: [{ scale: 1 + ring.get() * 0.9 }] }))
  return (
    <View style={styles.siren}>
      <Animated.View style={[styles.sirenRing, pulse]} />
      <Animated.View style={[styles.sirenIcon, lock]}>
        <Icon name="lock" size={30} color="#fff" strokeWidth={2.3} />
      </Animated.View>
    </View>
  )
}

export default function InterceptScreen() {
  const { c } = useTheme()
  const payload = useUi((s) => s.intercept)
  const [confirming, setConfirming] = useState(false)
  if (!payload) return null
  const { result, to, amount } = payload
  const it = result.intercept!
  const basis = LEGAL_LIST.filter((x) => it.consequences.includes(x.short))
  const ui = useUi.getState()

  const close = (text?: string) => {
    router.back()
    if (text) ui.notify(text)
  }

  if (confirming) {
    return (
      <SheetScreen title="Вы уверены?" onBack={() => setConfirming(false)} onClose={() => close('Перевод отменён')}>
        <T variant="body" style={{ opacity: 0.85 }}>
          Если это действительно ваши деньги — перевод можно провести. Но если вас попросили «принять и переслать», отвечать за операцию будете вы, а не
          тот, кто попросил.
        </T>
        <View style={{ gap: 8, marginTop: 16 }}>
          {['Я знаю отправителя лично', 'Меня никто не торопит и не обещает процент', 'Получатель — не «куратор» из чата'].map((x) => (
            <View key={x} style={[styles.check, { backgroundColor: c.page }]}>
              <Icon name="check" size={18} color={c.brand} strokeWidth={2.4} />
              <T variant="body" style={{ flex: 1 }}>
                {x}
              </T>
            </View>
          ))}
        </View>
        <View style={{ gap: 8, marginTop: 22 }}>
          <Button title="Вернуться, я передумал" onPress={() => setConfirming(false)} />
          <TextButton
            title={`Всё верно, перевести ${rub(amount)}`}
            onPress={() => {
              const r = useApp.getState().mutate((acc) => svc.transfer(acc, to, amount, true))
              close(r.status === 'ok' ? `Переведено ${rub(amount)} → ${to}` : r.message)
            }}
          />
        </View>
      </SheetScreen>
    )
  }

  return (
    <SheetScreen tone="danger" title={it.title} onClose={() => close('Перевод отменён')}>
      <Enter style={styles.hero}>
        <Siren />
        <View style={[styles.amount, { backgroundColor: c.page }]}>
          <T variant="small" muted>
            Перевод
          </T>
          <T variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
            {rub(amount)}
          </T>
          <T variant="small" muted numberOfLines={1}>
            → {to}
          </T>
        </View>
      </Enter>

      <T variant="body" style={{ marginTop: 18, fontSize: 17, lineHeight: 25, fontFamily: fonts.semibold }}>
        {it.text}
      </T>

      <T variant="label" muted style={{ marginTop: 20, marginBottom: 8 }}>
        Почему
      </T>
      {result.risk.reasons.map((r, i) => (
        <Enter delay={STAGGER_MS} key={r} style={styles.reason}>
          <View style={[styles.bullet, { backgroundColor: c.riskHigh }]} />
          <T variant="body" style={{ flex: 1 }}>
            {r}
          </T>
        </Enter>
      ))}

      {it.consequences.length ? (
        <Enter delay={2 * STAGGER_MS} style={[styles.danger, { backgroundColor: mix(c.riskHigh, c.surface, 0.09) }]}>
          <T variant="title">Чем это грозит</T>
          {it.consequences.map((x) => (
            <T key={x} variant="small" style={{ marginTop: 6 }}>
              — {x}
            </T>
          ))}
          <T variant="caption" muted style={{ marginTop: 8 }}>
            Это не юридическая консультация.
          </T>
          <LegalNote items={basis} />
        </Enter>
      ) : null}

      <View style={{ gap: 8, marginTop: 22 }}>
        <Button title="Отменить перевод" onPress={() => close('Перевод отменён')} />
        <Button
          kind="ghost"
          icon="lifebuoy"
          title="Мне предложили подработку"
          onPress={() => router.replace({ pathname: '/sos', params: { branch: 'A' } })}
        />
        <Button
          kind="ghost"
          icon="phone"
          title="Позвонить в банк"
          // 19% в опросе предпочли бы звонок банка (n = 231). В реальном приложении — звонок в поддержку с контекстом перехвата
          onPress={() => close('Перевод не отправлен. Соединяем с банком — в демо звонок не совершается')}
        />
        <Button
          kind="ghost"
          icon="shield"
          title="Проверить сообщение"
          onPress={() => {
            ui.set({ shieldText: lastRecruiterMessage() })
            router.replace('/shield')
          }}
        />
        <TextButton title="Это мои деньги, продолжить" onPress={() => setConfirming(true)} />
      </View>
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  siren: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  sirenRing: { position: 'absolute', width: 76, height: 76, borderRadius: 26, backgroundColor: '#f0443a' },
  sirenIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#f0443a', alignItems: 'center', justifyContent: 'center' },
  amount: { flex: 1, borderRadius: 18, padding: 14 },
  reason: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 8 },
  danger: { marginTop: 14, borderRadius: 20, padding: 16 },
  check: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 16, padding: 12 },
})

