// Квест «А что было бы, если…»: переписка с вербовщиком, ответы выбирает пользователь, четыре финала.
import { LinearGradient } from 'expo-linear-gradient'
import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bubble, ChatHeader, TypingDots } from '@/components/chat'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { QUEST } from '@/engine/content'
import * as svc from '@/engine/services'
import type { QuestNode } from '@/engine/types'
import { useApp } from '@/store/app-store'
import { useUi } from '@/store/ui-store'
import { fonts, gradients } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

interface Line {
  from: 'them' | 'me' | 'bank' | 'narrator'
  text: string
  ending?: 'good' | 'bad'
}

const byId = Object.fromEntries(QUEST.nodes.map((n) => [n.id, n])) as Record<string, QuestNode>

export default function QuestScreen() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [lines, setLines] = useState<Line[]>([])
  const [node, setNode] = useState<QuestNode | null>(null)
  const [typing, setTyping] = useState(false)
  const [gained, setGained] = useState<number | null>(null)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const run = useRef(0)

  const show = (n: QuestNode) => {
    const id = run.current
    setTyping(true)
    setTimeout(
      () => {
        if (id !== run.current) return
        setTyping(false)
        setLines((l) => [...l, { from: n.speaker === 'recruiter' ? 'them' : n.speaker, text: n.text, ending: n.ending }])
        setNode(n)
        if (n.ending === 'good') {
          const xp = useApp.getState().mutate((acc) => svc.awardQuest(acc))
          setGained(xp)
          useUi.getState().celebrateXp(xp)
        } else if (n.ending) setGained(0)
      },
      n.speaker === 'recruiter' ? 900 : 500,
    )
  }

  const restart = () => {
    run.current += 1
    setLines([])
    setGained(null)
    setNode(null)
    show(byId[QUEST.start])
  }

  useEffect(() => {
    restart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(t)
  }, [lines, typing])

  const choose = (text: string, next: string) => {
    setLines((l) => [...l, { from: 'me', text }])
    setNode(null)
    show(byId[next])
  }

  return (
    <View style={[styles.root, { backgroundColor: c.chat }]}>
      <ChatHeader
        title="Работа | Подработка"
        subtitle={typing ? 'печатает…' : `Квест · ${QUEST.title}`}
        avatar={
          <View style={[styles.avatar, { backgroundColor: c.night }]}>
            <Icon name="chat" size={18} color="#fff" />
          </View>
        }
      />
      <ScrollView ref={scroll} contentContainerStyle={styles.list}>
        <View style={[styles.intro, { backgroundColor: alpha(c.surface, 0.75) }]}>
          <T variant="small" muted center>
            {QUEST.intro}
          </T>
        </View>
        {lines.map((l, i) => {
          if (l.from === 'me') return <Bubble key={i} mine>{l.text}</Bubble>
          if (l.from === 'them') return <Bubble key={i}>{l.text}</Bubble>
          if (l.from === 'bank')
            return (
              <Enter key={i} style={[styles.bank, { backgroundColor: c.surface, borderLeftColor: c.riskHigh }]}>
                <Icon name="alert" size={20} color={c.riskHigh} />
                <View style={{ flex: 1 }}>
                  <T variant="caption" color={c.riskHigh} style={{ fontFamily: fonts.bold }}>
                    Уведомление банка
                  </T>
                  <T variant="small">{l.text}</T>
                </View>
              </Enter>
            )
          if (l.ending) {
            const good = l.ending === 'good'
            return (
              <Enter key={i} style={styles.ending}>
                <LinearGradient colors={good ? gradients.good : gradients.danger} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <T variant="h3" color="#fff">
                  {good ? 'Хороший финал' : 'Плохой финал'}
                </T>
                <T variant="body" color="rgba(255,255,255,0.92)" style={{ marginTop: 4 }}>
                  {l.text}
                </T>
              </Enter>
            )
          }
          return (
            <Enter key={i} style={[styles.narrator, { backgroundColor: c.surface }]}>
              <T variant="small" muted>
                {l.text}
              </T>
            </Enter>
          )
        })}
        {typing ? <TypingDots /> : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
        {node && !node.ending
          ? node.choices.map((ch, k) => (
              <Enter key={ch.next + ch.text}>
                <PressableScale haptic onPress={() => choose(ch.text, ch.next)} style={[styles.choice, { backgroundColor: c.brandSoft, borderColor: alpha(c.brand, 0.2) }]}>
                  <T variant="bodyStrong" color={c.brand}>
                    {ch.text}
                  </T>
                </PressableScale>
              </Enter>
            ))
          : null}
        {node?.ending ? (
          <>
            {node.ending === 'good' && gained !== null ? (
              <T variant="small" color={c.ok} center style={{ fontFamily: fonts.semibold }}>
                {gained ? `+${gained} XP и бейдж «Не на того напали»` : 'Квест уже пройден — очки получены раньше'}
              </T>
            ) : null}
            <Button kind="ghost" icon="reset" title="Пройти ещё раз" onPress={restart} />
          </>
        ) : null}
        {!node ? (
          <T variant="small" muted center style={{ paddingVertical: 10 }}>
            …
          </T>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, gap: 10 },
  intro: { borderRadius: 16, padding: 12, marginHorizontal: 12 },
  bank: { flexDirection: 'row', gap: 10, borderRadius: 16, borderLeftWidth: 4, padding: 12 },
  ending: { borderRadius: 24, padding: 18, overflow: 'hidden' },
  narrator: { borderRadius: 16, padding: 12 },
  footer: { padding: 14, gap: 8 },
  choice: { borderWidth: 2, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13 },
})
