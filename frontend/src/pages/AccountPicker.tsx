import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Persona, ScenarioInfo } from '../api/types'
import { PAGES } from '../components/comic/Pages'
import FlipDeck, { goToSlide, type Slide } from '../components/FlipDeck'
import Icon from '../components/Icon'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { AVATAR_GRADIENT, PERSONA_TAGS } from '../lib'


// Страницы комикса без обложек: роль обложки играет первый экран
const COMIC = PAGES.filter((p) => p.id !== 'cover' && p.id !== 'back')

// Широкий экран — показываем комикс разворотами по две страницы, узкий — по одной
function useSpread() {
  const query = '(min-width: 900px) and (min-aspect-ratio: 1/1)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

// Главная: весь сайт — колода экранов, которые при прокрутке переворачиваются справа налево
export default function AccountPicker() {
  const spread = useSpread()
  const toScenarios = () => goToSlide('scenarios')

  const comicSlides: Slide[] = []
  const step = spread ? 2 : 1
  for (let i = 0; i < COMIC.length; i += step) {
    const pages = COMIC.slice(i, i + step)
    comicSlides.push({
      id: `comic-${i}`,
      label: pages.map((p) => p.label).join('. '),
      node: (
        <div className={spread && pages.length === 2 ? 'comic-spread' : 'comic-single'}>
          {pages.map((p) => (
            <div key={p.id} className="comic-sheet">
              <div className="comic-page" aria-label={p.label}>
                {p.render({ scenarios: toScenarios })}
              </div>
            </div>
          ))}
        </div>
      ),
    })
  }

  const slides: Slide[] = [
    { id: 'hero', label: 'Главная', node: <Hero /> },
    ...comicSlides,
    { id: 'why', label: 'Почему ВТБ и почему сейчас', node: <WhyNow /> },
    { id: 'features', label: 'Что умеет «Старт»', node: <Features /> },
    { id: 'how', label: 'Как это работает', node: <Algorithm /> },
    { id: 'scenarios', label: 'Сценарии', node: <Scenarios /> },
  ]

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-8">
          <button onClick={() => goToSlide('hero')} aria-label="В начало"><Logo size={34} /></button>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button onClick={() => goToSlide('how')} className="chip hidden hover:bg-line sm:inline-flex">Как это работает</button>
            <button onClick={toScenarios} className="chip bg-brand text-white hover:brightness-110">
              <Icon name="play" size={14} /> Сценарии
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main>
        <FlipDeck key={spread ? 'spread' : 'single'} slides={slides} />
      </main>
    </div>
  )
}

// Экран с обычным содержимым: по центру, а если не влез (телефон) — прокручивается внутри
function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="deck-scroll">
      <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-8">{children}</div>
    </div>
  )
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-[760px]">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-[40px]">{title}</h2>
      {text && <p className="mt-3 text-[17px] leading-relaxed text-muted">{text}</p>}
    </div>
  )
}

// ---------- Первый экран ----------
function Hero() {
  return (
    <Screen>
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">Раздел ВТБ Онлайн для 14–22 лет</p>
        <h1 className="mt-4 text-[38px] font-extrabold leading-[1.05] tracking-tight sm:text-[68px]">
          В 14 детский банк заканчивается.
          <br />
          <span className="bg-gradient-to-r from-brand to-pink bg-clip-text text-transparent">Вербовщики — нет.</span>
        </h1>
        <p className="mt-5 max-w-[620px] text-lg leading-relaxed text-muted">
          «Старт» — буфер между детским и взрослым банком: защищает подростка, когда его пытаются использовать, и учит обращаться с первыми деньгами.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => goToSlide('comic-0')} className="btn-primary">Прочитать историю</button>
          <button onClick={() => goToSlide('scenarios')} className="btn-ghost"><Icon name="play" size={16} /> Сразу к сценариям</button>
        </div>
        <p className="mt-12 flex items-center gap-2 text-sm font-semibold text-muted">
          <Icon name="chevron" size={16} className="rotate-90 animate-bounce" /> Прокручивайте — страницы перелистываются
        </p>
      </div>
    </Screen>
  )
}

