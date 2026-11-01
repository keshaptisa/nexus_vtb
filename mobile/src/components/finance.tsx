// Операции: строка истории, кольцо трат за месяц, карточка «Что видит банк».
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle, G } from 'react-native-svg'

import { formatDate, plural, rub } from '@/engine/format'
import type { LiveRisk, Transaction } from '@/engine/types'
import { CATEGORIES, fonts, riskColor, riskLabel } from '@/theme/tokens'
import { alpha, mix, useTheme } from '@/theme/use-theme'

import { RiskBar, RiskPill } from './risk'
import { Icon } from './ui/icon'
import { Card, Chip, IconTile } from './ui/kit'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'

export const categoryOf = (t: Transaction) => (CATEGORIES[t.category ?? ''] ? t.category! : t.channel === 'sbp' ? 'transfers' : 'other')

/** Человеческое описание операции: что это, каким способом и от кого / кому */
export function describe(t: Transaction): string {
  if (t.direction === 'in') {
    if (t.channel === 'salary') return 'Зачисление зарплаты или стипендии'
    if (t.frozen) return 'Входящий по СБП · заморожен, банк вернёт отправителю'
    if (t.flagged || t.is_new_counterparty) return 'Входящий по СБП от незнакомого отправителя'
    return 'Входящий по СБП от своего отправителя'
  }
  if (t.channel === 'card') return `Оплата картой · ${CATEGORIES[categoryOf(t)].label}`
  if (t.is_new_counterparty) return 'Перевод по СБП · новый получатель'
  return 'Перевод по СБП · из ваших контактов'
}

