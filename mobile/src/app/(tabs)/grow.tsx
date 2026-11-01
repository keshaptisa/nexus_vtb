// Расти: уровень и XP, истории по событию, квест, копилка, переход в «Старт».
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { StoryArt, storyTheme } from '@/components/story-art'
import { Section, TabScreen } from '@/components/tab-screen'
import { Icon } from '@/components/ui/icon'
import { Card, IconTile, Progress, SectionHeader } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { LESSONS, QUEST } from '@/engine/content'
import { rub } from '@/engine/format'
import { useAccount } from '@/store/app-store'
import { fonts, gradients } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

export default function Grow() {
  const { c } = useTheme()
  const acc = useAccount()
  if (!acc) return null
  const done = new Set(acc.done)
  const level = 1 + Math.floor(acc.xp / 100)
  const lessonsDone = LESSONS.filter((l) => done.has(`lesson:${l.id}`)).length
  const questDone = done.has(`quest:${QUEST.id}`)

  return (
    <TabScreen title="Расти" subtitle="Финграмотность на своих событиях: зарплата, подписки, первая цель">
      <Section>
        <PressableScale onPress={() => router.push('/profile')} style={styles.level}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1.1, y: 1.2 }} style={StyleSheet.absoluteFill} />
          <View style={styles.levelRow}>
            <View style={[styles.levelBadge, { backgroundColor: c.lime }]}>
              <T style={styles.levelNum}>{level}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption" color="rgba(255,255,255,0.75)" style={{ fontFamily: fonts.bold, letterSpacing: 1 }}>
                УРОВЕНЬ {level}
              </T>
              <T variant="h3" color="#fff">
                {acc.xp} XP · ещё {100 - (acc.xp % 100)} до следующего
              </T>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Progress value={(acc.xp % 100) / 100} color={c.lime} track="rgba(255,255,255,0.25)" height={10} />
          </View>
          <T variant="small" color="rgba(255,255,255,0.8)" style={{ marginTop: 10 }}>
            Историй пройдено: {lessonsDone} из {LESSONS.length} · квест {questDone ? 'пройден' : 'ждёт'}
          </T>
        </PressableScale>
      </Section>

      <Section delay={1}>
        <PressableScale onPress={() => router.push('/quest')} style={styles.quest}>
          <LinearGradient colors={['#0b1a2e', '#1d2f6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1 }}>
            <View style={[styles.pill, { backgroundColor: c.lime }]}>
              <T style={styles.pillText}>КВЕСТ · +{QUEST.xp} XP</T>
            </View>
            <T variant="h3" color="#fff" style={{ marginTop: 10 }}>
              А что было бы, если…
            </T>
            <T variant="small" color="rgba(255,255,255,0.75)" style={{ marginTop: 4 }}>
              Переписка с вербовщиком: вы выбираете ответы. Четыре финала.
            </T>
          </View>
          <View style={styles.questArt}>
            <StoryArt id="quest" uid="grow" size={120} />
          </View>
        </PressableScale>
      </Section>

      <Section delay={2}>
        <SectionHeader title="Истории" />
        <View style={styles.grid}>
          {LESSONS.map((l) => {
            const t = storyTheme(l.id)
            const seen = done.has(`lesson:${l.id}`)
            return (
              <PressableScale key={l.id} onPress={() => router.push(`/story/${l.id}`)} style={styles.story}>
                <LinearGradient colors={[t.from, t.to]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={styles.storyArt}>
                  <StoryArt id={l.id} uid="grid" size={130} />
                </View>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.storyFade} />
                <View style={styles.storyText}>
                  <T variant="title" color="#fff" numberOfLines={2}>
                    {l.short}
                  </T>
                  <T variant="caption" color="rgba(255,255,255,0.75)">
                    {seen ? 'Пройдено' : `+${l.xp} XP`}
                  </T>
                </View>
                {seen ? (
                  <View style={styles.seen}>
                    <Icon name="check" size={13} color="#22b07d" strokeWidth={3} />
                  </View>
                ) : null}
              </PressableScale>
            )
          })}
        </View>
      </Section>

      <Section delay={3}>
        <SectionHeader title="Копилка" action="Все цели" onAction={() => router.push('/goals')} />
        {acc.goals.length ? (
          acc.goals.map((g) => (
            <Card key={g.id} onPress={() => router.push('/goals')} style={styles.goal}>
              <IconTile name="piggy" color={c.sky} bg={alpha(c.sky, 0.15)} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.goalHead}>
                  <T variant="title">{g.title}</T>
                  <T variant="small" muted>
                    {rub(g.saved)} / {rub(g.target)}
                  </T>
                </View>
                <Progress value={g.saved / g.target} gradient={gradients.lime} />
              </View>
            </Card>
          ))
        ) : (
          <Card onPress={() => router.push('/goals')} style={styles.goal}>
            <IconTile name="piggy" color={c.sky} bg={alpha(c.sky, 0.15)} />
            <View style={{ flex: 1 }}>
              <T variant="title">Поставьте первую цель</T>
              <T variant="small" muted>
                Например, наушники или концерт
              </T>
            </View>
            <Icon name="chevron" color={c.muted} />
          </Card>
        )}
      </Section>
    </TabScreen>
  )
}

const styles = StyleSheet.create({
  level: { borderRadius: 28, padding: 20, overflow: 'hidden' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelBadge: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontFamily: fonts.display, fontSize: 28, color: '#16171d' },
  quest: { flexDirection: 'row', alignItems: 'center', borderRadius: 26, padding: 18, overflow: 'hidden', gap: 6 },
  questArt: { width: 120, height: 120, flexShrink: 0 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: '#16171d' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  story: { width: '47.8%', height: 200, borderRadius: 24, overflow: 'hidden' },
  storyArt: { position: 'absolute', right: -16, top: -6 },
  storyFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
  storyText: { position: 'absolute', left: 14, right: 12, bottom: 12 },
  seen: { position: 'absolute', left: 10, top: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 10 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between' },
})
