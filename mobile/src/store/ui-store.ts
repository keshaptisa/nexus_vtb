// Временное состояние интерфейса: уведомления, тосты, сообщения Бита, данные для открытых окон.
import { create } from 'zustand'

import type { TransferResult } from '@/engine/types'

export interface PushData {
  id: number
  icon: string
  title: string
  text: string
  app: 'bank' | 'chat' | 'bit'
  tone?: 'default' | 'danger' | 'ok'
  href?: string
}

export interface BitMessage {
  role: 'bot' | 'user'
  text: string
}

export interface InterceptPayload {
  result: TransferResult
  to: string
  amount: number
}

interface UiState {
  push: PushData | null
  toast: { id: number; text: string } | null
  celebrate: { id: number; xp: number } | null
  bit: BitMessage[]
  bitSuggestions: string[]
  bitUnread: number
  intercept: InterceptPayload | null
  shieldText: string
  transferPrefill: { to?: string; amount?: number } | null
  routeBusy: boolean
  path: string
  bitAsk: { id: number; text: string } | null
  showPush: (p: Omit<PushData, 'id'>) => void
  hidePush: () => void
  notify: (text: string) => void
  hideToast: () => void
  celebrateXp: (xp: number) => void
  sayBit: (text: string, suggestions?: string[]) => void
  addBit: (m: BitMessage) => void
  setBitSuggestions: (s: string[]) => void
  readBit: () => void
  resetBit: (greeting: string, suggestions: string[]) => void
  set: (patch: Partial<Pick<UiState, 'intercept' | 'shieldText' | 'transferPrefill' | 'routeBusy' | 'path' | 'bitAsk'>>) => void
}

export const useUi = create<UiState>()((set) => ({
  push: null,
  toast: null,
  celebrate: null,
  bit: [],
  bitSuggestions: [],
  bitUnread: 0,
  intercept: null,
  shieldText: '',
  transferPrefill: null,
  routeBusy: false,
  path: '/',
  bitAsk: null,
  showPush: (p) => set({ push: { ...p, id: Date.now() + Math.random() } }),
  hidePush: () => set({ push: null }),
  notify: (text) => set({ toast: { id: Date.now() + Math.random(), text } }),
  hideToast: () => set({ toast: null }),
  celebrateXp: (xp) => (xp > 0 ? set({ celebrate: { id: Date.now(), xp } }) : undefined),
  // Бит сам пишет в ключевые моменты: странное зачисление, перехват, итог сценария
  sayBit: (text, suggestions) =>
    set((s) => {
      const here = s.path === '/assistant'
      const quiet = here || s.routeBusy
      return {
        bit: [...s.bit, { role: 'bot', text }],
        bitSuggestions: suggestions ?? s.bitSuggestions,
        bitUnread: here ? 0 : s.bitUnread + 1,
        // Не в чате с Битом — его реплика приходит пушем, как на сайте всплывала подсказка
        push: quiet ? s.push : { id: Date.now() + Math.random(), app: 'bit', icon: 'chat', title: 'Бит', text, href: '/assistant' },
      }
    }),
  addBit: (m) => set((s) => ({ bit: [...s.bit, m] })),
  setBitSuggestions: (bitSuggestions) => set({ bitSuggestions }),
  readBit: () => set({ bitUnread: 0 }),
  resetBit: (greeting, suggestions) => set({ bit: [{ role: 'bot', text: greeting }], bitSuggestions: suggestions, bitUnread: 0 }),
  set: (patch) => set(patch),
}))