export function TxRow({ t }: { t: Transaction }) {
  const { c } = useTheme()
  const cat = categoryOf(t)
  const suspicious = t.flagged && !t.frozen
  const tint = suspicious ? c.riskHigh : t.direction === 'in' ? c.brand : CATEGORIES[cat].color
  return (
    <View style={styles.row}>
      <IconTile
        name={suspicious ? 'alert' : t.direction === 'in' ? 'plus' : CATEGORIES[cat].icon}
        color={tint}
        bg={mix(tint, c.surface, 0.13)}
        size={44}
        iconSize={20}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="title" numberOfLines={1}>
          {t.counterparty}
        </T>
        <T variant="caption" muted numberOfLines={1}>
          {describe(t)}
        </T>
        <T variant="caption" muted style={{ opacity: 0.8 }}>
          {formatDate(t.ts)}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T
          variant="title"
          color={t.frozen ? c.muted : t.direction === 'in' ? c.riskLow : c.ink}
          style={[{ fontVariant: ['tabular-nums'] }, t.frozen && { textDecorationLine: 'line-through' }]}
        >
          {t.direction === 'in' ? '+' : '−'}
          {rub(t.amount)}
        </T>
        {suspicious ? (
          <T variant="caption" color={c.riskHigh} style={{ fontFamily: fonts.bold }}>
            Под проверкой
          </T>
        ) : null}
        {t.frozen ? (
          <T variant="caption" color={c.brand} style={{ fontFamily: fonts.bold }}>
            Заморожено
          </T>
        ) : null}
      </View>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const R = 62
const C = 2 * Math.PI * R
const INCOME = ['#5b3df5', '#3cc3f0', '#22b07d', '#ff9f43', '#ff5fa2', '#b7bccb']
const SUSPICIOUS = 'Под проверкой'

function Segment({ color, start, len, delay }: { color: string; start: number; len: number; delay: number }) {
  const v = useSharedValue(0)
  useEffect(() => {
    v.set(0)
    v.set(withTiming(1, { duration: 700 + delay, easing: Easing.out(Easing.cubic) }))
  }, [len, start, v, delay])
  const props = useAnimatedProps(() => ({ strokeDasharray: `${Math.max(len * v.get() - 3, 0.1)} ${C}` }))
  return (
    <AnimatedCircle
      cx={80}
      cy={80}
      r={R}
      fill="none"
      stroke={color}
      strokeWidth={16}
      strokeDashoffset={-start}
      strokeLinecap="round"
      animatedProps={props}
    />
  )
}

/** Операции за месяц: кольцо и список по категориям — как в веб-кабинетах банков */
export function SpendingCard({ txs }: { txs: Transaction[] }) {
  const { c } = useTheme()
  const [tab, setTab] = useState<'out' | 'in'>('out')
  const items = useMemo(() => {
    const monthAgo = Date.now() - 31 * 86_400_000
    const groups = new Map<string, number>()
    for (const t of txs) {
      if (t.direction !== tab || new Date(t.ts).getTime() < monthAgo) continue
      const key = tab === 'out' ? categoryOf(t) : t.flagged ? SUSPICIOUS : t.counterparty
      groups.set(key, (groups.get(key) ?? 0) + t.amount)
    }
    return [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({
        key,
        value,
        label: tab === 'out' ? CATEGORIES[key].label : key,
        color: tab === 'out' ? CATEGORIES[key].color : key === SUSPICIOUS ? c.riskHigh : INCOME[i % INCOME.length],
      }))
  }, [txs, tab, c.riskHigh])
  const total = items.reduce((s, x) => s + x.value, 0)
  let offset = 0

  return (
    <Card style={styles.spending}>
      <View style={styles.spendHead}>
        <T variant="h3">Операции за месяц</T>
        <PressableScale onPress={() => router.push('/history')} style={styles.link}>
          <T variant="small" color={c.brand} style={{ fontFamily: fonts.bold }}>
            История
          </T>
          <Icon name="chevron" size={14} color={c.brand} strokeWidth={2.4} />
        </PressableScale>
      </View>
      <View style={styles.tabs}>
        <Chip label="Траты" active={tab === 'out'} onPress={() => setTab('out')} />
        <Chip label="Пополнения" active={tab === 'in'} onPress={() => setTab('in')} />
      </View>
      <View style={styles.spendBody}>
        <View style={styles.ring}>
          <Svg width={160} height={160}>
            <Circle cx={80} cy={80} r={R} fill="none" stroke={c.page} strokeWidth={16} />
            <G transform="rotate(-90 80 80)">
              {items.map((x, i) => {
                const len = total ? (x.value / total) * C : 0
                const el = <Segment key={`${tab}-${x.key}`} color={x.color} start={offset} len={len} delay={i * 60} />
                offset += len
                return el
              })}
            </G>
          </Svg>
          <View style={styles.ringCenter}>
            <T variant="title" style={{ fontVariant: ['tabular-nums'] }}>
              {rub(total)}
            </T>
            <T variant="caption" muted>
              {tab === 'out' ? 'траты' : 'пополнения'}
            </T>
          </View>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {items.length === 0 ? (
            <T variant="small" muted>
              Операций пока нет
            </T>
          ) : null}
          {items.slice(0, 5).map((x) => (
            <View key={x.key} style={styles.legend}>
              <View style={[styles.dot, { backgroundColor: x.color }]} />
              <T variant="small" style={{ flex: 1 }} numberOfLines={1}>
                {x.label}
              </T>
              <T variant="caption" muted>
                {total ? Math.round((x.value / total) * 100) : 0}%
              </T>
            </View>
          ))}
        </View>
      </View>
    </Card>
  )
}

/** Компактная карточка «Что видит банк» — полный разбор открывается отдельным окном */
export function BankSeesCard({ live }: { live: LiveRisk }) {
  const { c } = useTheme()
  const n = live.signals.length
  return (
    <Card onPress={() => router.push('/bank')} style={styles.bank}>
      <View style={styles.bankHead}>
        <IconTile name="eye" color={c.brand} bg={c.brandSoft} size={38} iconSize={18} />
        <T variant="h3" style={{ flex: 1 }}>
          Что видит банк
        </T>
        <RiskPill level={live.level} label={`${riskLabel[live.level]} риск`} />
      </View>
      <View style={{ marginTop: 16 }}>
        <RiskBar score={live.score} level={live.level} />
      </View>
      <T variant="small" muted style={{ marginTop: 4 }} numberOfLines={2}>
        {n ? `${n} ${plural(n, ['сигнал', 'сигнала', 'сигналов'])}: ${live.signals[0]}` : 'Операции совпадают с вашим обычным поведением'}
      </T>
      <View style={[styles.link, { marginTop: 8 }]}>
        <T variant="bodyStrong" color={c.brand}>
          Подробнее
        </T>
        <Icon name="chevron" size={16} color={c.brand} strokeWidth={2.3} />
      </View>
      {live.level === 'high' ? <View style={[styles.glow, { backgroundColor: alpha(riskColor.high, 0.08) }]} pointerEvents="none" /> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  spending: { padding: 20 },
  spendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  spendBody: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  ring: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bank: { padding: 20, overflow: 'hidden' },
  bankHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28 },
})
