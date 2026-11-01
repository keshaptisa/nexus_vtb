// Оценка риска: полукруглая шкала со стрелкой и линейная полоска с порогами 0.4 и 0.7.
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import type { RiskLevel } from '@/engine/types'
import { fonts, riskColor } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Progress } from './ui/kit'
import { T } from './ui/text'

const AnimatedPath = Animated.createAnimatedComponent(Path)

const R = 80
const CX = 100
const CY = 100
const ARC = Math.PI * R // длина полуокружности

const point = (v: number, r = R) => {
  const a = Math.PI * (1 - v)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}

/** Полукруглая шкала: 0 слева, 1 справа; цвет — по уровню риска */
export function RiskGauge({ score, level, size = 220 }: { score: number; level: RiskLevel; size?: number }) {
  const { c } = useTheme()
  const v = useSharedValue(0)
  useEffect(() => {
    v.set(withTiming(score, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [score, v])

  const arc = useAnimatedProps(() => ({ strokeDashoffset: ARC * (1 - Math.max(v.get(), 0.02)) }))
  // Стрелка: треугольник от центра к точке на шкале. Пересчитываем путь, а не поворот — так работает везде
  const needle = useAnimatedProps(() => {
    const a = Math.PI * (1 - v.get())
    const tip = R - 22
    const tx = CX + tip * Math.cos(a)
    const ty = CY - tip * Math.sin(a)
    const nx = Math.sin(a) * 5
    const ny = Math.cos(a) * 5
    return { d: `M${tx} ${ty} L${CX - nx} ${CY - ny} L${CX + nx} ${CY + ny} Z` }
  })
  const color = riskColor[level]
  const [x40, y40] = point(0.4, R + 14)
  const [x70, y70] = point(0.7, R + 14)

  return (
    <View style={{ width: size, height: size * 0.62, alignItems: 'center' }}>
      <Svg width={size} height={size * 0.62} viewBox="0 0 200 124">
        <Path d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`} stroke={c.line} strokeWidth={16} strokeLinecap="round" fill="none" />
        <AnimatedPath
          d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          stroke={color}
          strokeWidth={16}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[ARC, ARC]}
          animatedProps={arc}
        />
        <Circle cx={x40} cy={y40} r={2.5} fill={c.muted} />
        <Circle cx={x70} cy={y70} r={2.5} fill={c.muted} />
        <AnimatedPath fill={c.ink} animatedProps={needle} />
        <Circle cx={CX} cy={CY} r={9} fill={c.ink} />
        <Circle cx={CX} cy={CY} r={4} fill={c.surface} />
      </Svg>
      <View style={styles.gaugeLabels}>
        <T variant="caption" muted>0</T>
        <T variant="caption" muted>1.0</T>
      </View>
    </View>
  )
}

/** Линейная полоска риска с отметками порогов */
export function RiskBar({ score, level }: { score: number; level: RiskLevel }) {
  const { c } = useTheme()
  return (
    <View>
      <View>
        <Progress value={Math.max(score, 0.04)} color={riskColor[level]} height={10} />
        <View style={[styles.tick, { left: '40%', backgroundColor: c.surface }]} />
        <View style={[styles.tick, { left: '70%', backgroundColor: c.surface }]} />
      </View>
      <View style={styles.scale}>
        <T variant="caption" muted style={{ position: 'absolute', left: 0 }}>0</T>
        <T variant="caption" muted style={{ position: 'absolute', left: '37%' }}>0.4</T>
        <T variant="caption" muted style={{ position: 'absolute', left: '67%' }}>0.7</T>
        <T variant="caption" muted style={{ position: 'absolute', right: 0 }}>1.0</T>
      </View>
    </View>
  )
}

export function RiskPill({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: riskColor[level] }]}>
      <T variant="small" color="#fff" style={{ fontFamily: fonts.bold }}>
        {label}
      </T>
    </View>
  )
}

const styles = StyleSheet.create({
  gaugeLabels: { position: 'absolute', bottom: -2, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  scale: { height: 18, marginTop: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
})
