// Окно банка на шаге сценария (и витрины «Старта» вне сценария). Набор кнопок зависит от типа события.
// Порт ScenarioPopups.tsx и ChannelWindows.tsx сайта.
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon } from '@/components/ui/icon'
import { Button, Progress, TextButton } from '@/components/ui/kit'
import { T } from '@/components/ui/text'
import { suspiciousIncoming } from '@/engine/bank'
import { rub } from '@/engine/format'
import { liveRisk } from '@/engine/risk'
import * as svc from '@/engine/services'
import type { Goal, ScenarioPopup } from '@/engine/types'
import { useAccount, useApp } from '@/store/app-store'
import {
  closePopup,
  consumePopup,
  currentStep,
  finishScenario,
  lastRecruiterMessage,
  onChannelAction,
  useScenario,
} from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts, gradients } from '@/theme/tokens'
import { mix, useTheme } from '@/theme/use-theme'
import { STAGGER_MS } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

function Title({ icon, danger, children }: { icon: string; danger?: boolean; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={styles.title}>
      <Animated.View style={[styles.titleIcon, { backgroundColor: danger ? c.riskHigh : c.brand }]}>
        <Icon name={icon} size={22} color="#fff" strokeWidth={2.2} />
      </Animated.View>
      <T variant="h2" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  )
}

function Quote() {
  const { c } = useTheme()
  const text = lastRecruiterMessage()
  if (!text) return null
  return (
    <View style={[styles.quote, { backgroundColor: c.page }]}>
      <T variant="caption" muted style={{ fontFamily: fonts.semibold, marginBottom: 2 }}>
        Сообщение в мессенджере
      </T>
      <T variant="body">«{text}»</T>
    </View>
  )
}

function Check({ children }: { children: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.check, { backgroundColor: c.page }]}>
      <Icon name="check" size={18} color={c.brand} strokeWidth={2.4} />
      <T variant="body" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  )
}

function GoalRow({ goal }: { goal: Goal }) {
  const { c } = useTheme()
  return (
    <View style={[styles.goal, { backgroundColor: c.page }]}>
      <View style={styles.goalHead}>
        <T variant="bodyStrong">{goal.title}</T>
        <T variant="small" muted>
          {rub(goal.saved)} / {rub(goal.target)}
        </T>
      </View>
      <Progress value={goal.saved / goal.target} color={c.sky} track={c.surface} />
    </View>
  )
}

