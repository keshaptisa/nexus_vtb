import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type {
  DemoState,
  Goal,
  InterceptAction,
  Lesson,
  LiveRisk,
  OperationResponse,
  Persona,
  Progress,
  Quest,
  ScenarioPopup,
  SosBranch,
  Transaction,
  TransferResponse,
} from '../api/types'
import { PayModal, TopUpModal, TransferModal } from '../components/ActionModals'
import AccountSwitcher from '../components/AccountSwitcher'
import Assistant, { type Ask, type Nudge } from '../components/Assistant'
import BankSees from '../components/BankSees'
import DemoMetrics from '../components/DemoMetrics'
import { BirthdayWindow, BridgeWindow, GoalsModal, GoalWindow, PushkinWindow } from '../components/ChannelWindows'
import Icon from '../components/Icon'
import Logo from '../components/Logo'
import ProfileModal from '../components/ProfileModal'
import QuestModal from '../components/QuestModal'
import { InterceptModal, ShieldModal, SosModal } from '../components/SafetyModals'
import ScenarioPanel from '../components/ScenarioPanel'
import { Push, type PushData, ScenarioWindow } from '../components/ScenarioPopups'
import Spending from '../components/Spending'
import ThemeToggle from '../components/ThemeToggle'
import { StoriesRow, StoryViewer } from '../components/Stories'
import { AVATAR_GRADIENT, greeting, rub } from '../lib'

type ModalState =
  | { kind: 'topup' }
  | { kind: 'pay' }
  | { kind: 'transfer'; prefill?: { to?: string; amount?: number } }
  | { kind: 'intercept'; result: TransferResponse; to: string; amount: number }
  | { kind: 'sos'; branch?: SosBranch['id'] }
  | { kind: 'shield'; text?: string }
  | { kind: 'profile' }
  | { kind: 'quest' }
  | { kind: 'goals' }
  | null

// Что сценарий покажет, как только экран освободится (закроются окна и сторис)
// step — номер шага: если сценарий ушёл дальше, устаревшее окно не показываем
type Pending = { step: number } & ({ kind: 'popup'; popup: ScenarioPopup } | { kind: 'sos'; branch: SosBranch['id'] })

const PERSONA_IDS = ['artem', 'dima', 'katya', 'sonya', 'lev']

