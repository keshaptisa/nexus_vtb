// Мессенджер героя во время сценария: сообщения вербовщика приходят по одному с «печатает…».
import { router } from 'expo-router'
import { type ComponentRef, useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { Bubble, ChatHeader, SystemLine, TypingDots } from '@/components/chat'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/kit'
import { T } from '@/components/ui/text'
import { CHAT_TITLE, lastRecruiterMessage, useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'

export default function ScenarioChat() {
  const { c } = useTheme()
  const { scenarioId, chat, shown, typing } = useScenario()
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60)
    return () => clearTimeout(t)
  }, [shown, typing])

  return (
    <View style={[styles.root, { backgroundColor: c.chat }]}>
      <ChatHeader
        title={CHAT_TITLE[scenarioId ?? ''] ?? 'Мессенджер'}
        subtitle={typing ? 'печатает…' : 'переписка героя'}
        avatar={
          <View style={[styles.avatar, { backgroundColor: '#2aabee' }]}>
            <Icon name="chat" size={18} color="#fff" />
          </View>
        }
      />
      <ScrollView ref={scroll} contentContainerStyle={styles.list}>
        {chat.length === 0 ? (
          <T variant="small" muted center style={{ marginTop: 40 }}>
            В этом сценарии нет переписки — следите за уведомлениями банка.
          </T>
        ) : null}
        {chat.slice(0, shown).map((m, i) =>
          m.sender === 'system' ? <SystemLine key={i}>{m.text}</SystemLine> : <Bubble key={i} mine={m.sender === 'user'}>{m.text}</Bubble>,
        )}
        {typing ? <TypingDots /> : null}
      </ScrollView>
      {lastRecruiterMessage() ? (
        <View style={[styles.footer, { backgroundColor: c.surface }]}>
          <Button
            kind="ghost"
            icon="shield"
            title="Проверить сообщение в Щите"
            onPress={() => {
              useUi.getState().set({ shieldText: lastRecruiterMessage() })
              router.replace('/shield')
            }}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, gap: 10, paddingBottom: 30 },
  footer: { padding: 14, paddingBottom: 30 },
})
