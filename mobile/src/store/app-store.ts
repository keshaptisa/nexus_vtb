// Состояние банка на телефоне: счета героев, выбранный герой, тема. Сохраняется между запусками (AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { newAccount } from '@/engine/bank'
import { PERSONA_IDS } from '@/engine/content'
import type { Account } from '@/engine/types'

export type ThemePref = 'system' | 'light' | 'dark'

interface AppState {
  hydrated: boolean
  personaId: string | null
  accounts: Record<string, Account>
  theme: ThemePref
  introSeen: boolean
  setHydrated: () => void
  choosePersona: (id: string) => void
  logout: () => void
  resetPersona: (id: string) => void
  setTheme: (t: ThemePref) => void
  setIntroSeen: () => void
  /** Меняет копию счёта текущего героя и сохраняет её. Возвращает результат функции. */
  mutate: <T>(fn: (acc: Account) => T, personaId?: string) => T
}

const freshAccounts = () => Object.fromEntries(PERSONA_IDS.map((id) => [id, newAccount(id)]))

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      personaId: null,
      accounts: freshAccounts(),
      theme: 'system',
      introSeen: false,
      setHydrated: () => set({ hydrated: true }),
      // Каждый вход — с чистого листа, как на сайте: история из content/personas.json
      choosePersona: (id) => set((s) => ({ personaId: id, accounts: { ...s.accounts, [id]: newAccount(id) } })),
      logout: () => set({ personaId: null }),
      resetPersona: (id) => set((s) => ({ accounts: { ...s.accounts, [id]: newAccount(id) } })),
      setTheme: (theme) => set({ theme }),
      setIntroSeen: () => set({ introSeen: true }),
      mutate: (fn, personaId) => {
        const id = personaId ?? get().personaId
        if (!id) throw new Error('Герой не выбран')
        // Счёт — чистый JSON, поэтому копия через JSON (structuredClone есть не во всех движках JS)
        const copy: Account = JSON.parse(JSON.stringify(get().accounts[id] ?? newAccount(id)))
        const result = fn(copy)
        set((s) => ({ accounts: { ...s.accounts, [id]: copy } }))
        return result
      },
    }),
    {
      name: 'start-bank-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ personaId: s.personaId, accounts: s.accounts, theme: s.theme, introSeen: s.introSeen }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
)

/** Счёт выбранного героя */
export function useAccount(): Account | null {
  return useApp((s) => (s.personaId ? s.accounts[s.personaId] ?? null : null))
}

export const getAccount = (): Account | null => {
  const s = useApp.getState()
  return s.personaId ? s.accounts[s.personaId] ?? null : null
}
