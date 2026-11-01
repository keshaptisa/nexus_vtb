// Забота: «Безопасный выход», Щит, Бит, «Что видит банк» и что грозит по закону — помощь 24/7.
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { BankSeesCard } from '@/components/finance'
import { LegalNote } from '@/components/legal-note'
import { Mascot } from '@/components/mascot'
import { Section, TabScreen } from '@/components/tab-screen'
import { Icon } from '@/components/ui/icon'
import { Card, SectionHeader } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { LEGAL } from '@/engine/content'
import { liveRisk } from '@/engine/risk'
import { useAccount } from '@/store/app-store'
import { lastRecruiterMessage } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { alpha, useTheme } from '@/theme/use-theme'

const LAW = ['uk187', 'age_under16', 'cbr_base', 'card_block']

export default function Care() {
  const { c } = useTheme()
  const acc = useAccount()
  const bit = useUi((s) => s.bit)
  const unread = useUi((s) => s.bitUnread)
  const live = useMemo(() => (acc ? liveRisk(acc) : null), [acc])
  if (!acc || !live) return null
  const lastBot = [...bit].reverse().find((m) => m.role === 'bot')?.text

  return (
    <TabScreen title="Забота" subtitle="Если с деньгами происходит что-то странное — здесь помогут">
      <Section>
        <PressableScale haptic onPress={() => router.push('/sos')} style={styles.sos}>
          <LinearGradient colors={['#ff6b5a', '#ff5fa2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.sosIcon}>
            <Icon name="lifebuoy" size={30} color="#ff6b5a" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="h3" color="#fff">
              Я влип — что делать?
            </T>
            <T variant="small" color="rgba(255,255,255,0.88)" style={{ marginTop: 2 }}>
              «Безопасный выход»: план по шагам, вернуть деньги через банк, черновики обращений
            </T>
          </View>
        </PressableScale>
      </Section>

      <Section delay={1}>
        <View style={styles.duo}>
          <Card
            onPress={() => {
              useUi.getState().set({ shieldText: lastRecruiterMessage() })
              router.push('/shield')
            }}
            style={[styles.half, { backgroundColor: c.night }]}
          >
            <View style={[styles.halfIcon, { backgroundColor: alpha(c.lime, 0.16) }]}>
              <Icon name="shield" size={22} color={c.lime} />
            </View>
            <T variant="title" color="#fff" style={{ marginTop: 14 }}>
              Щит
            </T>
            <T variant="caption" color="rgba(255,255,255,0.7)">
              Проверить сообщение на вербовку и мошенничество
            </T>
          </Card>
          <Card onPress={() => router.push('/assistant')} style={styles.half}>
            <View>
              <Mascot size={44} mood={unread ? 'alert' : 'calm'} />
              {unread ? <View style={[styles.unread, { backgroundColor: c.coral, borderColor: c.surface }]} /> : null}
            </View>
            <T variant="title" style={{ marginTop: 10 }}>
              Бит
            </T>
            <T variant="caption" muted numberOfLines={2}>
              {lastBot ?? 'Помощник: ответит про дропы, бюджет и мошенников'}
            </T>
          </Card>
        </View>
      </Section>

      <Section delay={2}>
        <BankSeesCard live={live} />
      </Section>

      <Section delay={3}>
        <SectionHeader title="Что грозит по закону" />
        <Card style={{ padding: 16 }}>
          {LAW.filter((k) => LEGAL[k]).map((k, i) => (
            <View key={k} style={[styles.law, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
              <T variant="bodyStrong">{LEGAL[k].short}</T>
              <LegalNote items={[LEGAL[k]]} />
            </View>
          ))}
          <T variant="caption" muted style={{ marginTop: 8 }}>
            Это не юридическая консультация. Формулировки сверены с первоисточниками.
          </T>
        </Card>
      </Section>

      <Section delay={4}>
        <Card style={styles.call}>
          <View style={[styles.callIcon, { backgroundColor: alpha(c.riskHigh, 0.12) }]}>
            <Icon name="phone" size={20} color={c.riskHigh} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="title">Угрожают прямо сейчас?</T>
            <T variant="small" muted>
              Звоните 102 — бесплатно. В банк — по номеру на обороте карты.
            </T>
          </View>
        </Card>
      </Section>
    </TabScreen>
  )
}

const styles = StyleSheet.create({
  sos: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 28, padding: 18, overflow: 'hidden' },
  sosIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  duo: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, padding: 16, minHeight: 170 },
  halfIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  unread: { position: 'absolute', top: -2, left: 34, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  law: { paddingVertical: 10 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  callIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
})

