// Типы ответов API. Держим в синхроне с backend/app/schemas.py и docs/api.md.

export type RiskLevel = 'high' | 'medium' | 'low'

export interface Persona {
  id: string
  name: string
  age: number
  // kids — «Детский банк», start — «Старт», pushkin — есть только «Пушкинская карта» ВТБ
  segment: 'kids' | 'start' | 'pushkin'
  pushkin_balance: number | null
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
  ts: string
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

export interface OperationResponse {
  status: 'ok' | 'flagged' | 'rejected'
  transaction: Transaction | null
  risk: Risk
  message: string
  balance: number
}

export interface ChatMessage {
  sender: 'recruiter' | 'user' | 'system'
  text: string
}

export interface DemoStep {
  id: string
  title: string
  hint: string
  chat: ChatMessage[]
  bank_events: { type: string; amount: number | null; counterparty: string | null }[]
  expect: Record<string, unknown> | null
  popup: ScenarioPopup | null
}

export interface ScenarioPopup {
  type: 'incoming' | 'request_transfer' | 'pressure' | 'history' | 'threat' | 'lesson' | 'done'
    | 'birthday' | 'bridge' | 'pushkin' | 'goal'
  title?: string
  text?: string
}

export interface LiveRisk {
  persona_id: string
  score: number
  level: RiskLevel
  signals: string[]
  profile: Profile | null
}

export interface DemoState {
  scenario_id: string
  persona: Persona
  step_index: number
  steps_count: number
  step: DemoStep
  chat_history: ChatMessage[]
  risk: LiveRisk
}

export interface ScenarioInfo {
  id: string
  persona: string
  title: string
  steps_count: number
}

export type InterceptAction = 'cancel' | 'offered_job' | 'call_bank' | 'check_message' | 'continue'

// GET /api/metrics/summary — метрики по текущей сессии демо (docs/business/metrics.md)
export interface MetricsSummary {
  events: Record<string, number>
  intercept_cancel_rate: number | null
  safe_exit_conversion: number | null
  median_seconds_to_action: number | null
  prevented_transits: number
}

export interface TransferResponse {
  status: 'ok' | 'intercepted'
  risk: Risk
  intercept: {
    title: string
    text: string
    consequences: string[]
    actions: InterceptAction[]
  } | null
  balance: number
}

export interface SosStep {
  text: string
  action: string | null
  legal: string | null
}

export interface LegalItem {
  id: string
  short: string
  full: string
  sources: string[]
  verified: boolean
}

export interface SosBranch {
  id: 'A' | 'B' | 'C' | 'D'
  title: string
  steps: SosStep[]
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
  recognized_text: string | null
}

export interface AssistantReply {
  reply: string
  suggestions: string[]
  action: string | null
  source: 'rules' | 'llm'
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