export default function Cabinet() {
  const { personaId = '' } = useParams()
  const [persona, setPersona] = useState<Persona | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [live, setLive] = useState<LiveRisk | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [switching, setSwitching] = useState(false)
  const [scenario, setScenario] = useState<DemoState | null>(null)
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [stories, setStories] = useState<Lesson[]>([])
  const [story, setStory] = useState<number | null>(null)
  const [progress, setProgress] = useState<Progress>({ xp: 0, level: 1, done: [], gained: 0 })
  const seenFlagged = useRef<Set<string> | null>(null)
  const [quest, setQuest] = useState<Quest | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  // ---- проигрывание сценария ----
  const [popup, setPopup] = useState<ScenarioPopup | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [push, setPush] = useState<PushData | null>(null)
  const [waiting, setWaiting] = useState<string | null>(null)
  const handledStep = useRef(-1) // шаг, для которого уже показали уведомления и окно
  const scenarioOn = useRef(false)

  const say = useCallback((text: string, suggestions?: string[]) => {
    setNudge({ id: Date.now() + Math.random(), text, suggestions })
  }, [])

  const notify = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 3500)
  }

  const refresh = useCallback(async () => {
    const [personas, t, l, pr, g] = await Promise.all([
      api.personas(),
      api.transactions(personaId),
      api.liveRisk(personaId),
      api.getProgress(personaId).catch(() => ({ xp: 0, level: 1, done: [], gained: 0 })),
      api.goals(personaId).catch(() => [] as Goal[]),
    ])
    setProgress(pr)
    setGoals(g)
    setPersona(personas.find((p) => p.id === personaId) ?? null)
    setTxs(t)
    setLive(l)

    // Этап 1 алгоритма: новое подозрительное зачисление — ассистент пишет сам
    const flagged = t.filter((x) => x.flagged && !x.frozen)
    if (seenFlagged.current && !scenarioOn.current) {
      const fresh = flagged.find((x) => !seenFlagged.current!.has(x.id))
      if (fresh) {
        say(
          `Вам пришло ${rub(fresh.amount)} от «${fresh.counterparty}». Это необычно для вашего счёта:\n— ` +
            l.signals.slice(0, 3).join('\n— ') +
            '\n\nПожалуйста, не переводите эти деньги дальше — даже «обратно», если попросят. Если вам предложили за это процент, это вербовка в дропы.',
          ['Мне пришли чужие деньги', 'Почему нельзя вернуть самому?', 'Что такое дроп?'],
        )
      }
    }
    seenFlagged.current = new Set(flagged.map((x) => x.id))
  }, [personaId, say])

  useEffect(() => {
    seenFlagged.current = null
    setScenario(null)
    refresh()
  }, [refresh])

  useEffect(() => {
    scenarioOn.current = scenario !== null
  }, [scenario])

  // Открытие «Безопасного выхода» — знаменатель конверсии «Я влип» → действие (docs/business/metrics.md)
  const sosOpen = modal?.kind === 'sos'
  useEffect(() => {
    if (sosOpen) api.metricEvent(personaId, 'safe_exit_opened').catch(() => {})
  }, [sosOpen, personaId])

  // Пока идёт сценарий, «Что видит банк» получает риск с сервера потоком (SSE) — в том числе после
  // действий в другой вкладке. Пропал поток — панель всё равно обновится после каждого действия.
  const streaming = scenario !== null
  useEffect(() => {
    if (!streaming || typeof EventSource === 'undefined') return
    const es = new EventSource(`/api/demo/${personaId}/stream`)
    es.onmessage = (e) => {
      try {
        setLive((JSON.parse(e.data) as DemoState).risk)
      } catch {
        // повреждённое событие пропускаем — следующее придёт целиком
      }
    }
    return () => es.close()
  }, [streaming, personaId])

  // Окно сценария ждёт, пока пользователь закроет текущее окно или сторис
  useEffect(() => {
    if (!pending || modal || story !== null || popup) return
    if (pending.step !== scenario?.step_index) return setPending(null)
    if (pending.kind === 'popup') setPopup(pending.popup)
    else setModal({ kind: 'sos', branch: pending.branch })
    setPending(null)
  }, [pending, modal, story, popup, scenario?.step_index])

  useEffect(() => {
    api.quest('drop_job').then(setQuest).catch(() => null)
  }, [])

  useEffect(() => {
    api.lessons().then((list) => {
      setStories(list)
      // Прямая ссылка на историю: /u/artem?story=2
      const k = Number(new URLSearchParams(window.location.search).get('story'))
      if (new URLSearchParams(window.location.search).has('story') && list[k]) setStory(k)
    })
  }, [])

  if (!PERSONA_IDS.includes(personaId)) return <Navigate to="/" replace />

  // ---------- Операции ----------
  const onTopUp = async (r: OperationResponse) => {
    setModal(null)
    notify(r.status === 'flagged' ? `Зачислено ${rub(r.transaction!.amount)} — сумма под проверкой` : `Зачислено ${rub(r.transaction!.amount)}`)
    await refresh()
  }

  const onPay = async (r: OperationResponse) => {
    setModal(null)
    notify(`Оплачено: ${r.transaction!.counterparty}, ${rub(r.transaction!.amount)}`)
    await refresh()
  }

  const onTransfer = async (r: TransferResponse, to: string, amount: number) => {
    if (r.status === 'intercepted') {
      setModal({ kind: 'intercept', result: r, to, amount })
      if (scenarioOn.current && scenario?.step.expect?.action === 'transfer') advance()
      say(
        'Я остановил этот перевод. Похоже, вам пришли чужие деньги, и их просят переслать дальше — это классическая схема с дропами. Ничего страшного ещё не произошло: можно отменить перевод и спокойно вернуть деньги через банк.',
        ['Открыть «Безопасный выход»', 'Что мне грозит?', 'Как устроен алгоритм?'],
      )
    } else {
      setModal(null)
      notify(`Переведено ${rub(amount)} → ${to}`)
    }
    await refresh()
  }

  const lastRecruiterMessage = () =>
    [...(scenario?.chat_history ?? [])].reverse().find((m) => m.sender === 'recruiter')?.text ?? ''

  const onIntercept = async (action: InterceptAction) => {
    if (modal?.kind !== 'intercept') return
    // Перевод не ушёл — это отмена после перехвата (метрика docs/business/metrics.md)
    if (action === 'cancel' || action === 'call_bank' || action === 'offered_job') {
      api.metricEvent(personaId, 'intercept_cancelled', action).catch(() => {})
    }
    if (action === 'cancel') {
      setModal(null)
      notify('Перевод отменён')
    } else if (action === 'offered_job') {
      setModal({ kind: 'sos', branch: 'A' })
    } else if (action === 'call_bank') {
      // 19% в опросе предпочли бы звонок банка (n = 231). В реальном приложении — звонок в поддержку с контекстом перехвата.
      setModal(null)
      notify('Перевод не отправлен. Соединяем с банком — в демо звонок не совершается')
    } else if (action === 'check_message') {
      setModal({ kind: 'shield', text: lastRecruiterMessage() })
    } else {
      const { to, amount } = modal
      try {
        await api.transfer(personaId, to, amount, true)
        notify(`Переведено ${rub(amount)} → ${to}`)
      } catch (e) {
        notify((e as Error).message)
      }
      setModal(null)
    }
    await refresh()
  }

  // ---------- Сценарий ----------
  const clearFlow = () => {
    setPopup(null)
    setPending(null)
    setWaiting(null)
    setPush(null)
  }

  const startScenario = async () => {
    seenFlagged.current = null
    handledStep.current = -1
    clearFlow()
    setModal(null)
    setScenario(await api.demoReset(personaId))
    await refresh()
  }

  const advance = async () => {
    setWaiting(null)
    setPending(null)
    setScenario(await api.demoNext(personaId))
    await refresh()
  }

  // Правильное решение раньше времени (вернули деньги, прошли «Безопасный выход») — сразу к финалу
  const finishScenario = async () => {
    if (!scenario) return
    setPending(null)
    setPopup(null)
    let s = scenario
    while (s.step_index < s.steps_count - 1) s = await api.demoNext(personaId)
    setWaiting(null)
    setScenario(s)
    await refresh()
  }

  const waitFor = (expect: Record<string, unknown>) => {
    if (expect.action === 'transfer') setWaiting('Откройте перевод — посмотрите, что сделает банк')
    else if (expect.action === 'sos') setWaiting('Пройдите шаги «Безопасного выхода»')
    else if (expect.action === 'event') setWaiting('Посмотрите историю до конца')
    else if (expect.action === 'bridge') setWaiting('Перейдите в «Старт» — мама подтвердит в своём приложении')
    else if (expect.action === 'pushkin') setWaiting('Откройте карту «Старт» из витрины')
    else if (expect.action === 'goal') setWaiting('Отложите деньги в копилку')
  }

  // Переписка шага показана → уведомление банка → окно → ждём решения или идём дальше сами
  const onChatShown = (stepIndex: number) => {
    if (!scenario || handledStep.current === stepIndex || scenario.step_index !== stepIndex) return
    handledStep.current = stepIndex
    const step = scenario.step
    const last = scenario.step_index >= scenario.steps_count - 1

    const ev = step.bank_events.find((e) => e.amount)
    if (ev) {
      const incoming = ev.type === 'incoming'
      const flagged = incoming && txs.some((t) => t.flagged && !t.frozen && t.amount === ev.amount)
      setPush({
        id: Date.now(),
        icon: incoming ? 'plus' : 'bag',
        title: (incoming ? '+' : '−') + rub(ev.amount!),
        text: incoming
          ? 'Пополнение от «' + ev.counterparty + '»' + (flagged ? ' · банк проверяет зачисление' : '')
          : 'Оплата: ' + ev.counterparty,
        tone: flagged ? 'danger' : 'default',
      })
    }

    window.setTimeout(() => {
      if (step.popup) {
        setPending({ step: stepIndex, kind: 'popup', popup: step.popup })
        if (step.popup.type !== 'done') setWaiting('Решение — в окне банка')
      } else if (step.expect?.action === 'sos') {
        setPending({ step: stepIndex, kind: 'sos', branch: (step.expect.branch as SosBranch['id']) ?? 'A' })
        waitFor(step.expect)
      } else if (step.expect) {
        waitFor(step.expect)
      } else if (!last) {
        window.setTimeout(() => scenarioOn.current && advance(), 1600)
      }
    }, ev ? 1400 : 300)
  }

  const closePopup = () => {
    const step = scenario?.step
    const wasDone = popup?.type === 'done'
    setPopup(null)
    if (!step || wasDone) return setWaiting(null)
    if (step.expect?.action === 'sos')
      setPending({ step: scenario!.step_index, kind: 'sos', branch: (step.expect.branch as SosBranch['id']) ?? 'A' })
    if (step.expect) waitFor(step.expect)
    else window.setTimeout(() => scenarioOn.current && advance(), 600)
  }

  const nextStep = async () => {
    clearFlow()
    await advance()
  }

  const openLesson = async (type: string) => {
    const { lesson } = await api.event(personaId, type)
    const index = stories.findIndex((s) => s.id === lesson?.id)
    if (index >= 0) setStory(index)
  }

  const finishStory = async (lesson: Lesson) => {
    const r = await api.progress(personaId, { lesson_id: lesson.id })
    setProgress(r)
    if (scenarioOn.current && scenario?.step.expect?.action === 'event') advance()
    return r.gained
  }

  const finishQuest = async (good: boolean) => {
    if (!good) return 0
    const r = await api.progress(personaId, { quest_id: 'drop_job' })
    setProgress(r)
    return r.gained
  }

  const incomingTx =
    [...txs].reverse().find((t) => t.direction === 'in' && (t.flagged || t.is_new_counterparty) && !t.frozen) ?? null

  const popupActions = {
    returnFunds: async () => {
      setPopup(null)
      if (incomingTx) {
        const r = await api.returnFunds(personaId, incomingTx.id)
        notify('Заморожено ' + rub(r.frozen_amount) + ' — банк вернёт деньги отправителю')
        setProgress(await api.progress(personaId, { action: 'safe_exit' }))
      }
      await finishScenario()
    },
    openTransfer: () => {
      setPopup(null)
      const e = scenario?.step.expect
      setModal({
        kind: 'transfer',
        prefill: e?.action === 'transfer' ? { to: String(e.to), amount: Number(e.amount) } : undefined,
      })
    },
    openShield: () => {
      setPopup(null)
      setModal({ kind: 'shield', text: lastRecruiterMessage() })
    },
    openSos: (branch?: 'A' | 'B') => {
      setPopup(null)
      setModal({ kind: 'sos', branch })
    },
    askBit: (question: string) => {
      closePopup()
      setAsk({ id: Date.now(), text: question })
    },
    openLesson: () => {
      setPopup(null)
      const e = scenario?.step.expect
      if (e?.action === 'event') openLesson(String(e.type))
    },
    openQuest: () => {
      setPopup(null)
      setWaiting(null)
      setModal({ kind: 'quest' })
    },
    close: closePopup,
  }

  // ---------- Каналы роста: мост, «Пушкинская карта», копилка ----------
  const stepExpects = (action: string) => scenarioOn.current && scenario?.step.expect?.action === action

  const migrateBridge = async () => {
    const r = await api.bridge(personaId, true)
    setPopup(null)
    notify(r.message)
    await refresh()
    if (stepExpects('bridge')) await advance()
  }

  const activatePushkin = async () => {
    const r = await api.pushkinActivate(personaId)
    setPopup(null)
    notify(r.message)
    await refresh()
    if (stepExpects('pushkin')) await advance()
  }

  const goalPlan = () => {
    const e = scenario?.step.expect
    const title = e?.action === 'goal' ? String(e.goal) : goals[0]?.title ?? 'Моя цель'
    return {
      title,
      target: e?.action === 'goal' ? Number(e.target) : goals[0]?.target ?? 5000,
      amount: e?.action === 'goal' ? Number(e.amount) : 500,
      goal: goals.find((g) => g.title === title) ?? null,
    }
  }

  const depositToGoal = async () => {
    const plan = goalPlan()
    try {
      const goal = plan.goal ?? (await api.createGoal(personaId, plan.title, plan.target))
      const r = await api.depositGoal(personaId, goal.id, plan.amount)
      setPopup(null)
      notify(r.message)
      await refresh()
      if (stepExpects('goal')) await advance()
    } catch (e) {
      notify((e as Error).message)
    }
  }

  const onAssistantAction = (action: string) => {
    if (action === 'open_sos') setModal({ kind: 'sos' })
    if (action === 'open_shield') setModal({ kind: 'shield', text: lastRecruiterMessage() })
    if (action === 'open_quest') setModal({ kind: 'quest' })
  }

  const resetAccount = async () => {
    await api.resetPersona(personaId)
    clearFlow()
    setScenario(null)
    seenFlagged.current = null
    notify('Аккаунт сброшен к исходному состоянию')
    await refresh()
  }

  if (!persona) {
    return <div className="grid min-h-screen place-items-center text-muted">Загружаем кабинет…</div>
  }

  const frozen = txs.filter((t) => t.frozen).reduce((s, t) => s + t.amount, 0)
  const suspicious = txs.filter((t) => t.flagged && !t.frozen).reduce((s, t) => s + t.amount, 0)
  const xp = progress.xp
  const done = new Set(progress.done)
  const storiesDone = stories.filter((s) => done.has(`lesson:${s.id}`)).length

  const tiles = [
    { icon: 'plus', title: 'Пополнить', sub: 'От родителей или другого человека', onClick: () => setModal({ kind: 'topup' }) },
    { icon: 'send', title: 'Перевести', sub: 'Своим или по номеру телефона', onClick: () => setModal({ kind: 'transfer' }) },
    { icon: 'bag', title: 'Оплатить', sub: 'Одежда, еда, кино, подписки', onClick: () => setModal({ kind: 'pay' }) },
    { icon: 'lifebuoy', title: 'Я влип — что делать?', sub: 'Безопасный выход: план по шагам', onClick: () => setModal({ kind: 'sos' }), accent: true },
  ]
  const cardLabel =
    persona.segment === 'kids' ? '«Детский банк» · карта к счёту мамы' : persona.segment === 'pushkin' ? '«Пушкинская карта»' : 'Карта «Старт» · •• 4821'
  const cardAmount = persona.segment === 'pushkin' ? persona.pushkin_balance ?? 0 : persona.balance
  const mainGoal = goals[0]

  return (
    <div className={`min-h-screen transition-[padding] ${scenario ? 'sm:pr-[420px]' : ''}`}>
      {/* ---------- Шапка ---------- */}
      <header className="sticky top-0 z-10 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-3.5 sm:px-8">
          <Link to="/"><Logo size={34} /></Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {!scenario && (
              <button className="btn-primary px-4 py-2.5 text-sm" onClick={startScenario}>
                <Icon name="play" size={16} /> <span className="hidden sm:inline">Проиграть сценарий</span>
              </button>
            )}
            <button className="btn-ghost hidden px-3 py-2.5 text-sm sm:inline-flex" onClick={resetAccount} title="Сбросить аккаунт">
              <Icon name="reset" size={16} />
            </button>
            <ThemeToggle />
            <button onClick={() => setModal({ kind: 'profile' })} className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-surface" title="Профиль">
              <span className="grid size-9 place-items-center rounded-full font-bold text-white" style={{ background: AVATAR_GRADIENT[persona.id] }}>
                {persona.name[0]}
              </span>
              <span className="hidden text-[15px] font-semibold sm:inline">{persona.name}</span>
            </button>
            <button onClick={() => setSwitching(true)} className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-line hover:text-ink" title="Сменить аккаунт" aria-label="Сменить аккаунт">
              <Icon name="logout" size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-8 sm:px-8">
        <h1 className="text-[34px] font-extrabold tracking-tight sm:text-[44px]">
          {greeting()}, {persona.name}
        </h1>

        {stories.length > 0 && (
          <section className="mt-6">
            <StoriesRow
              stories={stories}
              done={done}
              onOpen={setStory}
              onOpenQuest={() => setModal({ kind: 'quest' })}
              questDone={done.has('quest:drop_job')}
            />
          </section>
        )}

        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* ---------- Левая колонка ---------- */}
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: 'linear-gradient(135deg, #5b3df5 0%, #8b3df5 55%, #ff5fa2 120%)', boxShadow: 'var(--shadow-card)' }}>
              <div className="absolute -right-10 -top-12 size-44 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 right-10 size-36 rounded-full bg-lime/20" />
              <div className="relative">
                <div className="text-sm text-white/75">{cardLabel}</div>
                <div className="mt-2 text-[38px] font-extrabold leading-none tracking-tight">{rub(cardAmount)}</div>
                {persona.segment === 'pushkin' && <div className="mt-1 text-sm text-white/75">на театр, кино и концерты</div>}
                {(suspicious > 0 || frozen > 0) && (
                  <div className="mt-4 space-y-1.5 text-sm">
                    {suspicious > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
                        <Icon name="alert" size={16} /> {rub(suspicious)} под проверкой — не переводите
                      </div>
                    )}
                    {frozen > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
                        <Icon name="lock" size={16} /> {rub(frozen)} заморожено, вернётся отправителю
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => setModal({ kind: 'profile' })} className="card flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-0.5">
              <span className="grid size-12 place-items-center rounded-2xl bg-lime text-ink">
                <Icon name="star" size={22} />
              </span>
              <div className="flex-1">
                <div className="flex justify-between text-[15px]">
                  <span className="font-bold">Уровень {progress.level}</span>
                  <span className="text-muted">{xp % 100} / 100 XP</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-page">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-pink transition-all duration-700" style={{ width: `${xp % 100}%` }} />
                </div>
                <div className="mt-1.5 text-xs text-muted">
                  Историй пройдено: {storiesDone} из {stories.length} · открыть профиль
                </div>
              </div>
            </button>

            {persona.segment !== 'start' && (
              <button
                onClick={() =>
                  setPopup(
                    persona.segment === 'kids'
                      ? { type: 'bridge', title: 'Переход в «Старт»', text: 'Вам исполнилось 14? Перейдите в раздел для 14–22 лет — цели, копилка и опыт сохранятся.' }
                      : { type: 'pushkin', title: '«Старт» для держателей «Пушкинской карты»', text: 'Своя карта, копилка, «Молодёжь Плюс» и защита от мошенников — в одном разделе.' },
                  )
                }
                className="card flex w-full items-center gap-4 p-5 text-left ring-2 ring-brand/30 transition hover:-translate-y-0.5"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white">
                  <Icon name="spark" size={22} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{persona.segment === 'kids' ? 'Скоро 14 — переход в «Старт»' : 'Открыть карту «Старт»'}</span>
                  <span className="block text-sm text-muted">{persona.segment === 'kids' ? 'Без новой заявки, всё сохранится' : 'Бесплатно, за минуту'}</span>
                </span>
                <Icon name="chevron" className="text-muted" />
              </button>
            )}

            <button onClick={() => setModal({ kind: 'goals' })} className="card flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-0.5">
              <span className="grid size-12 place-items-center rounded-2xl bg-sky/15 text-sky">
                <Icon name="piggy" size={22} />
              </span>
              <div className="flex-1">
                {mainGoal ? (
                  <>
                    <div className="flex justify-between text-[15px]">
                      <span className="font-bold">Копилка: {mainGoal.title}</span>
                      <span className="text-muted">{rub(mainGoal.saved)} / {rub(mainGoal.target)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-page">
                      <div className="h-full rounded-full bg-sky transition-all duration-700" style={{ width: `${Math.min(100, (mainGoal.saved / mainGoal.target) * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold">Копилка</div>
                    <div className="text-sm text-muted">Поставьте первую цель</div>
                  </>
                )}
              </div>
            </button>

            <BankSees live={live} />
            <DemoMetrics personaId={personaId} tick={live} />
          </div>

          {/* ---------- Правая колонка ---------- */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {tiles.map((t) => (
                <button
                  key={t.title}
                  onClick={t.onClick}
                  className={`card group flex min-h-[148px] flex-col justify-between p-5 text-left transition hover:-translate-y-0.5 ${t.accent ? 'ring-2 ring-coral/30' : ''}`}
                >
                  <span className={`grid size-11 place-items-center rounded-2xl transition group-hover:scale-110 ${t.accent ? 'bg-coral text-white' : 'bg-brand-soft text-brand'}`}>
                    <Icon name={t.icon} size={21} />
                  </span>
                  <span>
                    <span className="block text-[17px] font-bold">{t.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{t.sub}</span>
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setModal({ kind: 'shield', text: lastRecruiterMessage() })}
              className="card flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-0.5"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-night text-lime">
                <Icon name="shield" size={21} />
              </span>
              <span className="flex-1">
                <span className="block font-bold">Предлагают «лёгкую подработку»?</span>
                <span className="block text-sm text-muted">Проверьте сообщение — покажем признаки мошенничества</span>
              </span>
              <Icon name="chevron" className="text-muted" />
            </button>

            <Spending txs={txs} />
          </div>
        </div>
      </main>

      {/* ---------- Сценарий ---------- */}
      {scenario && (
        <ScenarioPanel
          state={scenario}
          live={live}
          waiting={waiting}
          onNext={nextStep}
          onRestart={startScenario}
          onClose={() => {
            clearFlow()
            setScenario(null)
          }}
          onChatShown={onChatShown}
        />
      )}

      {/* ---------- Модальные окна ---------- */}
      {modal?.kind === 'topup' && <TopUpModal persona={persona} onClose={() => setModal(null)} onDone={onTopUp} />}
      {modal?.kind === 'pay' && <PayModal persona={persona} onClose={() => setModal(null)} onDone={onPay} />}
      {modal?.kind === 'transfer' && (
        <TransferModal persona={persona} profile={live?.profile ?? null} prefill={modal.prefill} onClose={() => setModal(null)} onDone={onTransfer} />
      )}
      {modal?.kind === 'intercept' && (
        <InterceptModal result={modal.result} to={modal.to} amount={modal.amount} onAction={onIntercept} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'sos' && (
        <SosModal
          persona={persona}
          txs={txs}
          initialBranch={modal.branch}
          onClose={() => setModal(null)}
          onChanged={refresh}
          onComplete={() => {
            api.progress(personaId, { action: 'safe_exit' }).then(setProgress)
            if (scenarioOn.current) finishScenario()
            say('Вы всё сделали правильно. Деньги вернутся владельцу через банк, а переписка сохранена как доказательство. Если вам снова напишут — не отвечайте и сразу сообщите банку.', ['Что такое дроп?', 'Как устроен алгоритм?'])
          }}
        />
      )}
      {modal?.kind === 'shield' && (
        <ShieldModal initialText={modal.text} personaId={personaId} onClose={() => setModal(null)} onOpenSos={() => setModal({ kind: 'sos' })} />
      )}
      {modal?.kind === 'profile' && (
        <ProfileModal
          persona={persona}
          progress={progress}
          stories={stories}
          onClose={() => setModal(null)}
          onOpenStory={(i) => {
            setModal(null)
            setStory(i)
          }}
          onOpenQuest={() => setModal({ kind: 'quest' })}
        />
      )}
      {modal?.kind === 'quest' && quest && <QuestModal quest={quest} onClose={() => setModal(null)} onFinish={finishQuest} />}
      {switching && <AccountSwitcher currentId={personaId} onClose={() => setSwitching(false)} />}
      {modal?.kind === 'goals' && (
        <GoalsModal personaId={personaId} goals={goals} onChanged={refresh} onClose={() => setModal(null)} notify={notify} />
      )}
      {popup?.type === 'birthday' && <BirthdayWindow popup={popup} onClose={closePopup} />}
      {popup?.type === 'bridge' && (
        <BridgeWindow popup={popup} goals={goals} xp={progress.xp} onMigrate={migrateBridge} onClose={closePopup} />
      )}
      {popup?.type === 'pushkin' && <PushkinWindow popup={popup} onActivate={activatePushkin} onClose={closePopup} />}
      {popup?.type === 'goal' && (
        <GoalWindow popup={popup} goal={goalPlan().goal} amount={goalPlan().amount} onDeposit={depositToGoal} onClose={closePopup} />
      )}
      {popup && !['birthday', 'bridge', 'pushkin', 'goal'].includes(popup.type) && (
        <ScenarioWindow
          popup={popup}
          personaName={persona.name}
          incoming={incomingTx}
          live={live}
          lastMessage={lastRecruiterMessage()}
          xp={progress.xp}
          actions={popupActions}
        />
      )}
      {push && <Push push={push} onDone={() => setPush(null)} />}
      {story !== null && stories[story] && (
        <StoryViewer
          stories={stories}
          start={story}
          done={done}
          onClose={() => setStory(null)}
          onFinish={finishStory}
          onAction={onAssistantAction}
        />
      )}

      {toast && (
        <div className="animate-rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-night px-5 py-3 text-[15px] font-medium text-white" style={{ boxShadow: 'var(--shadow-pop)' }}>
          {toast}
        </div>
      )}

      <Assistant key={personaId} personaId={personaId} personaName={persona.name} nudge={nudge} ask={ask} onAction={onAssistantAction} shifted={Boolean(scenario)} />
    </div>
  )
}
