// Бит — помощник раздела «Старт». Отвечает по правилам на телефоне: без сети и без LLM.
import { router } from 'expo-router'
import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native'

import { Bubble, ChatHeader, TypingDots } from '@/components/chat'
import { Mascot } from '@/components/mascot'
import { Icon } from '@/components/ui/icon'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { reply } from '@/engine/assistant'
import { getAccount } from '@/store/app-store'
import { lastRecruiterMessage } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

const ACTIONS: Record<string, string> = { 'Открыть «Безопасный выход»': 'open_sos', 'Открыть проверку': 'open_shield' }

function openAction(action: string) {
  if (action === 'open_sos') router.replace('/sos')
  if (action === 'open_shield') {
    useUi.getState().set({ shieldText: lastRecruiterMessage() })
    router.replace('/shield')
  }
}

export default function Assistant() {
  const { c } = useTheme()
  const messages = useUi((s) => s.bit)
  const suggestions = useUi((s) => s.bitSuggestions)
  const ask = useUi((s) => s.bitAsk)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)

  useEffect(() => {
    useUi.getState().readBit()
  }, [messages.length])

  const send = (text: string) => {
    if (!text.trim()) return
    if (ACTIONS[text]) return openAction(ACTIONS[text])
    const ui = useUi.getState()
    ui.addBit({ role: 'user', text })
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const acc = getAccount()
      const r = acc ? reply(acc, text) : { reply: 'Сначала выберите героя.', suggestions: [], action: null }
      setTyping(false)
      ui.addBit({ role: 'bot', text: r.reply })
      ui.setBitSuggestions(
        r.action === 'open_sos' ? ['Открыть «Безопасный выход»', ...r.suggestions.filter((s) => !s.startsWith('Открыть'))] : r.suggestions,
      )
    }, 650)
  }

  // Вопрос «Спросить Бита» из окна сценария — задаём его сразу
  useEffect(() => {
    if (!ask) return
    useUi.getState().set({ bitAsk: null })
    send(ask.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.id])

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60)
    return () => clearTimeout(t)
  }, [messages.length, typing])

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: c.page }]}>
      <ChatHeader title="Бит" subtitle="Помощник «Старта» · отвечает сразу" avatar={<Mascot size={40} />} />
      <ScrollView ref={scroll} contentContainerStyle={styles.list}>
        {messages.map((m, i) => (
          <Bubble key={i} mine={m.role === 'user'} tint={m.role === 'user' ? c.brand : undefined}>
            {m.text}
          </Bubble>
        ))}
        {typing ? <TypingDots /> : null}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">
          {suggestions.map((s) => (
            <PressableScale key={s} onPress={() => send(s)} style={[styles.suggestion, { backgroundColor: c.brandSoft, borderColor: alpha(c.brand, 0.25) }]}>
              <T variant="small" color={c.brand} style={{ fontFamily: fonts.semibold }}>
                {s}
              </T>
            </PressableScale>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Задайте вопрос"
            placeholderTextColor={c.muted}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            style={[styles.input, { color: c.ink, backgroundColor: c.page }]}
          />
          <PressableScale onPress={() => send(input)} disabled={!input.trim()} style={[styles.send, { backgroundColor: c.brand }]} accessibilityLabel="Отправить">
            <Icon name="send" size={19} color="#fff" strokeWidth={2.2} />
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 14, gap: 10, paddingBottom: 24 },
  footer: { paddingTop: 10, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth },
  suggestions: { paddingHorizontal: 14, gap: 8 },
  suggestion: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 10 },
  input: { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 15.5 },
  send: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
})
