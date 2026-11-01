// Платежи: переводы и оплата, свои получатели, последние операции.
import { router } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { TxRow } from '@/components/finance'
import { Section, TabScreen } from '@/components/tab-screen'
import { Icon } from '@/components/ui/icon'
import { Card, IconTile, SectionHeader } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { available } from '@/engine/bank'
import { rub } from '@/engine/format'
import { profile } from '@/engine/risk'
import { useAccount } from '@/store/app-store'
import { useUi } from '@/store/ui-store'
import { fonts } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

export default function Payments() {
  const { c } = useTheme()
  const acc = useAccount()
  const recipients = useMemo(() => (acc ? [...new Set(['Мама', 'Папа', ...profile(acc).known_recipients])].slice(0, 8) : []), [acc])
  if (!acc) return null
  const recent = [...acc.transactions].reverse().slice(0, 12)

  const tiles = [
    { icon: 'send', title: 'Перевести', sub: 'Своим или по номеру', href: '/transfer', color: c.brand },
    { icon: 'plus', title: 'Пополнить', sub: 'От родителей или другого человека', href: '/topup', color: c.riskLow },
    { icon: 'bag', title: 'Оплатить', sub: 'Еда, одежда, кино, подписки', href: '/pay', color: c.pink },
    { icon: 'piggy', title: 'В копилку', sub: 'Отложить на цель', href: '/goals', color: c.sky },
  ] as const

  return (
    <TabScreen title="Платежи" subtitle={`Доступно ${rub(available(acc))}`}>
      <Section>
        <View style={styles.grid}>
          {tiles.map((t) => (
            <Card key={t.title} onPress={() => router.push(t.href)} style={styles.tile}>
              <IconTile name={t.icon} color={t.color} bg={alpha(t.color, 0.13)} />
              <View>
                <T variant="title">{t.title}</T>
                <T variant="caption" muted numberOfLines={2}>
                  {t.sub}
                </T>
              </View>
            </Card>
          ))}
        </View>
      </Section>

      <Section delay={1}>
        <SectionHeader title="Свои получатели" />
        <View style={styles.people}>
          {recipients.map((name) => (
            <PressableScale
              key={name}
              haptic
              onPress={() => {
                useUi.getState().set({ transferPrefill: { to: name } })
                router.push('/transfer')
              }}
              style={styles.person}
            >
              <View style={[styles.personAvatar, { backgroundColor: c.surface }]}>
                <T style={[styles.personLetter, { color: c.brand }]}>{name[0]}</T>
              </View>
              <T variant="caption" numberOfLines={1} center style={{ fontFamily: fonts.semibold }}>
                {name.replace(' (друг)', '')}
              </T>
            </PressableScale>
          ))}
          <PressableScale haptic onPress={() => router.push('/transfer')} style={styles.person}>
            <View style={[styles.personAvatar, { backgroundColor: c.brandSoft }]}>
              <Icon name="phone" size={20} color={c.brand} />
            </View>
            <T variant="caption" center style={{ fontFamily: fonts.semibold }}>
              По номеру
            </T>
          </PressableScale>
        </View>
      </Section>

      <Section delay={2}>
        <SectionHeader title="Последние операции" action="Вся история" onAction={() => router.push('/history')} />
        <Card style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          {recent.map((t, i) => (
            <View key={t.id} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : undefined}>
              <TxRow t={t} />
            </View>
          ))}
        </Card>
      </Section>
    </TabScreen>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.8%', padding: 16, gap: 14, minHeight: 140, justifyContent: 'space-between' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  person: { width: 72, alignItems: 'center', gap: 6, marginBottom: 8 },
  personAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  personLetter: { fontFamily: fonts.extrabold, fontSize: 21 },
})
