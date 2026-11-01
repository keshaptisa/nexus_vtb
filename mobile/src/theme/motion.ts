// Движение в приложении — одни значения везде (скилл better-ui):
// появление 300 мс ease-out со сдвигом 12px, шаг между блоками 100 мс, нажатие 0.96 за 150 мс,
// смена иконки — с 0.25 по кривой (0.2, 0, 0, 1). Пружин с перелётом нет.
// Появление делает компонент Enter (components/ui/enter.tsx) обычным анимированным стилем:
// layout-анимации Reanimated в браузере сбивают раскладку внутри прокрутки.
import { Easing } from 'react-native-reanimated'

export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1) // CSS ease-out
export const EASE_EMPHASIS = Easing.bezier(0.2, 0, 0, 1)

export const ENTER_MS = 300
export const PRESS_MS = 150
export const STAGGER_MS = 100
export const ENTER_Y = 12
export const PRESS_SCALE = 0.96
export const ICON_FROM_SCALE = 0.25

/** Задержка смыслового блока: шаг 100 мс, не больше трёх шагов */
export const stagger = (step: number) => Math.min(step, 3) * STAGGER_MS
