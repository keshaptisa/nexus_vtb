// Иллюстрации для сторис: объёмные объекты на тёмном фоне со свечением. Перенесены с сайта
// (frontend/src/components/StoryArt.tsx) на react-native-svg; тени-фильтры CSS заменены мягким свечением.
import { useId, type ReactNode } from 'react'
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg'

export const STORY_THEME: Record<string, { from: string; to: string; glow: string }> = {
  dont_share_card: { from: '#120b2e', to: '#2b1a6b', glow: '#7c5cff' },
  spot_fraud: { from: '#2a0d16', to: '#5a1a2a', glow: '#ff6b5a' },
  safe_exit: { from: '#071d2e', to: '#0f3d5c', glow: '#3cc3f0' },
  ndfl: { from: '#0a2018', to: '#14432f', glow: '#22d38f' },
  subscriptions: { from: '#1c0b26', to: '#4a1645', glow: '#ff5fa2' },
  budget_503020: { from: '#1a1a08', to: '#3a3a10', glow: '#c8f135' },
  quest: { from: '#0b1a2e', to: '#1d2f6b', glow: '#3cc3f0' },
  pushkin_scam: { from: '#1f0d2b', to: '#4b1c4f', glow: '#ff9f43' },
}

export const storyTheme = (id: string) => STORY_THEME[id] ?? STORY_THEME.dont_share_card

export function StoryArt({ id, uid, size = 200 }: { id: string; uid: string; size?: number }) {
  const t = storyTheme(id)
  const u = `${uid}-${id}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={`${u}-glow`}>
          <Stop offset="0" stopColor={t.glow} stopOpacity="0.7" />
          <Stop offset="1" stopColor={t.glow} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`${u}-shine`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <Stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Circle cx="100" cy="100" r="90" fill={`url(#${u}-glow)`} />
      {(ART[id] ?? ART.dont_share_card)(u)}
    </Svg>
  )
}

