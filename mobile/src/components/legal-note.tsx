// «Основание»: формулировка из content/legal.json и ссылки на первоисточники. Раскрывается по нажатию.
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

import type { LegalItem } from '@/engine/types'
import { fonts } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'
import { EASE_OUT } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

const host = (url: string) => {
  const m = url.match(/^https?:\/\/([^/]+)/)
  return m ? m[1].replace(/^www\./, '') : url
}

export function LegalNote({ items }: { items: LegalItem[] }) {
  const { c } = useTheme()
  const [open, setOpen] = useState(false)
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '90deg' : '0deg', { duration: 150, easing: EASE_OUT }) }] }))
  if (!items.length) return null
  return (
    <View style={{ marginTop: 8 }}>
      <PressableScale onPress={() => setOpen(!open)} style={styles.toggle}>
        <Animated.View style={chevron}>
          <Icon name="chevron" size={14} color={c.brand} strokeWidth={2.5} />
        </Animated.View>
        <T variant="small" color={c.brand} style={{ fontFamily: fonts.bold }}>
          Основание
        </T>
      </PressableScale>
      {open
        ? items.map((item) => (
            <Enter kind="fade" key={item.id} style={[styles.box, { backgroundColor: c.page }]}>
              <T variant="small" style={{ fontFamily: fonts.bold }}>
                {item.short}
              </T>
              <T variant="caption" style={{ marginTop: 4, opacity: 0.8 }}>
                {item.full}
              </T>
              {item.sources.map((src) => {
                const [url, ...rest] = src.split(' — ')
                return (
                  <PressableScale key={src} onPress={() => WebBrowser.openBrowserAsync(url).catch(() => {})} style={{ marginTop: 6 }}>
                    <T variant="caption" color={c.brand} style={{ textDecorationLine: 'underline' }}>
                      {rest.join(' — ') || host(url)}
                    </T>
                  </PressableScale>
                )
              })}
            </Enter>
          ))
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  box: { marginTop: 6, borderRadius: 14, padding: 12 },
})
