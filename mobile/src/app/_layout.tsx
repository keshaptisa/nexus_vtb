import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
import { Unbounded_600SemiBold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded'
import { useFonts } from 'expo-font'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { Celebrate } from '@/components/celebrate'
import { AnimatedSplash } from '@/components/logo'
import { PushHost } from '@/components/push-host'
import { ScenarioDock } from '@/components/scenario-dock'
import { ToastHost } from '@/components/toast-host'
import { useApp } from '@/store/app-store'
import { closePopup, flush, setChatOpen, useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

const TAB_ROUTES = new Set(['/', '/payments', '/grow', '/care'])

// Следит за открытыми окнами: окно сценария показываем, только когда пользователь вернулся на вкладку
function RouteWatcher() {
  const pathname = usePathname()
  const prev = useRef(pathname)
  useEffect(() => {
    // Окно банка закрыли жестом, крестиком или «назад», а не кнопкой действия (действие само убирает popup)
    if (prev.current === '/window' && pathname !== '/window' && useScenario.getState().popup) closePopup()
    prev.current = pathname
    const busy = !TAB_ROUTES.has(pathname)
    useUi.getState().set({ routeBusy: busy, path: pathname })
    setChatOpen(pathname === '/chat')
    if (!busy) {
      const t = setTimeout(flush, 350) // даём шторке закрыться
      return () => clearTimeout(t)
    }
  }, [pathname])
  return null
}

const sheet = { presentation: 'modal', headerShown: false } as const
const card = {
  presentation: 'formSheet',
  headerShown: false,
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  sheetCornerRadius: 32,
} as const

export default function RootLayout() {
  const { c, isDark } = useTheme()
  const hydrated = useApp((s) => s.hydrated)
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Unbounded_600SemiBold,
    Unbounded_800ExtraBold,
  })
  const [intro, setIntro] = useState(true)
  const ready = fontsLoaded && hydrated

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  const endIntro = useCallback(() => setIntro(false), [])

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#120b2e' }} />

  const theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: c.brand,
      background: c.page,
      card: c.surface,
      text: c.ink,
      border: c.line,
    },
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={intro ? 'light' : isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.page } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="transfer" options={sheet} />
            <Stack.Screen name="topup" options={sheet} />
            <Stack.Screen name="pay" options={sheet} />
            <Stack.Screen name="shield" options={sheet} />
            <Stack.Screen name="sos" options={sheet} />
            <Stack.Screen name="goals" options={sheet} />
            <Stack.Screen name="profile" options={sheet} />
            <Stack.Screen name="history" options={sheet} />
            <Stack.Screen name="bank" options={sheet} />
            <Stack.Screen name="assistant" options={sheet} />
            <Stack.Screen name="chat" options={sheet} />
            <Stack.Screen name="accounts" options={card} />
            <Stack.Screen name="window" options={card} />
            <Stack.Screen name="intercept" options={{ ...sheet, gestureEnabled: false }} />
            <Stack.Screen name="story/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade', headerShown: false }} />
            <Stack.Screen name="quest" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', headerShown: false }} />
          </Stack>
          <RouteWatcher />
          <ScenarioDock />
          <PushHost />
          <ToastHost />
          <Celebrate />
          {intro ? <AnimatedSplash onDone={endIntro} /> : null}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