const ART: Record<string, (u: string) => ReactNode> = {
  // Карта на крючке
  dont_share_card: (u) => (
    <G>
      <LinearGradient id={`${u}-card`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#c8f135" />
        <Stop offset="1" stopColor="#7c5cff" />
      </LinearGradient>
      <Path d="M118 18v38" stroke="#d9d9e8" strokeWidth="3" />
      <Path d="M118 56c0 14-16 16-18 6" stroke="#e8e8f2" strokeWidth="5" fill="none" strokeLinecap="round" />
      <G transform="rotate(-14 100 120)">
        <Rect x="42" y="76" width="122" height="80" rx="14" fill={`url(#${u}-card)`} />
        <Rect x="42" y="76" width="122" height="80" rx="14" fill={`url(#${u}-shine)`} />
        <Rect x="56" y="96" width="24" height="18" rx="4" fill="#fff" opacity="0.85" />
        <Rect x="56" y="128" width="62" height="7" rx="3.5" fill="#16171d" opacity="0.55" />
        <Rect x="124" y="128" width="26" height="7" rx="3.5" fill="#16171d" opacity="0.55" />
      </G>
      <Circle cx="152" cy="74" r="17" fill="#ff6b5a" />
      <Path d="M152 65v11M152 81v1" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </G>
  ),
  // Сообщение с маской
  spot_fraud: (u) => (
    <G>
      <LinearGradient id={`${u}-bubble`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#ffffff" />
        <Stop offset="1" stopColor="#ffd9d4" />
      </LinearGradient>
      <G>
        <Path d="M40 46h120a16 16 0 0 1 16 16v58a16 16 0 0 1-16 16H86l-28 22v-22H40a16 16 0 0 1-16-16V62a16 16 0 0 1 16-16z" fill={`url(#${u}-bubble)`} />
      </G>
      <Path d="M62 82c10-10 28-10 38 0 10-10 28-10 38 0-2 18-14 24-24 20-6-2-8-6-14-6s-8 4-14 6c-10 4-22-2-24-20z" fill="#16171d" />
      <Ellipse cx="81" cy="88" rx="7" ry="4.5" fill="#ff6b5a" />
      <Ellipse cx="119" cy="88" rx="7" ry="4.5" fill="#ff6b5a" />
      <Circle cx="160" cy="44" r="18" fill="#ff6b5a" />
      <Path d="M160 34v12M160 52v1" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </G>
  ),
  // Спасательный круг
  safe_exit: (u) => (
    <G>
      <Circle cx="100" cy="104" r="62" fill="#ff6b5a" />
      {[0, 90, 180, 270].map((a) => (
        <Path key={a} d="M100 42a62 62 0 0 1 30 8l-12 21a38 38 0 0 0-18-4z" fill="#fff" transform={`rotate(${a + 20} 100 104)`} />
      ))}
      <Circle cx="100" cy="104" r="34" fill="#0f3d5c" />
      <Circle cx="100" cy="104" r="62" fill={`url(#${u}-shine)`} />
      <Path d="M38 104c0-20 10-38 26-50" stroke="#fff" strokeOpacity="0.5" strokeWidth="4" fill="none" strokeLinecap="round" />
    </G>
  ),
  // Билет по «Пушкинской карте» со штампом «не продаётся» и пачка наличных-приманка
  pushkin_scam: (u) => (
    <G>
      <LinearGradient id={`${u}-ticket`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#ff9f43" />
        <Stop offset="1" stopColor="#ff5fa2" />
      </LinearGradient>
      <G transform="rotate(-10 100 110)">
        {/* билет с вырезами по бокам и линией отрыва */}
        <Path d="M44 74h112v22a11 11 0 0 0 0 22v22H44v-22a11 11 0 0 0 0-22z" fill={`url(#${u}-ticket)`} />
        <Path d="M44 74h112v22a11 11 0 0 0 0 22v22H44v-22a11 11 0 0 0 0-22z" fill={`url(#${u}-shine)`} />
        <Path d="M124 80v54" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="5 5" />
        <Rect x="58" y="88" width="50" height="8" rx="4" fill="#fff" fillOpacity="0.85" />
        <Rect x="58" y="102" width="36" height="6" rx="3" fill="#fff" fillOpacity="0.6" />
        <Rect x="58" y="114" width="42" height="6" rx="3" fill="#fff" fillOpacity="0.6" />
        <Circle cx="140" cy="107" r="8" fill="#fff" fillOpacity="0.85" />
      </G>
      {/* штамп */}
      <G transform="rotate(12 100 138)">
        <Rect x="46" y="124" width="108" height="28" rx="7" fill="#1f0d2b" fillOpacity="0.35" stroke="#ff4d5e" strokeWidth="3.5" />
        <SvgText x="100" y="143" textAnchor="middle" fontSize="12.5" fill="#ff6b78" fontFamily="Manrope_800ExtraBold" letterSpacing="0.5">НЕ ПРОДАЁТСЯ</SvgText>
      </G>
      {/* наличные-приманка */}
      <G transform="rotate(-16 62 50)">
        <Rect x="36" y="36" width="54" height="30" rx="6" fill="#22b07d" />
        <Rect x="41" y="41" width="44" height="20" rx="4" fill="none" stroke="#bff3d8" strokeWidth="2" />
        <Circle cx="63" cy="51" r="6" fill="#bff3d8" />
      </G>
    </G>
  ),
  // Монеты и 13%
  ndfl: (u) => (
    <G>
      <LinearGradient id={`${u}-coin`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#f5c542" />
        <Stop offset="0.5" stopColor="#ffe48a" />
        <Stop offset="1" stopColor="#d99a1e" />
      </LinearGradient>
      {/* Стопка: каждая монета — ребро с нижней дугой, стык и лицевая сторона; рисуем снизу вверх,
          чуть сдвигая по горизонтали, чтобы из-под верхней монеты выглядывал край нижней */}
      <G>
        {[0, 3, -2, 4, -1, 2].map((dx, k, all) => {
          const cx = 76 + dx
          const t = 150 - k * 11
          const top = k === all.length - 1
          return (
            <G key={k}>
              <Path d={`M${cx - 38} ${t}v10a38 11 0 0 0 76 0v-10z`} fill={`url(#${u}-coin)`} />
              <Path d={`M${cx - 38} ${t + 10}a38 11 0 0 0 76 0`} fill="none" stroke="#9a6410" strokeWidth="2" />
              {[-26, -13, 0, 13, 26].map((x) => (
                <Path key={x} d={`M${cx + x} ${t + 3 + Math.abs(x) / 9}v7`} stroke="#c58a1c" strokeWidth="1.6" />
              ))}
              <Ellipse cx={cx} cy={t} rx="38" ry="11" fill="#ffe08a" stroke="#d99a1e" strokeWidth="2" />
              {top && (
                <>
                  <Ellipse cx={cx} cy={t} rx="27" ry="7.5" fill="none" stroke="#e7ad2c" strokeWidth="2" />
                  <SvgText x={cx} y={t + 5} textAnchor="middle" fontSize="15" fill="#b97a10" fontFamily="Manrope_800ExtraBold">₽</SvgText>
                </>
              )}
            </G>
          )
        })}
      </G>
      {/* Одна монета улетает к «13%» — это удержанный налог */}
      <Path d="M118 96q14-14 22-22" fill="none" stroke="#22d38f" strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="round" />
      <G transform="rotate(-28 124 108)">
        <Path d="M104 108v6a20 6 0 0 0 40 0v-6z" fill={`url(#${u}-coin)`} />
        <Ellipse cx="124" cy="108" rx="20" ry="6" fill="#ffe08a" stroke="#d99a1e" strokeWidth="1.6" />
      </G>
      <G transform="rotate(10 146 70)">
        <Rect x="110" y="44" width="74" height="52" rx="16" fill="#22d38f" />
        <Rect x="110" y="44" width="74" height="52" rx="16" fill={`url(#${u}-shine)`} />
        <SvgText x="147" y="80" textAnchor="middle" fontSize="28" fill="#0a2018" fontFamily="Manrope_800ExtraBold">13%</SvgText>
      </G>
    </G>
  ),
  // Телефон с бесконечным списанием
  subscriptions: (u) => (
    <G>
      <LinearGradient id={`${u}-phone`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#ff5fa2" />
        <Stop offset="1" stopColor="#7c5cff" />
      </LinearGradient>
      <G transform="rotate(-10 100 104)">
        <Rect x="62" y="30" width="76" height="144" rx="18" fill="#16171d" />
        <Rect x="68" y="38" width="64" height="128" rx="13" fill={`url(#${u}-phone)`} />
        <Rect x="68" y="38" width="64" height="128" rx="13" fill={`url(#${u}-shine)`} />
        {[0, 1, 2].map((k) => (
          <G key={k} transform={`translate(0 ${k * 30})`}>
            <Rect x="76" y="56" width="48" height="22" rx="7" fill="#fff" opacity="0.92" />
            <Circle cx="86" cy="67" r="5" fill="#ff5fa2" />
            <Rect x="95" y="64" width="22" height="6" rx="3" fill="#16171d" opacity="0.5" />
          </G>
        ))}
      </G>
      <G>
        <Circle cx="152" cy="146" r="26" fill="#c8f135" />
        <Path d="M141 146a11 11 0 1 1 4 8.5M141 146v-8M141 146h8" stroke="#16171d" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  ),
  // Квест: два варианта ответа в чате
  quest: (u) => (
    <G>
      <G>
        <Rect x="30" y="40" width="112" height="44" rx="18" fill="#ffffff" />
        <Rect x="44" y="55" width="70" height="7" rx="3.5" fill="#16171d" opacity="0.6" />
        <Rect x="44" y="67" width="44" height="7" rx="3.5" fill="#16171d" opacity="0.35" />
      </G>
      <G>
        <Rect x="70" y="98" width="104" height="34" rx="14" fill="#22b07d" />
        <Path d="M86 115l6 6 12-12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="112" y="111" width="46" height="7" rx="3.5" fill="#fff" opacity="0.85" />
      </G>
      <G>
        <Rect x="70" y="140" width="104" height="34" rx="14" fill="#f0443a" />
        <Path d="M88 151l10 10M98 151l-10 10" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <Rect x="112" y="153" width="46" height="7" rx="3.5" fill="#fff" opacity="0.85" />
      </G>
      <Circle cx="160" cy="44" r="20" fill="#c8f135" />
      <SvgText x="160" y="53" textAnchor="middle" fontSize="26" fill="#16171d" fontFamily="Manrope_800ExtraBold">?</SvgText>
    </G>
  ),
  // Объёмная диаграмма 50/30/20
  budget_503020: (u) => {
    const seg = (start: number, end: number) => {
      const r = 64
      const a0 = ((start - 90) * Math.PI) / 180
      const a1 = ((end - 90) * Math.PI) / 180
      const large = end - start > 180 ? 1 : 0
      return `M100 100L${100 + r * Math.cos(a0)} ${100 + r * Math.sin(a0)}A${r} ${r} 0 ${large} 1 ${100 + r * Math.cos(a1)} ${100 + r * Math.sin(a1)}z`
    }
    return (
      <G>
        <G transform="translate(0 12)" opacity="0.55">
          <Path d={seg(0, 180)} fill="#7a8f1a" />
          <Path d={seg(180, 288)} fill="#3a2a9a" />
          <Path d={seg(288, 360)} fill="#a13a70" />
        </G>
        <Path d={seg(0, 180)} fill="#c8f135" />
        <Path d={seg(180, 288)} fill="#7c5cff" />
        <G transform="translate(6 -6)">
          <Path d={seg(288, 360)} fill="#ff5fa2" />
        </G>
        <Circle cx="100" cy="100" r="64" fill={`url(#${u}-shine)`} />
        <SvgText x="128" y="108" textAnchor="middle" fontSize="20" fill="#16171d" fontFamily="Manrope_800ExtraBold">50</SvgText>
        <SvgText x="72" y="134" textAnchor="middle" fontSize="16" fill="#fff" fontFamily="Manrope_800ExtraBold">30</SvgText>
        <SvgText x="80" y="66" textAnchor="middle" fontSize="14" fill="#fff" fontFamily="Manrope_800ExtraBold">20</SvgText>
      </G>
    )
  },
}
