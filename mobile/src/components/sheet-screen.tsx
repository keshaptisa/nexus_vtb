// Каркас модального экрана: шапка с заголовком и крестиком, прокрутка, закреплённый низ с кнопкой.
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'

export function SheetScreen({
  title,
  icon,
  iconColor,
  children,
  footer,
  onBack,
  onClose,
  tone,
  scroll = true,
  bg,
}: {
  title?: ReactNode
  icon?: string
  iconColor?: string
  children: ReactNode
  footer?: ReactNode
  onBack?: () => void
  onClose?: () => void
  tone?: 'danger'
  scroll?: boolean
  bg?: string
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))
  // На iOS модальное окно — карточка под статус-баром, отступ сверху не нужен; на Android — на весь экран
  const top = Platform.OS === 'ios' ? 14 : insets.top + 8
  const accent = iconColor ?? (tone === 'danger' ? c.riskHigh : c.brand)

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, !footer && { paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: bg ?? c.surface }]}
    >
      {tone === 'danger' ? <View style={[styles.dangerStripe, { backgroundColor: c.riskHigh }]} /> : null}
      <View style={[styles.header, { paddingTop: top }]}>
        {onBack ? (
          <PressableScale onPress={onBack} style={[styles.round, { backgroundColor: c.page }]} accessibilityLabel="Назад">
            <Icon name="back" size={20} color={c.ink} strokeWidth={2.2} />
          </PressableScale>
        ) : null}
        <View style={styles.titleRow}>
          {icon ? (
            <View style={[styles.icon, { backgroundColor: accent }]}>
              <Icon name={icon} size={21} color="#fff" strokeWidth={2.1} />
            </View>
          ) : null}
          {typeof title === 'string' ? (
            <T variant="h2" style={{ flexShrink: 1 }} numberOfLines={2}>
              {title}
            </T>
          ) : (
            title
          )}
        </View>
        <PressableScale onPress={close} style={[styles.round, { backgroundColor: c.page }]} accessibilityLabel="Закрыть">
          <Icon name="close" size={18} color={c.ink} strokeWidth={2.2} />
        </PressableScale>
      </View>
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14, borderTopColor: c.line, backgroundColor: bg ?? c.surface }]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dangerStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, zIndex: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { paddingHorizontal: 20, paddingTop: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
})
