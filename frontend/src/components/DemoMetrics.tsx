import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { MetricsSummary } from '../api/types'
import Icon from './Icon'
import Modal from './Modal'

// Карточка «Метрики» рядом с «Что видит банк»: продукт измеряет себя уже в демо.
// Цифры — по текущей сессии демо этого аккаунта, цели — из docs/business/business_model.md §6.
export default function DemoMetrics({ personaId, tick }: { personaId: string; tick: unknown }) {
  const [m, setM] = useState<MetricsSummary | null>(null)
  const [open, setOpen] = useState(false)

  // tick меняется после каждого действия в кабинете — тогда и пересчитываем
  useEffect(() => {
    api.metricsSummary(personaId).then(setM).catch(() => {})
  }, [personaId, tick, open])

  if (!m) return <div className="card h-[120px] animate-pulse" />

  return (
    <>
      <button onClick={() => setOpen(true)} className="card w-full p-6 text-left transition hover:-translate-y-0.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name="spark" size={18} />
          </span>
          <h3 className="text-lg font-bold">Метрики</h3>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <span className="text-[34px] font-extrabold leading-none text-brand">{m.prevented_transits}</span>
          <span className="pb-1 text-[14px] leading-snug text-muted">предотвращённых транзитов в этой сессии демо</span>
        </div>
        <div className="mt-3 flex items-center gap-1 text-[15px] font-semibold text-brand">
          Подробнее <Icon name="chevron" size={16} />
        </div>
      </button>

      {open && <MetricsModal m={m} onClose={() => setOpen(false)} />}
    </>
  )
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const time = (s: number | null) => (s === null ? '—' : s < 60 ? `${s} с` : `${Math.round(s / 60)} мин`)

function MetricsModal({ m, onClose }: { m: MetricsSummary; onClose: () => void }) {
  const rows = [
    {
      label: 'Отмены после перехвата',
      value: pct(m.intercept_cancel_rate),
      goal: 'цель ≥ 60%',
      hint: 'Сколько перехваченных переводов не ушло: отмена, звонок в банк или «мне предложили подработку».',
    },
    {
      label: '«Безопасный выход» → действие',
      value: pct(m.safe_exit_conversion),
      goal: 'цель ≥ 50%',
      hint: 'Сколько открытий «Безопасного выхода» закончились действием: вернуть деньги, заблокировать контакт, обращение.',
    },
    {
      label: 'От зачисления до действия',
      value: time(m.median_seconds_to_action),
      goal: 'цель < 10 мин',
      hint: 'Медиана: сколько прошло от подозрительного зачисления до первого защитного шага.',
    },
  ]
  const events = [
    ['intercept_shown', 'Показан перехват'],
    ['intercept_cancelled', 'Перевод не ушёл'],
    ['intercept_continued', '«Это мои деньги»'],
    ['safe_exit_opened', 'Открыт «Безопасный выход»'],
    ['safe_exit_action', 'Действие выхода'],
    ['lesson_completed', 'Пройден урок'],
    ['shield_checked', 'Проверка в Щите'],
  ]

  return (
    <Modal title="Метрики" onClose={onClose} width="max-w-[560px]">
      <div className="rounded-3xl bg-brand-soft p-5">
        <div className="text-sm text-muted">Главная метрика: предотвращённые транзиты</div>
        <div className="mt-1 text-[40px] font-extrabold leading-none text-brand">{m.prevented_transits}</div>
        <p className="mt-2 text-[14px] leading-snug text-ink/75">
          Переводы, которые не ушли после перехвата, и чужие деньги, замороженные для возврата. В пилоте считаем только
          кейсы, подтверждённые аналитиком банка.
        </p>
      </div>

      <ul className="mt-5 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="rounded-2xl bg-page p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{r.label}</span>
              <span className="text-[22px] font-extrabold">{r.value}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3 text-[13px] text-muted">
              <span>{r.hint}</span>
              <span className="shrink-0">{r.goal}</span>
            </div>
          </li>
        ))}
      </ul>

      <h4 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">События</h4>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
        {events.map(([key, label]) => (
          <div key={key} className="flex justify-between gap-2 rounded-xl bg-page px-3 py-2">
            <span className="text-ink/75">{label}</span>
            <b>{m.events[key] ?? 0}</b>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Цифры по текущей сессии демо этого аккаунта, «сначала» обнуляет их. Как считаем: docs/business/metrics.md.
      </p>
    </Modal>
  )
}
