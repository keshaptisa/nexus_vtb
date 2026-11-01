// Ряд сторис на главной: плитки с иллюстрацией в градиентном кольце (пройденные — серое кольцо).
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { LESSONS, QUEST } from '@/engine/content'
import { fonts } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { StoryArt, storyTheme } from './story-art'
import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'

const SIZE = 112

function Tile({ id, title, seen, badge, onPress, index }: { id: string; title: string; seen: boolean; badge?: string; onPress: () => void; index: number }) {
  const { c } = useTheme()
  const t = storyTheme(id)
  return (
    <View>
      <PressableScale onPress={onPress} style={styles.tileWrap}>
        <LinearGradient
          colors={seen ? [c.line, c.line] : badge ? ['#c8f135', '#3cc3f0', '#5b3df5'] : ['#5b3df5', '#ff5fa2', '#c8f135']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ring}
        >
          <View style={[styles.tile, { borderColor: c.page }]}>
            <LinearGradient colors={[t.from, t.to]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.art}>
              <StoryArt id={id} uid="tile" size={84} />
            </View>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.fade} />
            <T style={styles.title} numberOfLines={2}>
              {title}
            </T>
            {badge ? (
              <View style={styles.badge}>
                <T style={styles.badgeText}>{badge}</T>
              </View>
            ) : seen ? (
              <View style={styles.check}>
                <Icon name="check" size={12} color="#22b07d" strokeWidth={3} />
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </PressableScale>
    </View>
  )
}

export function StoriesRow({ done }: { done: string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Tile id="quest" index={0} title="А что было бы, если…" badge="КВЕСТ" seen={done.includes(`quest:${QUEST.id}`)} onPress={() => router.push('/quest')} />
      {LESSONS.map((l, i) => (
        <Tile key={l.id} id={l.id} index={i + 1} title={l.short} seen={done.includes(`lesson:${l.id}`)} onPress={() => router.push(`/story/${l.id}`)} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 10, paddingVertical: 4 },
  tileWrap: { borderRadius: 30 },
  ring: { borderRadius: 30, padding: 3 },
  tile: { width: SIZE, height: SIZE, borderRadius: 27, borderWidth: 3, overflow: 'hidden' },
  art: { position: 'absolute', right: -14, top: -10 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  title: { position: 'absolute', left: 9, right: 8, bottom: 8, fontFamily: fonts.bold, fontSize: 13, lineHeight: 15, color: '#fff' },
  badge: { position: 'absolute', left: 7, top: 7, backgroundColor: '#c8f135', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 9.5, letterSpacing: 0.6, color: '#16171d' },
  check: { position: 'absolute', left: 7, top: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
})
