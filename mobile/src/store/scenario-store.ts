// Проигрывание сценария героя. Порт логики сайта (frontend/src/pages/Cabinet.tsx + ScenarioPanel.tsx):
// переписка приходит по сообщению → уведомление банка → окно банка → ждём решения или идём дальше сами.
// На телефоне сообщения вербовщика приходят пушами «мессенджера», а окна банка — нативными шторками.
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Platform } from 'react-native'
import { create } from 'zustand'

import * as bank from '@/engine/bank'
import { SCENARIOS } from '@/engine/content'
import { rub } from '@/engine/format'
import type { ChatMessage, DemoStep, ScenarioPopup } from '@/engine/types'

import { useApp } from './app-store'
import { useUi } from './ui-store'

const TYPE_MS = 1100
export const CHAT_TITLE: Record<string, string> = { artem: 'Работа | Подработка', dima: 'Куратор', lev: 'Куплю Пушкинскую' }

type Pending = { step: number } & ({ kind: 'popup'; popup: ScenarioPopup } | { kind: 'sos'; branch: string })

interface ScenarioState {
  scenarioId: string | null
  stepIndex: number
  stepsCount: number
  chat: ChatMessage[]
  shown: number
  typing: boolean
  waiting: string | null
  popup: ScenarioPopup | null
  pending: Pending | null
  chatOpen: boolean
  unread: number
  expanded: boolean
}

export const useScenario = create<ScenarioState>()(() => ({
  scenarioId: null,
  stepIndex: 0,
  stepsCount: 0,
  chat: [],
  shown: 0,
  typing: false,
  waiting: null,
  popup: null,
  pending: null,
  chatOpen: false,
  unread: 0,
  expanded: true,
}))

const S = () => useScenario.getState()
const set = (patch: Partial<ScenarioState>) => useScenario.setState(patch)

// ---------- таймеры ----------
let timers: ReturnType<typeof setTimeout>[] = []
let handledStep = -1
const later = (ms: number, fn: () => void) => {
  const t = setTimeout(() => {
    timers = timers.filter((x) => x !== t)
    fn()
  }, ms)
  timers.push(t)
}
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}

