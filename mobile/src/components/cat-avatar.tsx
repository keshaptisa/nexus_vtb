// Котики-аватары героев. У каждого свой окрас и деталь, которая говорит о герое:
// Артём — серый полосатый в наушниках, Дима — рыжий в худи, Катя — трёхцветная в фартуке бариста,
// Соня — рыжий котёнок с бантиком, Лев — чёрный кот в очках и с бабочкой (ходит в театр по «Пушкинской карте»).
// Моргают раз в несколько секунд; при «уменьшении движения» — не моргают.
import { useEffect, useId } from 'react'
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { personaTint } from '@/theme/tokens'

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

type Accessory = 'headphones' | 'hood' | 'apron' | 'bow' | 'tux'

interface Cat {
  fur: string
  dark: string // полоски и тени
  muzzle: string
  earIn: string
  cloth: string
  acc: Accessory
  eyes: 'dark' | 'lime'
  eyeScale?: number
  stripes?: boolean
  calico?: { orange: string; brown: string }
  line: string // рот и усы
}

const CATS: Record<string, Cat> = {
  artem: { fur: '#a9b1c3', dark: '#7d869b', muzzle: '#f1f3f8', earIn: '#f6b8ca', cloth: '#5b3df5', acc: 'headphones', eyes: 'dark', stripes: true, line: '#2a2c38' },
  dima: { fur: '#f3a85c', dark: '#d9802f', muzzle: '#fff2e4', earIn: '#f9b9a7', cloth: '#ff6b5a', acc: 'hood', eyes: 'dark', stripes: true, line: '#3a2418' },
  katya: {
    fur: '#fbf4ea',
    dark: '#d8c9b6',
    muzzle: '#ffffff',
    earIn: '#f7c3d0',
    cloth: '#22b07d',
    acc: 'apron',
    eyes: 'dark',
    calico: { orange: '#eda261', brown: '#5a4338' },
    line: '#3a2e29',
  },
  sonya: { fur: '#ffbb7a', dark: '#f0964d', muzzle: '#fff5ea', earIn: '#ffb3c6', cloth: '#ff9f43', acc: 'bow', eyes: 'dark', eyeScale: 1.15, line: '#4a2a17' },
  lev: { fur: '#2e3042', dark: '#1d1f2b', muzzle: '#3b3e55', earIn: '#7f6fa8', cloth: '#20212b', acc: 'tux', eyes: 'lime', line: '#c9c3e6' },
}

