// Нижнее меню на телефоне — нативное: Liquid Glass на iOS 26, Material 3 на Android.
import { NativeTabs } from 'expo-router/native-tabs'

import { useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'

export default function AppTabs() {
  const { c } = useTheme()
  const unreadBit = useUi((s) => s.bitUnread)
  const waiting = useScenario((s) => s.waiting)
  return (
    <NativeTabs tintColor={c.brand} backgroundColor={c.surface} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="payments">
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="swap_horiz" />
        <NativeTabs.Trigger.Label>Платежи</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="grow">
        <NativeTabs.Trigger.Icon sf={{ default: 'sparkles', selected: 'sparkles' }} md="auto_awesome" />
        <NativeTabs.Trigger.Label>Расти</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="care">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart.text.square', selected: 'heart.text.square.fill' }} md="health_and_safety" />
        <NativeTabs.Trigger.Label>Забота</NativeTabs.Trigger.Label>
        {unreadBit > 0 || waiting ? <NativeTabs.Trigger.Badge /> : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
