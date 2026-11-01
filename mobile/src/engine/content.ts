// Контент приложения: копия папки content/ из репозитория (обновить — npm run sync-content).
import legalJson from '../content/legal.json'
import budget from '../content/lessons/budget_503020.json'
import dontShareCard from '../content/lessons/dont_share_card.json'
import ndfl from '../content/lessons/ndfl.json'
import pushkinScam from '../content/lessons/pushkin_scam.json'
import safeExit from '../content/lessons/safe_exit.json'
import spotFraud from '../content/lessons/spot_fraud.json'
import subscriptions from '../content/lessons/subscriptions.json'
import triggersJson from '../content/lessons/triggers.json'
import personasJson from '../content/personas.json'
import dropJob from '../content/quest/drop_job.json'
import artem from '../content/scenarios/artem.json'
import dima from '../content/scenarios/dima.json'
import katya from '../content/scenarios/katya.json'
import lev from '../content/scenarios/lev.json'
import sonya from '../content/scenarios/sonya.json'
import branchesJson from '../content/sos/branches.json'
import templatesJson from '../content/sos/report_templates.json'
import type { LegalItem, Lesson, Quest, Scenario, SosBranch } from './types'

export interface RawHistory {
  days_ago?: number
  amount: number
  direction: 'in' | 'out'
  counterparty: string
  channel?: string
  category?: string
}

export interface RawPersona {
  id: string
  name: string
  age: number
  segment?: 'kids' | 'start' | 'pushkin'
  balance: number
  pushkin_balance?: number | null
  description: string
  card_age_days?: number
  xp?: number
  done?: string[]
  goals?: { title: string; target: number; saved: number }[]
  history?: RawHistory[]
}

export interface Trigger {
  event: string
  lesson_id: string
  condition?: string
  when?: { field: string; op: '==' | '>=' | '>' | '<=' | '<'; value: unknown }[]
}

export const PERSONA_IDS = ['artem', 'dima', 'katya', 'sonya', 'lev'] as const
export type PersonaId = (typeof PERSONA_IDS)[number]

const personaList = personasJson as unknown as RawPersona[]
export const RAW_PERSONAS: Record<string, RawPersona> = Object.fromEntries(personaList.map((p) => [p.id, p]))

export const SCENARIOS: Record<string, Scenario> = {
  artem: artem as unknown as Scenario,
  dima: dima as unknown as Scenario,
  katya: katya as unknown as Scenario,
  sonya: sonya as unknown as Scenario,
  lev: lev as unknown as Scenario,
}

const lessonList = [budget, dontShareCard, ndfl, pushkinScam, safeExit, spotFraud, subscriptions] as unknown as Lesson[]
export const LESSONS: Lesson[] = [...lessonList].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null

export const TRIGGERS = triggersJson as unknown as Trigger[]
export const QUEST = dropJob as unknown as Quest
export const SOS_BRANCHES = branchesJson as unknown as SosBranch[]
export const REPORT_TEMPLATES = templatesJson as unknown as Record<string, Record<string, string> | string>

const legalItems = (legalJson as unknown as { items: LegalItem[] }).items
export const LEGAL: Record<string, LegalItem> = Object.fromEntries(legalItems.map((x) => [x.id, x]))
export const LEGAL_LIST = legalItems

// Тема сценария каждого героя — на экране выбора и в переключателе аккаунтов
export const PERSONA_TAGS: Record<string, string> = {
  artem: 'Вербовка в дропы',
  dima: 'Угрозы после перевода',
  katya: 'Первая зарплата',
  sonya: 'Переход в 14 лет',
  lev: '«Пушкинская карта»',
}
