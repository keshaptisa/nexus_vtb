// Профиль: уровень и XP, бейджи, истории, настройки безопасности, тема, сброс и смена героя.
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'

import { CatAvatar } from '@/components/cat-avatar'
import { SheetScreen } from '@/components/sheet-screen'
import { StoryArt, storyTheme } from '@/components/story-art'
import { ThemeButton } from '@/components/theme-button'
import { Icon } from '@/components/ui/icon'
import { Button, Progress } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { LESSONS, QUEST } from '@/engine/content'
import { useAccount } from '@/store/app-store'
import { resetCurrent } from '@/store/session'
import { fonts, gradients } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'
import { STAGGER_MS } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

export default function Profile() {
  const { c } = useTheme()
  const acc = useAccount()
  const minor = (acc?.persona.age ?? 18) < 18
  // Настройки безопасности — только демонстрация, никуда не отправляются
  const [settings, setSettings] = useState({ pauseStrangers: true, parentSignal: minor })
  if (!acc) return null
  const p = acc.persona
  const done = new Set(acc.done)
  const lessonsDone = LESSONS.filter((l) => done.has(`lesson:${l.id}`)).length
  const level = 1 + Math.floor(acc.xp / 100)

  const badges = [
    { id: 'first', icon: 'book', title: 'Первые шаги', text: 'Первая история', got: lessonsDone > 0 },
    { id: 'all', icon: 'star', title: 'Знаток', text: 'Все истории', got: lessonsDone === LESSONS.length },
    { id: 'quest', icon: 'shield', title: 'Не на того напали', text: 'Хороший финал квеста', got: done.has(`quest:${QUEST.id}`) },
    { id: 'exit', icon: 'lifebuoy', title: 'Безопасный выход', text: 'Все шаги выхода', got: done.has('action:safe_exit') },
  ]

  return (
    <SheetScreen title="Профиль">
      <View style={styles.who}>
        <CatAvatar id={p.id} size={72} frame="squircle" />
        <View style={{ flex: 1 }}>
          <T variant="h2">
            {p.name}, {p.age}
          </T>
          <T variant="small" muted>
            {p.description}
          </T>
        </View>
      </View>

      <Enter style={styles.level}>
        <LinearGradient colors={gradients.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.levelRow}>
          <View>
            <T variant="small" color="rgba(255,255,255,0.8)">
              Уровень
            </T>
            <T style={styles.levelNum}>{level}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T variant="h2" color="#fff">
              {acc.xp} XP
            </T>
            <T variant="small" color="rgba(255,255,255,0.8)">
              до уровня {level + 1}: {100 - (acc.xp % 100)} XP
            </T>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <Progress value={(acc.xp % 100) / 100} color={c.lime} track="rgba(255,255,255,0.25)" height={10} />
        </View>
      </Enter>

      <T variant="h3" style={styles.h}>
        Бейджи
      </T>
      <View style={styles.badges}>
        {badges.map((b, i) => (
          <Enter delay={STAGGER_MS}
            key={b.id}
           
            style={[styles.badge, { borderColor: b.got ? alpha(c.brand, 0.3) : c.line, backgroundColor: b.got ? c.brandSoft : c.surface, opacity: b.got ? 1 : 0.55 }]}
          >
            <View style={[styles.badgeIcon, { backgroundColor: b.got ? c.brand : c.page }]}>
              <Icon name={b.icon} size={22} color={b.got ? '#fff' : c.muted} />
            </View>
            <T variant="small" center style={{ fontFamily: fonts.bold, marginTop: 8 }}>
              {b.title}
            </T>
            <T variant="caption" muted center>
              {b.text}
            </T>
          </Enter>
        ))}
      </View>

      <T variant="h3" style={styles.h}>
        Истории · {lessonsDone} из {LESSONS.length}
      </T>
      {LESSONS.map((l) => {
        const seen = done.has(`lesson:${l.id}`)
        const t = storyTheme(l.id)
        return (
          <PressableScale key={l.id} onPress={() => router.push(`/story/${l.id}`)} style={styles.story}>
            <View style={styles.thumb}>
              <LinearGradient colors={[t.from, t.to]} style={StyleSheet.absoluteFill} />
              <StoryArt id={l.id} uid="profile" size={52} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="title">{l.short}</T>
              <T variant="caption" muted numberOfLines={1}>
                {l.title}
              </T>
            </View>
            <View style={[styles.xpChip, { backgroundColor: seen ? alpha(c.riskLow, 0.12) : c.page }]}>
              {seen ? <Icon name="check" size={13} color={c.ok} strokeWidth={2.8} /> : null}
              <T variant="caption" color={seen ? c.ok : c.muted} style={{ fontFamily: fonts.bold }}>
                +{l.xp} XP
              </T>
            </View>
          </PressableScale>
        )
      })}

      <T variant="h3" style={styles.h}>
        Безопасность
      </T>
      <View style={[styles.settings, { borderColor: c.line }]}>
        <Toggle
          on={settings.pauseStrangers}
          onChange={(v) => setSettings({ ...settings, pauseStrangers: v })}
          title="Пауза для денег от незнакомцев"
          text="Крупные зачисления от новых отправителей нельзя сразу переслать дальше"
        />
        {minor ? (
          <>
            <View style={[styles.divider, { backgroundColor: c.line }]} />
            <Toggle
              on={settings.parentSignal}
              onChange={(v) => setSettings({ ...settings, parentSignal: v })}
              title="Сигнал родителю при высоком риске"
              text="Родитель получит только уведомление о риске — без доступа к переписке и тратам"
            />
          </>
        ) : null}
      </View>

      <View style={styles.themeRow}>
        <T variant="bodyStrong" style={{ flex: 1 }}>
          Тема оформления
        </T>
        <ThemeButton />
      </View>

      <View style={{ gap: 8, marginTop: 18 }}>
        <Button
          kind="ghost"
          icon="reset"
          title="Сбросить счёт героя"
          onPress={() => {
            resetCurrent()
            router.back()
          }}
        />
        <Button kind="ghost" icon="users" title="Сменить героя" onPress={() => router.replace('/accounts')} />
      </View>
      <T variant="caption" muted center style={{ marginTop: 16 }}>
        «Старт» · концепт команды nexus. Все расчёты — на телефоне, данные синтетические.
      </T>
    </SheetScreen>
  )
}

function Toggle({ on, onChange, title, text }: { on: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  const { c } = useTheme()
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <T variant="title">{title}</T>
        <T variant="caption" muted>
          {text}
        </T>
      </View>
      <Switch value={on} onValueChange={onChange} trackColor={{ true: c.brand, false: c.line }} thumbColor="#fff" />
    </View>
  )
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  level: { marginTop: 18, borderRadius: 26, padding: 20, overflow: 'hidden' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  levelNum: { fontFamily: fonts.display, fontSize: 46, lineHeight: 52, color: '#fff' },
  h: { marginTop: 26, marginBottom: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: '47.8%', borderWidth: 1.5, borderRadius: 20, padding: 14, alignItems: 'center' },
  badgeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  story: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  thumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  xpChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  settings: { borderWidth: 1.5, borderRadius: 20 },
  divider: { height: StyleSheet.hairlineWidth },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  themeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
})
