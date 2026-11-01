import { Redirect } from 'expo-router'

import AppTabs from '@/components/app-tabs'
import { useApp } from '@/store/app-store'

// Четыре раздела — по образцу структуры ВТБ Онлайн 2026 («Расти», «Живи», «Почувствуй заботу»):
// Главная · Платежи · Расти (истории, квест, копилка) · Забота (Щит, «Безопасный выход», Бит)
export default function TabsLayout() {
  const personaId = useApp((s) => s.personaId)
  if (!personaId) return <Redirect href="/welcome" />
  return <AppTabs />
}
