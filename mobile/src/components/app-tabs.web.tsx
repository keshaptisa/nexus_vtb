// Нижнее меню в браузере — повторяет вид меню на телефоне (нативное меню в вебе рисуется сверху).
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { T } from './ui/text'

const ITEMS = [
  { name: 'index', href: '/', label: 'Главная', icon: 'home' },
  { name: 'payments', href: '/payments', label: 'Платежи', icon: 'swap' },
  { name: 'grow', href: '/grow', label: 'Расти', icon: 'sparkles' },
  { name: 'care', href: '/care', label: 'Забота', icon: 'heart' },
] as const

function TabButton({ isFocused, label, icon, dot, onPress }: TabTriggerSlotProps & { label: string; icon: string; dot?: boolean }) {
    const { c } = useTheme()
    const color = isFocused ? c.brand : c.muted
    return (
      <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={styles.tab}>
        <View style={[styles.iconWrap, isFocused && { backgroundColor: alpha(c.brand, 0.12) }]}>
          <Icon name={icon} size={22} color={color} strokeWidth={isFocused ? 2.3 : 1.9} />
          {dot ? <View style={[styles.dot, { backgroundColor: c.coral, borderColor: c.surface }]} /> : null}
        </View>
        <T variant="caption" color={color} style={{ fontFamily: isFocused ? fonts.bold : fonts.medium }}>
          {label}
        </T>
      </Pressable>
    )
}

export default function AppTabs() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const unreadBit = useUi((s) => s.bitUnread)
  const waiting = useScenario((s) => s.waiting)
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={[styles.bar, { backgroundColor: alpha(c.surface, 0.96), borderTopColor: c.line, paddingBottom: insets.bottom + 6 }]}>
        {ITEMS.map((it) => (
          <TabTrigger key={it.name} name={it.name} href={it.href} asChild>
            <TabButton label={it.label} icon={it.icon} dot={it.name === 'care' && (unreadBit > 0 || !!waiting)} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { alignItems: 'center', gap: 2, minWidth: 72 },
  iconWrap: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 2, right: 12, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
})