const haptic = (kind: 'warn' | 'ok' | 'tap') => {
  if (Platform.OS === 'web') return
  if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
  else if (kind === 'ok') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export const currentStep = (): DemoStep | null => {
  const s = S()
  return s.scenarioId ? SCENARIOS[s.scenarioId]?.steps[s.stepIndex] ?? null : null
}

export const expects = (action: string) => currentStep()?.expect?.action === action

// ---------- шаги ----------
function applyStep(index: number) {
  const s = S()
  if (!s.scenarioId) return
  const step = SCENARIOS[s.scenarioId].steps[index]
  set({ chat: [...s.chat, ...(step.chat ?? [])] })
  const personaId = SCENARIOS[s.scenarioId].persona_id
  useApp.getState().mutate((acc) => {
    for (const ev of step.bank_events ?? []) {
      if (ev.type === 'incoming' && ev.amount)
        bank.incoming(acc, ev.amount, ev.counterparty ?? 'Неизвестный', ev.is_new_counterparty ?? true, undefined, ev.channel ?? 'sbp')
      else if (ev.type === 'outgoing' && ev.amount)
        bank.outgoing(
          acc,
          ev.amount,
          ev.counterparty ?? 'Неизвестный',
          ev.channel ?? 'sbp',
          ev.category ?? bank.guessCategory(ev.counterparty ?? '', ev.channel ?? 'sbp'),
        )
    }
  }, personaId)
}

// Сообщения появляются по одному с «печатает…». Если чат закрыт — приходит пуш мессенджера
function reveal() {
  const s = S()
  if (!s.scenarioId) return
  if (s.shown < s.chat.length) {
    const msg = s.chat[s.shown]
    set({ typing: msg.sender === 'recruiter' })
    later(msg.sender === 'recruiter' ? TYPE_MS : 500, () => {
      const cur = S()
      set({ shown: cur.shown + 1, typing: false })
      if (msg.sender === 'recruiter' && !cur.chatOpen) {
        set({ unread: cur.unread + 1 })
        // Поверх открытого окна пуш не показываем — счётчик непрочитанных на панели сценария
        if (!useUi.getState().routeBusy) useUi.getState().showPush({
          app: 'chat',
          icon: 'chat',
          title: CHAT_TITLE[cur.scenarioId ?? ''] ?? 'Мессенджер',
          text: msg.text,
          href: '/chat',
        })
        haptic('tap')
      }
      reveal()
    })
    return
  }
  const step = s.stepIndex
  later(400, () => onChatShown(step))
}

const WAIT_TEXT: Record<string, string> = {
  transfer: 'Откройте перевод — посмотрите, что сделает банк',
  sos: 'Пройдите шаги «Безопасного выхода»',
  event: 'Посмотрите историю до конца',
  bridge: 'Перейдите в «Старт» — мама подтвердит в своём приложении',
  pushkin: 'Откройте карту «Старт» из витрины',
  goal: 'Отложите деньги в копилку',
}
const waitFor = (expect: Record<string, unknown>) => set({ waiting: WAIT_TEXT[String(expect.action)] ?? null })

// Переписка шага показана → уведомление банка → окно → ждём решения или идём дальше сами
function onChatShown(stepIndex: number) {
  const s = S()
  if (!s.scenarioId || handledStep === stepIndex || s.stepIndex !== stepIndex) return
  handledStep = stepIndex
  const step = SCENARIOS[s.scenarioId].steps[stepIndex]
  const last = stepIndex >= s.stepsCount - 1

  const ev = (step.bank_events ?? []).find((e) => e.amount)
  if (ev?.amount && !useUi.getState().routeBusy) {
    const incoming = ev.type === 'incoming'
    const acc = useApp.getState().accounts[SCENARIOS[s.scenarioId].persona_id]
    const flagged = incoming && acc.transactions.some((t) => t.flagged && !t.frozen && t.amount === ev.amount)
    useUi.getState().showPush({
      app: 'bank',
      icon: incoming ? 'plus' : 'bag',
      title: (incoming ? '+' : '−') + rub(ev.amount),
      text: incoming
        ? `Пополнение от «${ev.counterparty}»${flagged ? ' · банк проверяет зачисление' : ''}`
        : `Оплата: ${ev.counterparty}`,
      tone: flagged ? 'danger' : 'default',
    })
    haptic(flagged ? 'warn' : 'tap')
  }

  later(ev ? 1400 : 300, () => {
    if (step.popup) {
      set({ pending: { step: stepIndex, kind: 'popup', popup: step.popup } })
      if (step.popup.type !== 'done') set({ waiting: 'Решение — в окне банка' })
    } else if (step.expect?.action === 'sos') {
      set({ pending: { step: stepIndex, kind: 'sos', branch: String(step.expect.branch ?? 'A') } })
      waitFor(step.expect)
    } else if (step.expect) {
      waitFor(step.expect)
    } else if (!last) {
      later(1600, () => S().scenarioId && advance())
    }
    flush()
  })
}

/** Окно сценария ждёт, пока закроются другие окна и сторис */
export function flush() {
  const s = S()
  if (!s.pending || useUi.getState().routeBusy || s.popup) return
  const p = s.pending
  set({ pending: null })
  if (p.step !== s.stepIndex) return
  useUi.getState().hidePush() // окно банка важнее уведомления
  if (p.kind === 'popup') {
    set({ popup: p.popup })
    router.push('/window')
  } else {
    router.push({ pathname: '/sos', params: { branch: p.branch } })
  }
}

// ---------- управление ----------
export function startScenario() {
  const personaId = useApp.getState().personaId
  if (!personaId || !SCENARIOS[personaId]) return
  clearTimers()
  handledStep = -1
  useApp.getState().resetPersona(personaId)
  set({
    scenarioId: personaId,
    stepIndex: 0,
    stepsCount: SCENARIOS[personaId].steps.length,
    chat: [],
    shown: 0,
    typing: false,
    waiting: null,
    popup: null,
    pending: null,
    unread: 0,
    expanded: true,
  })
  applyStep(0)
  reveal()
}

export function advance() {
  const s = S()
  if (!s.scenarioId) return
  set({ waiting: null, pending: null })
  if (s.stepIndex >= s.stepsCount - 1) return
  set({ stepIndex: s.stepIndex + 1 })
  applyStep(s.stepIndex + 1)
  reveal()
}

/** «Пропустить шаг» */
export function skipStep() {
  set({ popup: null, pending: null, waiting: null })
  useUi.getState().hidePush()
  advance()
}

/** Правильное решение раньше времени — сразу к финалу */
export function finishScenario() {
  const s = S()
  if (!s.scenarioId) return
  set({ pending: null, popup: null })
  let i = s.stepIndex
  while (i < s.stepsCount - 1) {
    i += 1
    set({ stepIndex: i })
    applyStep(i)
  }
  set({ waiting: null })
  reveal()
}

export function stopScenario() {
  clearTimers()
  handledStep = -1
  set({ scenarioId: null, chat: [], shown: 0, typing: false, waiting: null, popup: null, pending: null, unread: 0 })
}

/** Окно банка закрыли без решения */
export function closePopup() {
  const s = S()
  const step = currentStep()
  const wasDone = s.popup?.type === 'done'
  set({ popup: null })
  if (!step || wasDone) return set({ waiting: null })
  if (step.expect?.action === 'sos') set({ pending: { step: s.stepIndex, kind: 'sos', branch: String(step.expect.branch ?? 'A') } })
  if (step.expect) waitFor(step.expect)
  else later(600, () => S().scenarioId && advance())
}

/** Открыть окно банка вне сценария (переход в «Старт», витрина «Пушкинской карты») */
export function openWindow(popup: ScenarioPopup) {
  set({ popup })
  router.push('/window')
}

/** Окно банка закрыто действием (переход в перевод, «Безопасный выход» и т. п.) */
export const consumePopup = () => set({ popup: null })

export const setChatOpen = (open: boolean) => set(open ? { chatOpen: true, unread: 0 } : { chatOpen: false })
export const setExpanded = (expanded: boolean) => set({ expanded })

// ---------- события из экранов ----------
export function onTransferIntercepted() {
  if (S().scenarioId && expects('transfer')) advance()
}
export function onSafeExitComplete() {
  if (S().scenarioId) finishScenario()
}
export function onStoryFinished() {
  if (S().scenarioId && expects('event')) advance()
}
export function onChannelAction(action: 'bridge' | 'pushkin' | 'goal') {
  if (S().scenarioId && expects(action)) advance()
}
export const lastRecruiterMessage = () =>
  [...S().chat.slice(0, S().shown)].reverse().find((m) => m.sender === 'recruiter')?.text ?? ''
