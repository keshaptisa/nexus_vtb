// Смена героя — шторка со всеми пятью персонажами. Вход за героя сбрасывает его счёт к исходному.
import { router } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CatAvatar } from '@/components/cat-avatar'
import { Icon } from '@/components/ui/icon'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { PERSONA_IDS, PERSONA_TAGS, RAW_PERSONAS } from '@/engine/content'
import { useApp } from '@/store/app-store'
import { enterAs } from '@/store/session'
import { alpha, useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

export default function Accounts() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const current = useApp((s) => s.personaId)
  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={[styles.root, { paddingBottom: insets.bottom + 18 }]}>
      <T variant="h2">Сменить героя</T>
      <T variant="small" muted style={{ marginTop: 4, marginBottom: 14 }}>
        У каждого героя свой сценарий. Счёт при входе начинается с чистого листа.
      </T>
      {PERSONA_IDS.map((id, i) => {
        const p = RAW_PERSONAS[id]
        const on = id === current
        return (
          <Enter key={id}>
            <PressableScale
              haptic
              onPress={() => {
                enterAs(id)
                router.dismissAll()
              }}
              style={[styles.row, { backgroundColor: on ? alpha(c.brand, 0.08) : 'transparent', borderColor: on ? alpha(c.brand, 0.35) : 'transparent' }]}
            >
              <CatAvatar id={id} size={52} frame="squircle" />
              <View style={{ flex: 1 }}>
                <T variant="title">
                  {p.name}, {p.age}
                </T>
                <T variant="small" muted>
                  {PERSONA_TAGS[id]}
                </T>
              </View>
              {on ? <Icon name="check" size={20} color={c.brand} strokeWidth={2.6} /> : <Icon name="chevron" color={c.muted} />}
            </PressableScale>
          </Enter>
        )
      })}
      <PressableScale
        onPress={() => {
          useApp.getState().logout()
          router.dismissAll()
          router.replace('/welcome')
        }}
        style={styles.exit}
      >
        <Icon name="logout" size={18} color={c.muted} />
        <T variant="bodyStrong" muted>
          На экран выбора героя
        </T>
      </PressableScale>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { padding: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, borderWidth: 1.5 },
  exit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 12 },
})