// ---------- Почему ВТБ и почему сейчас ----------
function WhyNow() {
  const stats = [
    ['×4', 'выросла у ВТБ доля выявленных дропов 14–17 лет', 'I кв. 2026 к I кв. 2025, по данным СМИ; по рынку ЦБ видит снижение'],
    ['> 50%', 'людей в базе дропов ЦБ моложе 25 лет', 'Банк России, сент. 2026, по данным СМИ'],
    ['45%', 'молодых людей знают, что уголовная ответственность наступает с 16 лет', 'опрос команды: 18–22 лет, n = 231'],
  ]
  return (
    <Screen>
      <SectionTitle
        eyebrow="Почему ВТБ и почему сейчас"
        title="Банк под прицелом вербовщиков — а молодёжи у него всё больше"
        text="У ВТБ больше 4 млн клиентов 14–25 лет, а с 2026 года он ещё и оператор «Пушкинской карты». «Старт» защищает их там, где они уже есть."
      />
      <div className="mt-6 grid gap-2.5 sm:mt-8 sm:gap-4 md:grid-cols-3">
        {stats.map(([n, text, src]) => (
          <div key={text} className="card flex items-center gap-4 p-4 sm:block sm:p-6">
            <div className="w-[96px] shrink-0 whitespace-nowrap bg-gradient-to-r from-brand to-pink bg-clip-text text-[34px] font-extrabold leading-none text-transparent sm:w-auto sm:text-[48px]">{n}</div>
            <div>
              <p className="text-[14px] font-semibold leading-snug sm:mt-3 sm:text-[16px]">{text}</p>
              <p className="mt-1 text-xs text-muted sm:mt-3">{src}</p>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}

// ---------- Что умеет «Старт» ----------
function Features() {
  const items = [
    ['/landing/intercept.webp', 'Экран «Перевод остановлен» с причинами и кнопками', 'Перехват с объяснением', 'Деньги незнакомца пытаются переслать дальше — перевод останавливается, а банк объясняет почему и что грозит.'],
    ['/landing/sos.webp', '«Безопасный выход»: шаги с кнопками и юридическим основанием', '«Безопасный выход»', 'Чужие деньги уже пришли: вернуть через банк одной кнопкой, приложить скриншоты, получить черновик обращения.'],
    ['/landing/shield.webp', 'Щит: проверка сообщения вербовщика', 'Щит', 'Текст или скриншот из мессенджера — модель покажет, похоже ли это на вербовку или мошенничество.'],
  ]
  return (
    <Screen>
      <SectionTitle eyebrow="Что умеет «Старт»" title="Помогает тогда, когда это действительно нужно" />
      <div className="deck-row mt-6 sm:mt-8 md:grid md:grid-cols-3">
        {items.map(([img, alt, title, text]) => (
          <div key={title} className="card flex w-[78vw] max-w-[340px] shrink-0 snap-center flex-col overflow-hidden md:w-auto md:max-w-none">
            <div className="grid h-[min(32vh,300px)] place-items-center overflow-hidden bg-page px-6 pt-6">
              <img src={img} alt={alt} className="h-full w-auto rounded-t-2xl object-cover object-top" style={{ boxShadow: 'var(--shadow-card)' }} />
            </div>
            <div className="p-5">
              <h3 className="text-lg font-extrabold">{title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[15px] text-muted">
        А ещё: истории по событию с XP и уровнями, квест «А что было бы, если…», копилка и цели, ассистент Бит.
      </p>
    </Screen>
  )
}

// ---------- Алгоритм ----------
function Algorithm() {
  return (
    <Screen>
      <SectionTitle eyebrow="Как это работает" title="Два этапа: заметить и остановить" />
      <div className="mt-8 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <div className="card p-6 sm:p-8">
          <div className="text-sm font-bold text-sky">Этап 1 · Зачисление</div>
          <h3 className="mt-2 text-xl font-bold">Сравниваем с обычным поведением</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Банк знает ваш профиль: от кого обычно приходят деньги и сколько. 30 000 ₽ от незнакомца — в 20 раз больше обычного —
            помечаются «под проверкой», и банк предупреждает. Не блокирует: запретить получить деньги нельзя.
          </p>
        </div>
        <div className="hidden place-items-center md:grid">
          <Icon name="next" className="text-muted" />
        </div>
        <div className="rounded-[28px] p-6 text-white sm:p-8" style={{ background: 'linear-gradient(135deg, #5b3df5, #ff5fa2)' }}>
          <div className="text-sm font-bold text-white/85">Этап 2 · Перевод</div>
          <h3 className="mt-2 text-xl font-bold">Ловим транзит</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-white/90">
            Модель CatBoost оценивает перевод: сколько пришло от незнакомцев, какую долю пересылают и как быстро. Риск от 0,7 — перевод
            останавливается, причины объясняются человеческим языком.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          ['shield', 'Решают модели', 'Языковая модель только объясняет; без неё — готовые тексты.'],
          ['eye', 'Честно про данные', 'Демо на синтетике. В банке модели дообучаются на подтверждённых случаях.'],
          ['lock', 'В контуре банка', 'Данные клиентов наружу не уходят.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="card flex gap-3 p-5">
            <Icon name={icon} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <div className="font-bold">{title}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted">{text}</div>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}

// ---------- Сценарии: вход в кабинет ----------
function Scenarios() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    // При входе аккаунт всё равно сбрасывается — показываем исходные данные, а не сохранённые после прошлого показа
    Promise.all([api.personas(), api.scenarios()])
      .then(async ([p, s]) => {
        await Promise.all(p.map((x) => api.resetPersona(x.id).catch(() => null)))
        return [await api.personas(), s] as const
      })
      .then(([p, s]) => {
        setPersonas(p)
        setScenarios(s)
      })
      .catch(() => setError('Не удалось подключиться к серверу. Запустите бэкенд: uvicorn app.main:app'))
  }, [])

  return (
    <Screen>
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">Попробуйте сами</p>
        <h2 className="scn-title mt-2">Выберите героя</h2>
        <p className="mx-auto mt-2 max-w-[560px] text-[15px] text-muted sm:text-base">
          Нажмите «Проиграть сценарий» в кабинете — или пополняйте, переводите и платите сами.
        </p>
      </div>
      {error && <div className="card mt-6 p-5 text-risk-high">{error}</div>}
      <div className="scn-grid mt-7 sm:mt-9">
        {personas.map((p, i) => {
          const scenario = scenarios.find((s) => s.persona === p.id)
          return (
            <button
              key={p.id}
              onClick={async () => {
                // Каждый вход — с чистого листа: история из content/personas.json
                await api.resetPersona(p.id).catch(() => null)
                navigate(`/u/${p.id}`)
              }}
              className={`scn-card scn-${p.id} ${i === 3 ? 'scn-row2-a' : i === 4 ? 'scn-row2-b' : ''}`}
            >
              <div className="flex items-center gap-3.5">
                <span className="scn-avatar" style={{ background: AVATAR_GRADIENT[p.id] }}>{p.name[0]}</span>
                <span>
                  <span className="scn-name">{p.name}, {p.age}</span>
                  <span className="scn-tag">{PERSONA_TAGS[p.id]}</span>
                </span>
              </div>
              {scenario && <span className="scn-bubble">{scenario.title}</span>}
              <span className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span className="text-xs font-semibold text-muted">{scenario ? `${scenario.steps_count} шагов` : ''}</span>
                <span className="scn-go">Войти <Icon name="send" size={16} /></span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-8 text-center text-xs text-muted">
        «Старт» — концепт молодёжного раздела для ВТБ Онлайн, команда nexus. Данные в демо синтетические. Это не юридическая консультация.
      </p>
    </Screen>
  )
}
