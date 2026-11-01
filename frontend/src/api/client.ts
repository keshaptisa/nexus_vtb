import type {
  AssistantReply,
  DemoState,
  Goal,
  LegalItem,
  Lesson,
  LiveRisk,
  MetricsSummary,
  OperationResponse,
  Persona,
  Progress,
  Quest,
  ScenarioInfo,
  ShieldResult,
  SosBranch,
  Transaction,
  TransferResponse,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* не JSON */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Ошибка запроса')
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })

export const api = {
  scenarios: () => request<ScenarioInfo[]>('/api/demo/scenarios'),
  demoState: (id: string) => request<DemoState>(`/api/demo/${id}`),
  demoReset: (id: string) => post<DemoState>(`/api/demo/${id}/reset`),
  demoNext: (id: string) => post<DemoState>(`/api/demo/${id}/next`),

  personas: () => request<Persona[]>('/api/personas'),
  resetPersona: (personaId: string) => post<Persona>(`/api/personas/${personaId}/reset`),
  transactions: (personaId: string) => request<Transaction[]>(`/api/personas/${personaId}/transactions`),
  liveRisk: (personaId: string) => request<LiveRisk>(`/api/risk/${personaId}/live`),

  topup: (personaId: string, sender: string, amount: number) =>
    post<OperationResponse>('/api/payments/topup', { persona_id: personaId, sender, amount }),
  pay: (personaId: string, merchant: string, category: string, amount: number) =>
    post<OperationResponse>('/api/payments/pay', { persona_id: personaId, merchant, category, amount }),
  transfer: (personaId: string, to: string, amount: number, confirmed = false) =>
    post<TransferResponse>('/api/payments/transfer', { persona_id: personaId, to, amount, confirmed }),

  sosBranches: () => request<SosBranch[]>('/api/sos/branches'),
  legal: () => request<LegalItem[]>('/api/sos/legal'),
  returnFunds: (personaId: string, operationId: string) =>
    post<{ claim_id: string; frozen_amount: number; status: string }>('/api/sos/return-funds', {
      persona_id: personaId,
      operation_id: operationId,
    }),
  evidence: (personaId: string, imagesBase64: string[]) =>
    post<{ evidence_id: string; count: number }>('/api/sos/evidence', { persona_id: personaId, images_base64: imagesBase64 }),
  pauseOutgoing: (personaId: string) => post('/api/sos/pause-outgoing', { persona_id: personaId }),
  sosAction: (personaId: string, action: string, branch?: string) =>
    post<{ result: string; draft?: string | null }>('/api/sos/action', { persona_id: personaId, action, branch }),

  shield: (text: string, personaId?: string) => post<ShieldResult>('/api/shield/check', { text, persona_id: personaId }),
  shieldImage: (imageBase64: string, personaId?: string) =>
    post<ShieldResult>('/api/shield/check', { image_base64: imageBase64, persona_id: personaId }),
  quest: (id: string) => request<Quest>(`/api/quest/${id}`),
  event: (personaId: string, type: string) =>
    post<{ lesson: Lesson | null }>('/api/events', { persona_id: personaId, type }),
  lessons: () => request<Lesson[]>('/api/lessons'),
  getProgress: (personaId: string) => request<Progress>(`/api/progress/${personaId}`),
  progress: (personaId: string, body: { lesson_id?: string; quest_id?: string; action?: string }) =>
    post<Progress>('/api/progress', { persona_id: personaId, ...body }),

  goals: (personaId: string) => request<Goal[]>(`/api/goals/${personaId}`),
  createGoal: (personaId: string, title: string, target: number) =>
    post<Goal>('/api/goals', { persona_id: personaId, title, target }),
  depositGoal: (personaId: string, goalId: string, amount: number) =>
    post<{ goal: Goal; balance: number; message: string }>(`/api/goals/${goalId}/deposit`, { persona_id: personaId, amount }),
  bridge: (personaId: string, parentConsent: boolean) =>
    post<{ persona: Persona; carried_goals: Goal[]; carried_xp: number; carried_stories: number; message: string }>(
      '/api/bridge/migrate', { persona_id: personaId, parent_consent: parentConsent },
    ),
  pushkinOffers: () => request<string[]>('/api/pushkin/offers'),
  pushkinActivate: (personaId: string) =>
    post<{ persona: Persona; offers: string[]; message: string }>(`/api/pushkin/${personaId}/activate`),

  metricsSummary: (personaId: string) => request<MetricsSummary>(`/api/metrics/summary?persona_id=${personaId}`),
  // Решения, которые принимаются в интерфейсе без запроса к банку: отмена после перехвата, открытие «Безопасного выхода»
  metricEvent: (personaId: string, name: 'intercept_cancelled' | 'safe_exit_opened', action?: string) =>
    post<{ ok: boolean }>('/api/metrics/events', { persona_id: personaId, name, action }),

  assistant: (personaId: string, message: string, history: { role: string; text: string }[]) =>
    post<AssistantReply>('/api/assistant/chat', { persona_id: personaId, message, history }),
}
