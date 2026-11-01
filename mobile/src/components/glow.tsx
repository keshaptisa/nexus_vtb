// Мягкое свечение — радиальный градиент вместо круга с жёстким краем.
import { useId } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

export function Glow({ color, size, opacity = 0.55, style }: { color: string; size: number; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const id = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={style} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
    </Svg>
  )
}
