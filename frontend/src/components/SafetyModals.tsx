import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { InterceptAction, LegalItem, Persona, ShieldResult, SosBranch, Transaction, TransferResponse } from '../api/types'
import { RISK_COLOR, RISK_LABEL, readAsDataUrl, rub } from '../lib'
import Icon from './Icon'
import Modal from './Modal'

// ---------- Перехват перевода ----------
const CONTINUE_PAUSE_S = 5

export function InterceptModal({ result, to, amount, onAction, onClose }: {
  result: TransferResponse
  to: string
  amount: number
  onAction: (a: InterceptAction) => void
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [legal, setLegal] = useState<LegalItem[]>([])
  // «Это мои деньги» доступна не сразу: пауза, чтобы не «протыкать» экран по привычке (опрос, H4)
  const [wait, setWait] = useState(CONTINUE_PAUSE_S)
  const it = result.intercept!

  useEffect(() => {
    api.legal().then(setLegal).catch(() => {})
  }, [])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  // Последствия на экране — короткие формулировки из legal.json; находим их записи, чтобы показать источники
  const basis = legal.filter((x) => it.consequences.includes(x.short))

  if (confirming) {
    return (
      <Modal title="Вы уверены?" onClose={onClose} onBack={() => setConfirming(false)}>
        <p className="text-[15px] leading-relaxed text-ink/80">
          Если это действительно ваши деньги — перевод можно провести. Но если вас попросили «принять и переслать»,
          отвечать за операцию будете вы, а не тот, кто попросил.
        </p>
        <ul className="mt-4 space-y-2 text-[15px]">
          {['Я знаю отправителя лично', 'Меня никто не торопит и не обещает процент', 'Получатель — не «куратор» из чата'].map((x) => (
            <li key={x} className="flex gap-2.5 rounded-2xl bg-page p-3">
              <Icon name="check" size={18} className="mt-px shrink-0 text-brand" />
              {x}
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-2">
          <button className="btn-primary" onClick={() => setConfirming(false)}>Вернуться, я передумал</button>
          <button className="btn-ghost text-muted" onClick={() => onAction('continue')}>
            Всё верно, перевести {rub(amount)}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      tone="danger"
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-risk-high text-white">
            <Icon name="lock" size={22} />
          </span>
          {it.title}
        </span>
      }
    >
      <div className="rounded-2xl bg-page p-4 text-sm">
        <span className="text-muted">Перевод </span>
        <b>{rub(amount)}</b>
        <span className="text-muted"> → {to}</span>
      </div>
      <p className="mt-4 text-[17px] font-semibold leading-snug">{it.text}</p>

      {it.consequences.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-2xl p-3.5 text-[14px] leading-snug" style={{ background: 'color-mix(in srgb, var(--color-risk-high) 8%, var(--color-surface))' }}>
          {it.consequences.map((c) => <li key={c}>— {c}</li>)}
        </ul>
      )}

      {/* По итогам опроса: «много текста» — причины и основание свёрнуты, главное видно сразу */}
      <details className="group mt-3 rounded-2xl px-4 py-3 ring-1 ring-ink/10">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
          Почему банк остановил перевод?
          <Icon name="chevron" size={16} className="text-muted transition group-open:rotate-90" />
        </summary>
        <ul className="mt-3 space-y-1.5">
          {result.risk.reasons.map((r) => (
            <li key={r} className="flex gap-2.5 text-[15px]">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-risk-high" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-3 text-xs text-muted">Это не юридическая консультация.</div>
        <LegalNote items={basis} />
      </details>

      <div className="mt-5 grid gap-2">
        <button className="btn-primary" onClick={() => onAction('cancel')}>Отменить перевод</button>
        <div className="grid gap-2 sm:grid-cols-3">
          <button className="btn-ghost text-[14px]" onClick={() => onAction('offered_job')}>
            <Icon name="lifebuoy" size={17} /> Мне предложили подработку
          </button>
          <button className="btn-ghost text-[14px]" onClick={() => onAction('call_bank')}>
            <Icon name="phone" size={17} /> Позвонить в банк
          </button>
          <button className="btn-ghost text-[14px]" onClick={() => onAction('check_message')}>
            <Icon name="shield" size={17} /> Проверить сообщение
          </button>
        </div>
        <button
          className="mt-1 text-sm font-semibold text-muted enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          disabled={wait > 0}
          onClick={() => setConfirming(true)}
        >
          {wait > 0 ? `Это мои деньги — можно через ${wait} с` : 'Это мои деньги, продолжить'}
        </button>
      </div>
    </Modal>
  )
}

// Основание шага: формулировка из content/legal.json и ссылки на первоисточники
function LegalNote({ items }: { items: LegalItem[] }) {
  if (!items.length) return null
  return (
    <details className="group mt-2 text-[13px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-brand">
        <Icon name="chevron" size={14} className="transition group-open:rotate-90" /> Основание
      </summary>
      {items.map((item) => (
        <div key={item.id} className="mt-2 rounded-2xl bg-page p-3 leading-snug">
          <p className="font-semibold">{item.short}</p>
          <p className="mt-1 text-ink/75">{item.full}</p>
          <ul className="mt-2 space-y-1">
            {item.sources.map((src) => {
              const [url, ...rest] = src.split(' — ')
              return (
                <li key={src}>
                  <a href={url} target="_blank" rel="noreferrer" className="break-words text-brand underline underline-offset-2">
                    {rest.join(' — ') || new URL(url).hostname}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </details>
  )
}

// ---------- Безопасный выход ----------
const BRANCH_ICON: Record<string, string> = { A: 'plus', B: 'send', C: 'card', D: 'lock' }
const ACTION_LABEL: Record<string, string> = {
  return_funds: 'Вернуть через банк',
  block_contact: 'Заблокировать контакт',
  evidence: 'Сохранить переписку',
  notify_parent: 'Подготовить сообщение взрослому',
  pause_outgoing: 'Поставить переводы на паузу',
  report_bank: 'Сообщить банку',
  report_police: 'Подготовить заявление',
  block_card: 'Заблокировать карту',
  logout_all: 'Выйти со всех устройств',
}

export function SosModal({ persona, txs, initialBranch, onClose, onChanged, onComplete }: {
  persona: Persona
  txs: Transaction[]
  initialBranch?: SosBranch['id']
  onClose: () => void
  onChanged: () => void
  onComplete: () => void
}) {
  const [branches, setBranches] = useState<SosBranch[]>([])
  const [branchId, setBranchId] = useState<SosBranch['id'] | null>(initialBranch ?? null)
  const [done, setDone] = useState<Record<number, string>>({})
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)

  const [legal, setLegal] = useState<Record<string, LegalItem>>({})

  useEffect(() => {
    api.sosBranches().then(setBranches)
    api.legal().then((items) => setLegal(Object.fromEntries(items.map((x) => [x.id, x])))).catch(() => {})
  }, [])

  const branch = branches.find((b) => b.id === branchId)
  const actionable = branch?.steps.filter((s) => s.action).length ?? 0
  const finished = branch && Object.keys(done).length >= actionable

  const run = async (i: number, action: string, files?: FileList | null) => {
    setBusy(i)
    try {
      let text = ''
      if (action === 'return_funds') {
        const incoming = [...txs].reverse().find((t) => t.direction === 'in' && (t.flagged || t.is_new_counterparty) && !t.frozen)
        if (!incoming) text = 'Подозрительных зачислений не найдено'
        else {
          const r = await api.returnFunds(persona.id, incoming.id)
          text = `Заморожено ${rub(r.frozen_amount)}, заявка ${r.claim_id}. Банк вернёт деньги отправителю.`
        }
      } else if (action === 'evidence' && files?.length) {
        const r = await api.evidence(persona.id, await Promise.all([...files].map(readAsDataUrl)))
        text = `Прикреплено скриншотов: ${r.count}, номер ${r.evidence_id}. Они попадут в обращение в банк и заявление в полицию.`
      } else if (action === 'pause_outgoing') {
        await api.pauseOutgoing(persona.id)
        text = 'Исходящие переводы на паузе 24 часа'
      } else {
        const r = await api.sosAction(persona.id, action, branchId ?? undefined)
        text = r.result
        if (r.draft) setDrafts((d) => ({ ...d, [i]: r.draft! }))
      }
      setDone((d) => ({ ...d, [i]: text }))
      onChanged()
    } catch (e) {
      setErrors((x) => ({ ...x, [i]: (e as Error).message }))
    } finally {
      setBusy(null)
    }
  }

  if (!branch) {
    return (
      <Modal title="Безопасный выход" onClose={onClose}>
        <p className="mb-5 text-[15px] leading-relaxed text-muted">
          Вы не первый, и это можно исправить. Чем раньше вы сообщите банку, тем проще выйти из ситуации.
          Выберите, что произошло:
        </p>
        <div className="grid gap-2">
          {branches.map((b) => (
            <button key={b.id} onClick={() => { setBranchId(b.id); setDone({}) }} className="flex items-center gap-4 rounded-2xl border-2 border-line p-4 text-left transition hover:border-brand/40">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon name={BRANCH_ICON[b.id]} />
              </span>
              <span className="flex-1 font-semibold">{b.title}</span>
              <Icon name="chevron" className="text-muted" />
            </button>
          ))}
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={branch.title} onClose={onClose} onBack={() => setBranchId(null)}>
      <ol className="space-y-3">
        {branch.steps.map((s, i) => (
          <li key={i} className={`rounded-2xl border p-4 transition ${done[i] ? 'border-risk-low/40 bg-risk-low/5' : 'border-line'}`}>
            <div className="flex gap-3">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done[i] ? 'bg-risk-low text-white' : 'bg-page'}`}>
                {done[i] ? <Icon name="check" size={15} strokeWidth={2.6} /> : i + 1}
              </span>
              <div className="flex-1">
                <p className="text-[15px] leading-snug">{s.text}</p>
                {s.action === 'evidence' && !done[i] && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className={`btn-primary cursor-pointer px-4 py-2 text-sm ${busy !== null ? 'pointer-events-none opacity-50' : ''}`}>
                      <Icon name="image" size={16} /> {busy === i ? 'Прикрепляем…' : 'Прикрепить скриншоты'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files
                          if (files?.length) run(i, 'evidence', files)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    <button className="btn-ghost px-4 py-2 text-sm" disabled={busy !== null} onClick={() => run(i, 'evidence')}>
                      Сохранить чат из демо
                    </button>
                  </div>
                )}
                {s.action && s.action !== 'evidence' && !done[i] && (
                  <button className="btn-primary mt-3 px-4 py-2 text-sm" disabled={busy !== null} onClick={() => run(i, s.action!)}>
                    {busy === i ? 'Выполняем…' : ACTION_LABEL[s.action] ?? 'Выполнить'}
                  </button>
                )}
                {s.legal && legal[s.legal] && <LegalNote items={[legal[s.legal]]} />}
                {errors[i] && !done[i] && <p className="mt-2 text-sm font-medium text-risk-high">{errors[i]}</p>}
                {done[i] && <p className="animate-fade mt-2 text-sm font-medium text-ok">{done[i]}</p>}
                {drafts[i] && (
                  <details className="animate-fade mt-2 rounded-2xl bg-page p-3" open>
                    <summary className="cursor-pointer text-sm font-semibold">Черновик — проверьте и отправьте</summary>
                    <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-snug text-ink/80">{drafts[i]}</pre>
                    <button className="chip mt-2 bg-surface text-ink hover:bg-line" onClick={() => navigator.clipboard?.writeText(drafts[i])}>
                      Скопировать
                    </button>
                  </details>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted">Это не юридическая консультация. Тексты — из открытых материалов ЦБ и МВД.</p>
      {finished && (
        <div className="animate-rise mt-5 rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #5b3df5, #ff5fa2)' }}>
          <div className="text-lg font-bold">Вы всё сделали правильно</div>
          <p className="mt-1 text-sm text-white/85">Банк получил обращение. Дальше с вами свяжется специалист.</p>
          <button className="btn mt-4 bg-surface text-ink" onClick={() => { onComplete(); onClose() }}>
            Готово · +50 XP
          </button>
        </div>
      )}
    </Modal>
  )
}

// ---------- Проверка сообщения (Щит) ----------
export function ShieldModal({ initialText = '', personaId, onClose, onOpenSos }: {
  initialText?: string
  personaId?: string
  onClose: () => void
  onOpenSos: () => void
}) {
  const [text, setText] = useState(initialText)
  const [result, setResult] = useState<ShieldResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const check = async () => {
    setBusy(true)
    setError('')
    try {
      setResult(await api.shield(text, personaId))
    } finally {
      setBusy(false)
    }
  }

  // Скриншот переписки → распознаём текст на сервере (EasyOCR) → та же проверка
  const checkImage = async (file: File) => {
    const dataUrl = await readAsDataUrl(file)
    setPreview(dataUrl)
    setResult(null)
    setError('')
    setBusy(true)
    try {
      const r = await api.shieldImage(dataUrl, personaId)
      setResult(r)
      if (r.recognized_text) setText(r.recognized_text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Проверить сообщение" onClose={onClose}>
      <p className="mb-3 text-[15px] text-muted">Вставьте текст из мессенджера или загрузите скриншот — покажем признаки мошенничества.</p>
      <textarea
        className="field min-h-[110px] resize-none"
        placeholder="Например: «Подработка без опыта, прими перевод и перешли дальше»"
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null) }}
      />
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button className="btn-primary" disabled={!text.trim() || busy} onClick={check}>
          {busy ? 'Проверяем…' : 'Проверить'}
        </button>
        <label className={`btn-ghost cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`} title="Загрузить скриншот переписки">
          <Icon name="image" size={18} /> <span className="hidden sm:inline">Скриншот</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) checkImage(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {preview && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-page p-2.5 text-sm text-muted">
          <img src={preview} alt="Скриншот" className="size-14 rounded-xl object-cover" />
          {busy ? 'Распознаём текст на скриншоте…' : result?.recognized_text ? 'Текст распознан и подставлен в поле выше' : 'Скриншот загружен'}
        </div>
      )}
      {error && <div className="mt-3 rounded-2xl bg-risk-high/10 p-3 text-sm text-risk-high">{error}</div>}

      {result && (
        <div className="animate-rise mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: `color-mix(in srgb, ${RISK_COLOR[result.risk]} 10%, var(--color-surface))` }}>
            <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: RISK_COLOR[result.risk] }}>
              <Icon name={result.risk === 'low' ? 'check' : 'alert'} size={20} />
            </span>
            <div>
              <div className="font-bold">Риск: {RISK_LABEL[result.risk]}</div>
              <div className="text-sm text-muted">{result.explanation}</div>
            </div>
          </div>
          {result.red_flags.length > 0 && (
            <div>
              <div className="text-sm font-bold">Признаки</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.red_flags.map((f) => <span key={f} className="chip bg-page">{f}</span>)}
              </div>
            </div>
          )}
          {result.advice.length > 0 && (
            <div>
              <div className="text-sm font-bold">Что делать</div>
              <ul className="mt-2 space-y-1 text-[15px]">
                {result.advice.map((a) => <li key={a}>— {a}</li>)}
              </ul>
            </div>
          )}
          {result.scheme === 'drop_recruitment' && (
            <button className="btn-ghost w-full" onClick={onOpenSos}>
              <Icon name="lifebuoy" size={18} /> Открыть «Безопасный выход»
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
