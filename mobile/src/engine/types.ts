// Типы банка «Старт». Те же, что у сайта (frontend/src/api/types.ts), но всё считается на телефоне.

export type RiskLevel = 'high' | 'medium' | 'low'

export interface Persona {
  id: string
  name: string
  age: number
  // kids — «Детский банк», start — «Старт», pushkin — есть только «Пушкинская карта»
  segment: 'kids' | 'start' | 'pushkin'
  pushkin_balance: number | null
  self_employed?: boolean // подтверждённый статус НПД — свой порог перехвата
  balance: number
  description: string
}

export interface Goal {
  id: string
  title: string
  target: number
  saved: number
}

export interface Transaction {
  id: string
  ts: string // ISO
  amount: number
  direction: 'in' | 'out'
  counterparty: string
  is_new_counterparty: boolean
  channel: string
  category: string | null
  frozen: boolean
  flagged: boolean
}

export interface Risk {
  score: number
  level: RiskLevel
  reasons: string[]
}

export interface Profile {
  avg_topup: number
  avg_spend: number
  known_senders: string[]
  known_recipients: string[]
  min_transit_minutes: number | null
}

export interface LiveRisk {
  persona_id: string
  score: number
  level: RiskLevel
  signals: string[]
  profile: Profile | null
}

export interface Account {
  persona: Persona
  transactions: Transaction[]
  outgoingPausedUntil: string | null
  xp: number
  done: string[] // пройденные истории и действия, за которые уже дали XP
  lastIntercept: Risk | null // последний перехваченный перевод — для «Что видит банк»
  goals: Goal[]
  evidence: Record<string, number> // пакет скриншотов → сколько штук
}

export interface ChatMessage {
  sender: 'recruiter' | 'user' | 'system'
  text: string
}

export interface BankEvent {
  type: 'incoming' | 'outgoing' | 'push'
  amount?: number | null
  counterparty?: string | null
  is_new_counterparty?: boolean
  channel?: 'sbp' | 'card' | 'cash' | 'salary'
  category?: string | null
  text?: string | null
}

export type PopupType =
  | 'incoming' | 'request_transfer' | 'pressure' | 'history' | 'threat' | 'lesson' | 'done'
  | 'birthday' | 'bridge' | 'pushkin' | 'goal'

export interface ScenarioPopup {
  type: PopupType
  title?: string
  text?: string
}

export interface DemoStep {
  id: string
  title: string
  hint?: string
  chat?: ChatMessage[]
  bank_events?: BankEvent[]
  expect?: Record<string, unknown> | null
  popup?: ScenarioPopup | null
}

export interface Scenario {
  persona_id: string
  title: string
  steps: DemoStep[]
}

export type InterceptAction = 'cancel' | 'offered_job' | 'call_bank' | 'check_message' | 'continue'

export interface Intercept {
  title: string
  text: string
  consequences: string[]
  actions: InterceptAction[]
}

export interface TransferResult {
  status: 'ok' | 'intercepted' | 'error'
  risk: Risk
  intercept: Intercept | null
  message?: string
}

export interface OperationResult {
  status: 'ok' | 'flagged' | 'rejected'
  transaction: Transaction | null
  risk: Risk
  message: string
}

export interface SosStep {
  text: string
  action: string | null
  legal: string | null
}

export interface SosBranch {
  id: 'A' | 'B' | 'C' | 'D'
  title: string
  steps: SosStep[]
}

export interface LegalItem {
  id: string
  short: string
  full: string
  sources: string[]
  verified: boolean
}

export interface Lesson {
  id: string
  title: string
  short: string
  order?: number
  xp: number
  cta?: { label: string; action: string }
  cards: { title: string; text: string }[]
  quiz: { question: string; options: string[]; answer: number } | null
}

export interface ShieldResult {
  risk: RiskLevel
  score: number
  scheme: string
  red_flags: string[]
  explanation: string
  consequences: string[]
  advice: string[]
}

export interface AssistantReply {
  reply: string
  suggestions: string[]
  action: string | null
}

export interface Progress {
  xp: number
  level: number
  done: string[]
  gained: number
}

export interface QuestNode {
  id: string
  speaker: 'recruiter' | 'narrator' | 'bank'
  text: string
  ending?: 'good' | 'bad'
  choices: { text: string; next: string }[]
}

export interface Quest {
  id: string
  title: string
  short: string
  xp: number
  intro: string
  start: string
  nodes: QuestNode[]
}
