// Каркас вкладки: крупный заголовок, подзаголовок, прокрутка с отступом под нижнее меню и панель сценария.
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useScenario } from '@/store/scenario-store'
import { useTheme } from '@/theme/use-theme'

import { T } from './ui/text'
import { stagger } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

export function TabScreen({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const scenarioOn = useScenario((s) => s.scenarioId !== null)
  const dockOpen = useScenario((s) => s.expanded)
  return (
    <ScrollView
      style={{ backgroundColor: c.page }}
      contentContainerStyle={{ paddingTop: insets.top + (scenarioOn ? (dockOpen ? 200 : 76) : 14), paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
    >
      <Enter style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="h1">{title}</T>
          {subtitle ? (
            <T variant="body" muted style={{ marginTop: 4 }}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {right}
      </Enter>
      {children}
    </ScrollView>
  )
}

export function Section({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: object }) {
  return (
    <Enter delay={stagger(delay + 1)} style={[styles.section, style]}>
      {children}
    </Enter>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, marginBottom: 18 },
  section: { paddingHorizontal: 20, marginBottom: 14 },
})
