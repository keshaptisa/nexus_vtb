// Панель сценария поверх приложения — как «живая активность»: свёрнута в пилюлю со статусом,
// по нажатию раскрывается: шаги, подсказка для жюри, переписка, «Пропустить шаг».
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SCENARIOS } from '@/engine/content'
import { setExpanded, skipStep, startScenario, stopScenario, useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { Pulse } from './ui/kit'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'
import { Enter } from '@/components/ui/enter'

export function ScenarioDock() {
  const s = useScenario()
  const busy = useUi((u) => u.routeBusy)
  const insets = useSafeAreaInsets()
  const { c } = useTheme()
  if (!s.scenarioId || busy) return null

  const scenario = SCENARIOS[s.scenarioId]
  const step = scenario.steps[s.stepIndex]
  const last = s.stepIndex >= s.stepsCount - 1
  const status = s.waiting ?? (s.typing ? 'Вам пишут…' : step.title)

  return (
    <Enter
     
     
      style={[styles.wrap, { top: insets.top + 6 }]}
    >
      <View style={[styles.card, { backgroundColor: c.night, shadowColor: c.shadow }]}>
        <Pressable onPress={() => setExpanded(!s.expanded)} style={styles.pill} accessibilityRole="button">
          {s.waiting ? <Pulse color={c.lime} /> : <View style={[styles.dot, { backgroundColor: c.lime }]} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="caption" color={alpha('#ffffff', 0.6)} style={{ fontFamily: fonts.bold }}>
              СЦЕНАРИЙ · {s.stepIndex + 1}/{s.stepsCount}
            </T>
            <T variant="small" color="#fff" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
              {status}
            </T>
          </View>
          {s.chat.length ? (
            <PressableScale onPress={() => router.push('/chat')} style={[styles.round, { backgroundColor: alpha('#ffffff', 0.12) }]}>
              <Icon name="chat" size={18} color="#fff" />
              {s.unread ? (
                <View style={[styles.badge, { backgroundColor: c.coral }]}>
                  <T variant="caption" color="#fff" style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                    {s.unread}
                  </T>
                </View>
              ) : null}
            </PressableScale>
          ) : null}
          <Icon name={s.expanded ? 'chevronDown' : 'chevron'} size={18} color={alpha('#ffffff', 0.6)} />
        </Pressable>

        {s.expanded ? (
          <Enter kind="fade" style={styles.body}>
            <View style={styles.bars}>
              {Array.from({ length: s.stepsCount }).map((_, i) => (
                <View key={i} style={[styles.bar, { backgroundColor: i <= s.stepIndex ? c.lime : alpha('#ffffff', 0.18) }]} />
              ))}
            </View>
            <T variant="title" color="#fff">
              {step.title}
            </T>
            {step.hint ? (
              <T variant="small" color={alpha('#ffffff', 0.72)} style={{ marginTop: 2 }}>
                {step.hint.replace('следите за панелью справа', 'следите за «Что видит банк»')}
              </T>
            ) : null}
            <View style={styles.actions}>
              <DockButton icon="reset" label="Сначала" onPress={startScenario} />
              <DockButton icon="close" label="Выйти" onPress={stopScenario} />
              <View style={{ flex: 1 }} />
              <DockButton icon="next" label={last ? 'Пройден' : 'Пропустить'} onPress={skipStep} disabled={last} accent />
            </View>
          </Enter>
        ) : null}
      </View>
    </Enter>
  )
}

function DockButton({ icon, label, onPress, disabled, accent }: { icon: string; label: string; onPress: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.dockButton, { backgroundColor: accent ? '#c8f135' : alpha('#ffffff', 0.12) }]}
    >
      <Icon name={icon} size={15} color={accent ? '#16171d' : '#fff'} strokeWidth={2.2} />
      <T variant="small" color={accent ? '#16171d' : '#fff'} style={{ fontFamily: fonts.bold }}>
        {label}
      </T>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 700, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 26,
    overflow: 'hidden',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  body: { paddingHorizontal: 16, paddingBottom: 14 },
  bars: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dockButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
})
