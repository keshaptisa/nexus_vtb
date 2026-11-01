// Главная: шапка, сторис, карта, быстрые действия, сценарий, уровень и копилка, «Что видит банк», траты.
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CatAvatar } from '@/components/cat-avatar'
import { BalanceCard } from '@/components/balance-card'
import { BankSeesCard, SpendingCard } from '@/components/finance'
import { Mascot } from '@/components/mascot'
import { StoriesRow } from '@/components/stories-row'
import { Icon } from '@/components/ui/icon'
import { Card, IconTile, Progress } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { SCENARIOS } from '@/engine/content'
import { greeting, rub } from '@/engine/format'
import { liveRisk } from '@/engine/risk'
import { useAccount } from '@/store/app-store'
import { openWindow, startScenario, useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts, gradients } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'
import { stagger } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'


export default function Home() {
  const acc = useAccount()
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const scenarioOn = useScenario((s) => s.scenarioId !== null)
  const dockOpen = useScenario((s) => s.expanded)
  const unreadBit = useUi((s) => s.bitUnread)
  const live = useMemo(() => (acc ? liveRisk(acc) : null), [acc])
  if (!acc || !live) return null

  const p = acc.persona
  const frozen = acc.transactions.filter((t) => t.frozen).reduce((s, t) => s + t.amount, 0)
  const suspicious = acc.transactions.filter((t) => t.flagged && !t.frozen).reduce((s, t) => s + t.amount, 0)
  const goal = acc.goals[0]
  const level = 1 + Math.floor(acc.xp / 100)
  const scenario = SCENARIOS[p.id]

  const actions = [
    { icon: 'plus', label: 'Пополнить', href: '/topup' },
    { icon: 'send', label: 'Перевести', href: '/transfer' },
    { icon: 'bag', label: 'Оплатить', href: '/pay' },
    { icon: 'lifebuoy', label: 'Я влип', href: '/sos', accent: true },
  ] as const

  return (
    <ScrollView
      style={{ backgroundColor: c.page }}
      contentContainerStyle={{ paddingTop: insets.top + (scenarioOn ? (dockOpen ? 196 : 74) : 8), paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
    >
      {/* Шапка: аватар → смена героя, Бит и профиль */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.push('/accounts')} style={styles.who} haptic>
          <CatAvatar id={p.id} size={46} frame="circle" />
          <View>
            <T variant="title">{p.name}</T>
            <T variant="caption" muted>
              {p.age} лет · сменить
            </T>
          </View>
          <Icon name="chevronDown" size={16} color={c.muted} />
        </PressableScale>
        <View style={styles.headerRight}>
          <PressableScale onPress={() => router.push('/assistant')} style={[styles.round, { backgroundColor: c.surface }]} accessibilityLabel="Бит, помощник">
            <Mascot size={30} mood={unreadBit ? 'alert' : 'calm'} />
            {unreadBit ? <View style={[styles.dot, { backgroundColor: c.coral, borderColor: c.page }]} /> : null}
          </PressableScale>
          <PressableScale onPress={() => router.push('/profile')} style={[styles.round, { backgroundColor: c.surface }]} accessibilityLabel="Профиль">
            <Icon name="user" size={20} color={c.ink} />
          </PressableScale>
        </View>
      </View>

      <Enter delay={stagger(0)} style={styles.pad}>
        <T variant="h1">
          {greeting()},{'\n'}
          {p.name}
        </T>
      </Enter>

      <View style={{ marginTop: 16 }}>
        <StoriesRow done={acc.done} />
      </View>

      <Enter delay={stagger(1)} style={[styles.pad, { marginTop: 18 }]}>
        <BalanceCard persona={p} suspicious={suspicious} frozen={frozen} onPress={() => router.push('/history')} />
      </Enter>

      {/* Быстрые действия — круглые кнопки, как в банковских приложениях */}
      <Enter delay={stagger(2)} style={[styles.pad, styles.actions]}>
        {actions.map((a) => (
          <PressableScale key={a.label} haptic onPress={() => router.push(a.href)} style={styles.action}>
            <View style={[styles.actionIcon, { backgroundColor: 'accent' in a ? c.coral : c.surface, shadowColor: c.shadow }]}>
              <Icon name={a.icon} size={24} color={'accent' in a ? '#fff' : c.brand} strokeWidth={2.1} />
            </View>
            <T variant="caption" style={{ fontFamily: fonts.semibold }} center>
              {a.label}
            </T>
          </PressableScale>
        ))}
      </Enter>

      {/* Сценарий героя */}
      {!scenarioOn ? (
        <Enter delay={stagger(3)} style={[styles.pad, { marginTop: 22 }]}>
          <PressableScale haptic onPress={startScenario} style={styles.play}>
            <LinearGradient colors={['#16171d', '#2b1a6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.playIcon, { backgroundColor: c.lime }]}>
              <Icon name="play" size={22} color="#16171d" />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption" color={alpha('#ffffff', 0.6)} style={{ fontFamily: fonts.bold, letterSpacing: 1 }}>
                ПРОИГРАТЬ СЦЕНАРИЙ · {scenario.steps.length} ШАГОВ
              </T>
              <T variant="title" color="#fff" numberOfLines={2}>
                {scenario.title}
              </T>
            </View>
            <Icon name="chevron" size={20} color={alpha('#ffffff', 0.6)} />
          </PressableScale>
        </Enter>
      ) : null}

      {/* Переход в «Старт»: из «Детского банка» или для держателя «Пушкинской карты» */}
      {p.segment !== 'start' ? (
        <Enter delay={stagger(4)} style={[styles.pad, { marginTop: 14 }]}>
          <Card
            onPress={() =>
              openWindow(
                p.segment === 'kids'
                  ? { type: 'bridge', title: 'Переход в «Старт»', text: 'Вам исполнилось 14? Перейдите в раздел для 14–22 лет — цели, копилка и опыт сохранятся.' }
                  : { type: 'pushkin', title: '«Старт» для держателей «Пушкинской карты»', text: 'Своя карта, копилка, «Молодёжь Плюс» и защита от мошенников — в одном разделе.' },
              )
            }
            style={[styles.rowCard, { borderWidth: 2, borderColor: alpha(c.brand, 0.3) }]}
          >
            <IconTile name="spark" color="#fff" bg={c.brand} />
            <View style={{ flex: 1 }}>
              <T variant="title">{p.segment === 'kids' ? 'Скоро 14 — переход в «Старт»' : 'Открыть карту «Старт»'}</T>
              <T variant="small" muted>
                {p.segment === 'kids' ? 'Без новой заявки, всё сохранится' : 'Бесплатно, за минуту'}
              </T>
            </View>
            <Icon name="chevron" color={c.muted} />
          </Card>
        </Enter>
      ) : null}

      {/* Уровень и копилка */}
      <Enter delay={stagger(5)} style={[styles.pad, styles.duo]}>
        <Card onPress={() => router.push('/profile')} style={styles.small}>
          <IconTile name="star" color="#16171d" bg={c.lime} size={40} />
          <T variant="title" style={{ marginTop: 12 }}>
            Уровень {level}
          </T>
          <T variant="caption" muted style={{ marginBottom: 8 }}>
            {acc.xp % 100} / 100 XP
          </T>
          <Progress value={(acc.xp % 100) / 100} gradient={gradients.logo} />
        </Card>
        <Card onPress={() => router.push('/goals')} style={styles.small}>
          <IconTile name="piggy" color={c.sky} bg={alpha(c.sky, 0.15)} size={40} />
          <T variant="title" style={{ marginTop: 12 }} numberOfLines={1}>
            {goal ? goal.title : 'Копилка'}
          </T>
          <T variant="caption" muted style={{ marginBottom: 8 }} numberOfLines={1}>
            {goal ? `${rub(goal.saved)} из ${rub(goal.target)}` : 'Поставьте первую цель'}
          </T>
          <Progress value={goal ? goal.saved / goal.target : 0} color={c.sky} />
        </Card>
      </Enter>

      <Enter delay={stagger(6)} style={[styles.pad, { marginTop: 14 }]}>
        <BankSeesCard live={live} />
      </Enter>

      <Enter delay={stagger(7)} style={[styles.pad, { marginTop: 14 }]}>
        <Card onPress={() => router.push('/shield')} style={styles.rowCard}>
          <IconTile name="shield" color={c.lime} bg={c.night} />
          <View style={{ flex: 1 }}>
            <T variant="title">Предлагают «лёгкую подработку»?</T>
            <T variant="small" muted>
              Проверьте сообщение — покажем признаки мошенничества
            </T>
          </View>
          <Icon name="chevron" color={c.muted} />
        </Card>
      </Enter>

      <Enter delay={stagger(8)} style={[styles.pad, { marginTop: 14 }]}>
        <SpendingCard txs={acc.transactions} />
      </Enter>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 6, right: 6, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  action: { alignItems: 'center', gap: 8, width: 76 },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  play: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 26, overflow: 'hidden' },
  playIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  duo: { flexDirection: 'row', gap: 12, marginTop: 14 },
  small: { flex: 1, padding: 16 },
})