export default function ScenarioWindowScreen() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const popup = useScenario((s) => s.popup)
  const acc = useAccount()
  const [stage, setStage] = useState<'offer' | 'waiting' | 'error'>('offer')

  // Если окно закрыть жестом или крестиком, сценарий решает, что дальше (RouteWatcher в _layout.tsx)

  if (!popup || !acc) return null
  const ui = useUi.getState()
  const live = liveRisk(acc)
  const incoming = suspiciousIncoming(acc)

  const go = (fn: () => void) => {
    consumePopup()
    fn()
  }
  const close = () => router.back()

  const act = {
    returnFunds: () =>
      go(() => {
        const r = useApp.getState().mutate((a) => svc.returnFunds(a))
        const gained = useApp.getState().mutate((a) => svc.awardAction(a, 'safe_exit'))
        router.back()
        if (r) ui.notify(`Заморожено ${rub(r.frozen)} — банк вернёт деньги отправителю`)
        ui.celebrateXp(gained)
        finishScenario()
      }),
    openTransfer: () =>
      go(() => {
        const e = currentStep()?.expect
        ui.set({ transferPrefill: e?.action === 'transfer' ? { to: String(e.to), amount: Number(e.amount) } : null })
        router.replace('/transfer')
      }),
    openShield: () =>
      go(() => {
        ui.set({ shieldText: lastRecruiterMessage() })
        router.replace('/shield')
      }),
    openSos: (branch: string) => go(() => router.replace({ pathname: '/sos', params: { branch } })),
    askBit: (question: string) => {
      closePopup()
      ui.set({ bitAsk: { id: Date.now(), text: question } })
      router.replace('/assistant')
    },
    openLesson: () =>
      go(() => {
        const e = currentStep()?.expect
        const lesson = e?.action === 'event' ? svc.lessonForEvent(String(e.type)) : null
        if (lesson) router.replace(`/story/${lesson.id}`)
        else router.back()
      }),
    openQuest: () => go(() => router.replace('/quest')),
  }

  const migrate = async () => {
    setStage('waiting')
    // В демо родитель «подтверждает» сам через секунду; в ВТБ — запрос в его ВТБ Онлайн
    await new Promise((r) => setTimeout(r, 1300))
    try {
      const r = useApp.getState().mutate((a) => svc.migrateBridge(a))
      go(() => {
        router.back()
        ui.notify(r.message)
        ui.celebrateXp(r.gained)
        onChannelAction('bridge')
      })
    } catch {
      setStage('error')
    }
  }

  const activatePushkin = () => {
    try {
      const r = useApp.getState().mutate((a) => svc.activatePushkin(a))
      go(() => {
        router.back()
        ui.notify(r.message)
        ui.celebrateXp(r.gained)
        onChannelAction('pushkin')
      })
    } catch (e) {
      ui.notify((e as Error).message)
    }
  }

  const plan = () => {
    const e = currentStep()?.expect
    const title = e?.action === 'goal' ? String(e.goal) : acc.goals[0]?.title ?? 'Моя цель'
    return {
      title,
      target: e?.action === 'goal' ? Number(e.target) : acc.goals[0]?.target ?? 5000,
      amount: e?.action === 'goal' ? Number(e.amount) : 500,
      goal: acc.goals.find((g) => g.title === title) ?? null,
    }
  }

  const depositGoal = () => {
    const p = plan()
    try {
      const r = useApp.getState().mutate((a) => {
        const goal = a.goals.find((g) => g.title === p.title) ?? svc.createGoal(a, p.title, p.target)
        return svc.deposit(a, goal.id, p.amount)
      })
      go(() => {
        router.back()
        ui.notify(r.message)
        ui.celebrateXp(r.gained)
        onChannelAction('goal')
      })
    } catch (e) {
      ui.notify((e as Error).message)
    }
  }

  const xp = acc.xp
  return (
    <ScrollView
      style={{ backgroundColor: c.surface }}
      contentContainerStyle={[styles.root, { paddingBottom: insets.bottom + 20, paddingTop: Platform.OS === 'web' ? 24 : 26 }]}
      bounces={false}
    >
      {body(popup)}
    </ScrollView>
  )

  function body(p: ScenarioPopup) {
    if (p.type === 'incoming')
      return (
        <>
          <Title icon="alert" danger>
            Необычное зачисление
          </Title>
          {incoming ? (
            <Enter style={[styles.money, { backgroundColor: mix(c.riskHigh, c.surface, 0.08) }]}>
              <T variant="small" muted>
                Пришло от «{incoming.counterparty}»
              </T>
              <T style={[styles.big, { color: c.riskLow }]}>+{rub(incoming.amount)}</T>
              <T variant="small" color={c.riskHigh} style={{ fontFamily: fonts.bold }}>
                Сумма помечена банком — под проверкой
              </T>
            </Enter>
          ) : null}
          {live.signals.length ? (
            <>
              <T variant="label" muted style={styles.label}>
                Почему банк насторожился
              </T>
              {live.signals.slice(0, 3).map((s, i) => (
                <Enter delay={STAGGER_MS} key={s} style={styles.reason}>
                  <View style={[styles.bullet, { backgroundColor: c.riskHigh }]} />
                  <T variant="body" style={{ flex: 1 }}>
                    {s}
                  </T>
                </Enter>
              ))}
            </>
          ) : null}
          <T variant="body" style={styles.text}>
            Если вы не ждали этих денег — не тратьте и не переводите их, даже «обратно». Банк сам вернёт их владельцу.
          </T>
          <View style={styles.buttons}>
            <Button icon="lock" title="Вернуть через банк" onPress={act.returnFunds} />
            <Button kind="ghost" icon="chat" title="Спросить Бита" onPress={() => act.askBit('Мне пришли чужие деньги')} />
            <TextButton title="Я знаю отправителя, это мои деньги" onPress={close} />
          </View>
        </>
      )

    if (p.type === 'request_transfer')
      return (
        <>
          <Title icon="send">Вас просят перевести деньги</Title>
          <Quote />
          <T variant="body" style={styles.text}>
            Перед отправкой банк проверит перевод. Если это чужие деньги, которые просят переслать дальше, — перевод будет остановлен.
          </T>
          <View style={styles.buttons}>
            <Button title="Открыть перевод" onPress={act.openTransfer} />
            <Button kind="ghost" icon="shield" title="Проверить сообщение" onPress={act.openShield} />
            <Button kind="ghost" icon="lifebuoy" title="Не буду переводить — что делать?" onPress={() => act.openSos('A')} />
          </View>
        </>
      )

    if (p.type === 'pressure' || p.type === 'threat') {
      const threat = p.type === 'threat'
      return (
        <>
          <Title icon="alert" danger>
            {threat ? 'Вам угрожают' : 'Вас торопят'}
          </Title>
          <Quote />
          <T variant="body" style={styles.text}>
            {threat
              ? 'Угрозы «сдадим в полицию» и «знаем, где ты учишься» — стандартное давление вербовщиков. Не переводите больше ничего. Если вы сами сообщите банку и полиции и поможете раскрыть схему, закон это учитывает.'
              : 'Спешка — главный приём вербовщиков: чтобы вы не успели подумать и спросить кого-то. Вы не обязаны ничего делать.'}
          </T>
          {threat ? (
            <View style={[styles.quote, { backgroundColor: c.page }]}>
              <T variant="small">
                <T variant="small" style={{ fontFamily: fonts.bold }}>
                  Угрожают прямо сейчас?{' '}
                </T>
                Звоните 102 — это бесплатно.
              </T>
            </View>
          ) : null}
          <View style={styles.buttons}>
            <Button icon="lifebuoy" title="Открыть «Безопасный выход»" onPress={() => act.openSos(threat ? 'B' : 'A')} />
            <Button kind="ghost" icon="chat" title="Спросить Бита" onPress={() => act.askBit(threat ? 'Мне угрожают, я уже переводил' : 'Что мне грозит?')} />
          </View>
        </>
      )
    }

    if (p.type === 'history')
      return (
        <>
          <Title icon="eye">Банк заметил транзит</Title>
          <T variant="body" style={styles.text}>
            Вчера на карту пришли деньги от незнакомого человека и почти сразу ушли дальше. Так выглядит работа дропа: через карту проводят чужие деньги.
          </T>
          <Quote />
          <View style={styles.buttons}>
            <Button title="Понятно" onPress={close} />
            <Button kind="ghost" icon="chat" title="Что это значит?" onPress={() => act.askBit('Что такое дроп?')} />
          </View>
        </>
      )

    if (p.type === 'lesson')
      return (
        <>
          <Title icon="book">{p.title ?? 'Новая история'}</Title>
          <T variant="body" style={[styles.text, { fontSize: 16.5 }]}>
            {p.text}
          </T>
          <View style={styles.buttons}>
            <Button icon="play" title="Смотреть историю" onPress={act.openLesson} />
            <Button kind="ghost" title="Позже" onPress={close} />
          </View>
        </>
      )

    if (p.type === 'birthday')
      return (
        <>
          <Title icon="star">{p.title ?? 'Скоро 14!'}</Title>
          <T variant="body" style={styles.text}>
            {p.text}
          </T>
          <View style={{ gap: 8, marginTop: 14 }}>
            <Check>Своя карта по паспорту — без новой заявки</Check>
            <Check>Цели, копилка и опыт переносятся</Check>
            <Check>Родитель подтвердит переход в своём приложении</Check>
          </View>
          <View style={styles.buttons}>
            <Button title="Понятно, жду!" onPress={close} />
          </View>
        </>
      )

    if (p.type === 'bridge')
      return (
        <>
          <Title icon="spark">{p.title ?? 'Переход в «Старт»'}</Title>
          <T variant="body" style={styles.text}>
            {p.text}
          </T>
          <T variant="label" muted style={styles.label}>
            Переносим в «Старт»
          </T>
          <View style={{ gap: 8 }}>
            {acc!.goals.map((g) => (
              <GoalRow key={g.id} goal={g} />
            ))}
            <View style={[styles.check, { backgroundColor: c.page }]}>
              <Icon name="star" size={18} color={c.brand} />
              <T variant="bodyStrong">{xp} XP</T>
              <T variant="body" muted>
                и пройденные истории
              </T>
            </View>
          </View>
          {stage === 'waiting' ? (
            <Enter kind="fade" style={[styles.waiting, { backgroundColor: c.brandSoft }]}>
              <ActivityIndicator color={c.brand} />
              <T variant="small" color={c.brand} style={{ fontFamily: fonts.semibold }}>
                Ждём подтверждения в приложении мамы…
              </T>
            </Enter>
          ) : null}
          {stage === 'error' ? (
            <T variant="small" color={c.riskHigh} style={{ marginTop: 10 }}>
              Не получилось перейти — попробуйте ещё раз.
            </T>
          ) : null}
          <View style={styles.buttons}>
            <Button icon="users" title="Попросить маму подтвердить" loading={stage === 'waiting'} onPress={migrate} />
            <Button kind="ghost" title="Позже" onPress={close} />
          </View>
          <T variant="caption" muted style={{ marginTop: 10 }}>
            С 1 августа 2025 года счёт подростку 14–17 открывается только с согласия родителя.
          </T>
        </>
      )

    if (p.type === 'pushkin')
      return (
        <>
          <Title icon="film">{p.title ?? '«Пушкинская карта»'}</Title>
          <T variant="body" style={styles.text}>
            {p.text}
          </T>
          <View style={{ gap: 8, marginTop: 14 }}>
            {svc.PUSHKIN_OFFERS.map((o) => (
              <Check key={o}>{o}</Check>
            ))}
          </View>
          <View style={styles.buttons}>
            <Button icon="card" title="Открыть карту «Старт»" onPress={activatePushkin} />
            <Button kind="ghost" title="Не сейчас" onPress={close} />
          </View>
        </>
      )

    if (p.type === 'goal') {
      const pl = plan()
      return (
        <>
          <Title icon="piggy">{p.title ?? 'Копилка'}</Title>
          <T variant="body" style={styles.text}>
            {p.text}
          </T>
          {pl.goal ? (
            <View style={{ marginTop: 14 }}>
              <GoalRow goal={pl.goal} />
            </View>
          ) : null}
          <View style={styles.buttons}>
            <Button icon="piggy" title={`Отложить ${rub(pl.amount)}`} onPress={depositGoal} />
            <Button kind="ghost" title="Не сейчас" onPress={close} />
          </View>
        </>
      )
    }

    // done
    return (
      <>
        <T variant="h2">Сценарий пройден</T>
        <Enter style={styles.done}>
          <LinearGradient colors={gradients.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <T variant="h2" color="#fff">
            {acc!.persona.name}, вы всё сделали правильно
          </T>
          <T variant="body" color="rgba(255,255,255,0.88)" style={{ marginTop: 6 }}>
            {p.text ?? 'Опасные деньги не ушли дальше, банк получил обращение с доказательствами.'}
          </T>
          <View style={styles.xp}>
            <Icon name="star" size={16} color="#fff" />
            <T variant="small" color="#fff" style={{ fontFamily: fonts.bold }}>
              Всего {xp} XP
            </T>
          </View>
        </Enter>
        <View style={styles.buttons}>
          <Button title="Квест «А что было бы, если…»" icon="game" onPress={act.openQuest} />
          <Button kind="ghost" title="Закрыть" onPress={close} />
        </View>
      </>
    )
  }
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 22 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  titleIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quote: { marginTop: 14, borderRadius: 18, borderBottomLeftRadius: 6, padding: 14 },
  text: { marginTop: 14, opacity: 0.85 },
  label: { marginTop: 18, marginBottom: 8 },
  reason: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 8 },
  buttons: { gap: 8, marginTop: 22 },
  money: { marginTop: 14, borderRadius: 22, padding: 18 },
  big: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, marginTop: 2 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  goal: { borderRadius: 16, padding: 14, gap: 8 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12, marginTop: 14 },
  done: { marginTop: 14, borderRadius: 26, padding: 22, overflow: 'hidden' },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
})