export function CatAvatar({
  id,
  size = 48,
  frame = 'circle',
  blink = true,
  bg,
}: {
  id: string
  size?: number
  frame?: 'circle' | 'squircle' | 'none'
  blink?: boolean
  bg?: string
}) {
  const cat = CATS[id] ?? CATS.artem
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduce = useReducedMotion()
  const lid = useSharedValue(1)

  useEffect(() => {
    if (!blink || reduce) return
    // Разные герои моргают не одновременно
    const offset = { artem: 0, dima: 700, katya: 1500, sonya: 2200, lev: 2900 }[id] ?? 0
    lid.set(
      withDelay(
        offset,
        withRepeat(withSequence(withDelay(3400, withTiming(0.08, { duration: 90 })), withTiming(1, { duration: 130 })), -1, false),
      ),
    )
  }, [blink, id, lid, reduce])

  const k = cat.eyeScale ?? 1
  const eyeL = useAnimatedProps(() => ({ ry: 8 * k * lid.get() }))
  const eyeR = useAnimatedProps(() => ({ ry: 8 * k * lid.get() }))
  const pupil = useAnimatedProps(() => ({ ry: 6 * lid.get() }))
  const pupil2 = useAnimatedProps(() => ({ ry: 6 * lid.get() }))

  const radius = frame === 'circle' ? 60 : frame === 'squircle' ? 36 : 0
  const tint = bg ?? personaTint[id]?.light ?? '#ece7ff'
  const clip = `cat-clip-${uid}`
  const glow = `cat-glow-${uid}`

  const face = (
    <G>
      {/* Тело и одежда */}
      {cat.acc === 'hood' ? (
        <Path d="M12 82 C8 40 30 18 60 18 C90 18 112 40 108 82 C106 98 92 106 60 106 C28 106 14 98 12 82 Z" fill={cat.cloth} />
      ) : null}
      <Path d="M14 122 C16 105 33 96 60 96 C87 96 104 105 106 122 Z" fill={cat.cloth} />
      {cat.acc === 'apron' ? (
        <G>
          <Path d="M40 122 L42 104 C48 100 72 100 78 104 L80 122 Z" fill="#ffffff" opacity={0.9} />
          <Line x1="44" y1="104" x2="50" y2="97" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <Line x1="76" y1="104" x2="70" y2="97" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <Rect x="54" y="108" width="12" height="7" rx="2" fill={cat.cloth} opacity={0.5} />
        </G>
      ) : null}
      {cat.acc === 'tux' ? <Path d="M50 96 L60 116 L70 96 Z" fill="#ffffff" /> : null}
      {cat.acc === 'hood' ? (
        <G>
          <Line x1="52" y1="100" x2="50" y2="114" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <Line x1="68" y1="100" x2="70" y2="114" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        </G>
      ) : null}

      {/* Уши */}
      <Path d="M27 52 C24 36 28 20 33 13 C41 19 50 28 55 37 Z" fill={cat.calico ? cat.calico.orange : cat.fur} />
      <Path d="M93 52 C96 36 92 20 87 13 C79 19 70 28 65 37 Z" fill={cat.calico ? cat.calico.brown : cat.fur} />
      <Path d="M32 45 C31 35 33 27 36 22 C41 27 46 32 49 37 Z" fill={cat.earIn} />
      <Path d="M88 45 C89 35 87 27 84 22 C79 27 74 32 71 37 Z" fill={cat.earIn} />

      {/* Голова */}
      <Ellipse cx="60" cy="65" rx="38" ry="32" fill={cat.fur} />
      {cat.calico ? (
        <G>
          <Ellipse cx="45" cy="47" rx="13" ry="10" fill={cat.calico.orange} />
          <Ellipse cx="80" cy="52" rx="9" ry="8" fill={cat.calico.brown} />
        </G>
      ) : null}
      {cat.stripes ? (
        <G stroke={cat.dark} strokeWidth="3.2" strokeLinecap="round">
          <Line x1="60" y1="34" x2="60" y2="43" />
          <Line x1="51" y1="36" x2="53.5" y2="44" />
          <Line x1="69" y1="36" x2="66.5" y2="44" />
          <Line x1="23" y1="64" x2="30" y2="65" />
          <Line x1="97" y1="64" x2="90" y2="65" />
        </G>
      ) : null}
      <Ellipse cx="60" cy="78" rx="17" ry="12" fill={cat.muzzle} />

      {/* Глаза */}
      {cat.eyes === 'dark' ? (
        <G>
          <AnimatedEllipse cx="46" cy="64" rx={6.5 * k} fill="#1c1d26" animatedProps={eyeL} />
          <AnimatedEllipse cx="74" cy="64" rx={6.5 * k} fill="#1c1d26" animatedProps={eyeR} />
          <Circle cx={48.4} cy={60.6} r={2.5 * k} fill="#ffffff" />
          <Circle cx={76.4} cy={60.6} r={2.5 * k} fill="#ffffff" />
          <Circle cx={44.6} cy={67} r={1.1 * k} fill="#ffffff" />
          <Circle cx={72.6} cy={67} r={1.1 * k} fill="#ffffff" />
        </G>
      ) : (
        <G>
          <AnimatedEllipse cx="46" cy="64" rx="7" fill="#c8f135" animatedProps={eyeL} />
          <AnimatedEllipse cx="74" cy="64" rx="7" fill="#c8f135" animatedProps={eyeR} />
          <AnimatedEllipse cx="46" cy="64" rx="2.3" fill="#16171d" animatedProps={pupil} />
          <AnimatedEllipse cx="74" cy="64" rx="2.3" fill="#16171d" animatedProps={pupil2} />
          <Circle cx="48" cy="61" r="1.5" fill="#ffffff" />
          <Circle cx="76" cy="61" r="1.5" fill="#ffffff" />
        </G>
      )}

      {/* Нос, рот, щёки, усы */}
      <Path d="M56 72.5 Q60 70.8 64 72.5 Q62.4 76.2 60 76.8 Q57.6 76.2 56 72.5 Z" fill="#ff8fab" />
      <Path d="M60 76.8 Q58.6 81 54.6 80 M60 76.8 Q61.4 81 65.4 80" stroke={cat.line} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Ellipse cx="38" cy="76" rx="6" ry="3.8" fill="#ff8fab" opacity={0.45} />
      <Ellipse cx="82" cy="76" rx="6" ry="3.8" fill="#ff8fab" opacity={0.45} />
      <G stroke={cat.line} strokeWidth="1.6" strokeLinecap="round" opacity={0.5}>
        <Line x1="34" y1="74" x2="17" y2="70.5" />
        <Line x1="34" y1="78.5" x2="17" y2="80" />
        <Line x1="86" y1="74" x2="103" y2="70.5" />
        <Line x1="86" y1="78.5" x2="103" y2="80" />
      </G>

      {/* Аксессуары поверх головы */}
      {cat.acc === 'headphones' ? (
        <G>
          <Path d="M24 60 C22 22 98 22 96 60" stroke={cat.cloth} strokeWidth="6" fill="none" strokeLinecap="round" />
          <Rect x="15" y="52" width="13" height="22" rx="6" fill={cat.cloth} />
          <Rect x="92" y="52" width="13" height="22" rx="6" fill={cat.cloth} />
          <Circle cx="21.5" cy="63" r="2.6" fill="#c8f135" />
          <Circle cx="98.5" cy="63" r="2.6" fill="#c8f135" />
        </G>
      ) : null}
      {cat.acc === 'bow' ? (
        <G>
          <Path d="M82 33 L71 25 L72 41 Z" fill="#ff5fa2" />
          <Path d="M82 33 L93 25 L92 41 Z" fill="#ff5fa2" />
          <Circle cx="82" cy="33" r="3.6" fill="#e0468a" />
        </G>
      ) : null}
      {cat.acc === 'tux' ? (
        <G>
          <Circle cx="46" cy="64" r="10.5" stroke="#f5c542" strokeWidth="2.2" fill="none" />
          <Circle cx="74" cy="64" r="10.5" stroke="#f5c542" strokeWidth="2.2" fill="none" />
          <Path d="M56.5 63 Q60 60.5 63.5 63" stroke="#f5c542" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <Path d="M60 101 L49 95 L49 107 Z" fill="#f0443a" />
          <Path d="M60 101 L71 95 L71 107 Z" fill="#f0443a" />
          <Rect x="57" y="98" width="6" height="6" rx="2" fill="#c7322a" />
        </G>
      ) : null}
    </G>
  )

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <ClipPath id={clip}>
          <Rect x="0" y="0" width="120" height="120" rx={radius} />
        </ClipPath>
        <RadialGradient id={glow} cx="50%" cy="40%" r="60%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {frame === 'none' ? (
        face
      ) : (
        <G clipPath={`url(#${clip})`}>
          <Rect x="0" y="0" width="120" height="120" fill={tint} />
          <Circle cx="60" cy="52" r="56" fill={`url(#${glow})`} />
          {face}
        </G>
      )}
    </Svg>
  )
}

/** Как обратиться к герою: «Играть за Артёма» */
export const ACCUSATIVE: Record<string, string> = { artem: 'Артёма', dima: 'Диму', katya: 'Катю', sonya: 'Соню', lev: 'Льва' }
