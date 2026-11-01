// Щит: проверка подозрительного сообщения прямо на телефоне. Порт backend/app/services/shield.py,
// backend/app/ml/text.py и shield_model.py. Вердикт — классификатор TF-IDF + логистическая регрессия
// (shield.json из ml/) плюс баллы за группы признаков схемы. LLM нет: объяснения — готовые шаблоны.
//
// В Python \w и \b понимают кириллицу, в JavaScript — нет. Поэтому вместо них явный класс букв W.
import shieldJson from '../content/models/shield.json'
import { LEGAL } from './content'
import type { RiskLevel, ShieldResult } from './types'

const W = 'a-zа-яё0-9_'
const wordEnd = `(?![${W}])`

// ---------- Токенизация (ml/text.py) ----------
const URL_RE = new RegExp(
  `https?:\\/\\/\\S+|www\\.\\S+|(^|[^${W}])([${W}]\\S*?\\.(?:ru|com|net|org|io|me|xyz|top|site))${wordEnd}\\S*`,
  'g',
)
const WORD_RE = /[a-zа-я0]+|[%₽$💰💸🔥✅❗]/gu

export function normalize(text: string): string {
  const low = text.toLowerCase().replace(/ё/g, 'е')
  const noUrls = low.replace(URL_RE, (_m, pre?: string) => `${pre ?? ''} ссылка `)
  return noUrls.replace(/\d+/g, '0')
}

/** Слова, пары слов и буквенные n-граммы 3–5 внутри слов (устойчивы к опечаткам) */
export function analyze(text: string): string[] {
  const words = normalize(text).match(WORD_RE) ?? []
  const feats = words.map((w) => `w:${w}`)
  for (let i = 0; i + 1 < words.length; i++) feats.push(`b:${words[i]}_${words[i + 1]}`)
  for (const w of words) {
    if ([...w].length < 3) continue
    const padded = `<${w}>`
    for (const n of [3, 4, 5]) for (let i = 0; i + n <= padded.length; i++) feats.push(`c:${padded.slice(i, i + n)}`)
  }
  return feats
}

// ---------- Модель (ml/shield_model.py) ----------
interface ShieldModel {
  classes: string[]
  vocabulary: Record<string, number>
  idf: number[]
  coef: number[][]
  intercept: number[]
}
const model = shieldJson as unknown as ShieldModel

export function predictProba(text: string): Record<string, number> {
  const tf = new Map<string, number>()
  for (const t of analyze(text)) tf.set(t, (tf.get(t) ?? 0) + 1)
  const vec = new Map<number, number>()
  for (const [term, cnt] of tf) {
    const j = model.vocabulary[term]
    if (j !== undefined) vec.set(j, (1 + Math.log(cnt)) * model.idf[j]) // sublinear_tf
  }
  let norm = 0
  for (const v of vec.values()) norm += v * v
  norm = Math.sqrt(norm) || 1
  const logits = model.coef.map((w, k) => {
    let z = model.intercept[k]
    for (const [j, v] of vec) z += (w[j] * v) / norm
    return z
  })
  const top = Math.max(...logits)
  const exp = logits.map((z) => Math.exp(z - top))
  const s = exp.reduce((a, b) => a + b, 0)
  return Object.fromEntries(model.classes.map((c, k) => [c, exp[k] / s]))
}

// ---------- Признаки схемы (services/shield.py) ----------
const DROP_SIGNALS: Record<string, [RegExp, string]> = {
  receive: [
    new RegExp(
      'прими(те)? перевод|принять перевод|принимать перевод|прид[её]т (перевод|деньги|сумма|\\d)' +
        `|(упад[её]т|поступ[${W}]*|зачисл[${W}]*) \\d` +
        '|(кину|скину|отправлю|переведу|закину) (тебе |вам )?(денег|деньги|бабк|бабл|сумму|\\d)|дам (тебе |вам )?(денег|деньги)' +
        '|на лапу|на твою карту|на вашу карту',
    ),
    'Обещают прислать деньги на вашу карту',
  ],
  forward: [
    new RegExp(
      '(переведи|переведите|отправь|отправьте|скинь|скиньте) (их |эти деньги |все )?(дальше|кому|на (номер|карту|эту|другую|указанн))' +
        '|перешли|пересла|перевести дальше|кому (надо|скажу|скажут)|по (этому |моему )?номеру|на другую карту|обратно на',
    ),
    'Просят переслать деньги дальше',
  ],
  cut: [
    new RegExp(`\\d+\\s?%|процент|оставь себе|оставишь себе|оставишь|\\d+\\s?к (твои|тебе|себе)|твои${wordEnd}|заплачу \\d|\\d+\\s?к за`),
    'Обещают вознаграждение за перевод',
  ],
  card: [
    new RegExp(
      '(сдать|продать|оформить|одолжи|дай|нужна) (мне )?(твою |твоя |свою |вашу |ваша )?карт|данные карты|номер карты и|cvc|cvv' +
        '|доступ к (приложению|банку|личному)|логин|пароль от',
    ),
    'Просят карту, её данные или доступ к банку',
  ],
  job: [
    /без опыта|л[её]гк(ий|ие|ая|ого) (заработ|деньг)|подработк|работа с переводами|есть тема|на пару дней|быстрые деньги/,
    '«Подработка» с лёгкими деньгами',
  ],
}
const RUSH: [RegExp, string] = [/срочно|быстро|только быстро|прямо сейчас|пока не|до вечера|в течение часа/, 'Вас торопят']

const OTHER_FRAUD: [RegExp, string, string][] = [
  [
    /служб[аы] безопасности|безопасный сч[её]т|код из (смс|сообщения)|назови(те)? код|сообщи(те)? код|карт[ау] (заблокир|взломал)|подозрительн(ая|ую) операци/,
    'phishing',
    'Представляются банком и просят код или перевод',
  ],
  [
    new RegExp(
      `(мам|пап|бабушк|дедушк|сестр|брат)[${W}]*[^.!?]{0,40}(бед[аеу]|дтп|полиц|больниц|срочно)` +
        '|попал[аи]? в (беду|дтп|больниц|полици)|срочно нужны деньги|это мой новый номер',
    ),
    'relative_in_trouble',
    'Срочная просьба денег от «родственника»',
  ],
  [/выиграл|ваш приз|розыгрыш|бесплатн(ый|о|ые) (айфон|подарок|приз)|получите приз/, 'prize', 'Сообщают о выигрыше или подарке'],
]
const LINK = new RegExp(`https?:\\/\\/|www\\.|bit\\.ly|(?:^|[^${W}])[${W}]+\\.(ru|com|net|xyz|top|site|io)${wordEnd}`)

const norm = (text: string) => text.toLowerCase().replace(/ё/g, 'е').replace(/(.)\1{2,}/gu, '$1$1') // «даааа» → «даа»

/** Вердикт = вероятность модели + признаки схемы → [схема, оценка, признаки] */
export function classify(text: string): [string, number, string[]] {
  if (!text.trim()) return ['safe', 0, []]
  const low = norm(text)
  const groups: Record<string, string> = {}
  for (const [name, [re, msg]] of Object.entries(DROP_SIGNALS)) if (re.test(low)) groups[name] = msg
  const groupCount = Object.keys(groups).length
  const rush = RUSH[0].test(low)
  const other = OTHER_FRAUD.filter(([re]) => re.test(low)).map(([, scheme, msg]) => [scheme, msg] as const)
  const link = LINK.test(low)

  const proba = predictProba(text)
  let drop = (proba.drop_recruitment ?? 0) + 0.18 * groupCount
  if ('receive' in groups && ('forward' in groups || 'cut' in groups)) drop += 0.2 // пришлют → перешли / оставь процент
  if ('card' in groups) drop += 0.15 // просьба карты или доступа опасна сама по себе
  let fraud = (proba.other_fraud ?? 0) + 0.3 * other.length + (link ? 0.1 : 0)
  if (rush && (groupCount || other.length)) {
    drop += groupCount ? 0.05 : 0
    fraud += other.length ? 0.05 : 0
  }
  drop = Math.min(drop, 0.99)
  fraud = Math.min(fraud, 0.99)
  const best = Math.max(drop, fraud)
  const r2 = (x: number) => Math.round(x * 100) / 100

  // Без единого признака схемы полагаемся только на модель — и требуем от неё уверенности
  if (!groupCount && !other.length && !link && best < 0.6) return ['safe', r2(best), []]
  if (best < 0.4) return ['safe', r2(best), []]

  if (drop >= fraud) {
    const flags = Object.values(groups)
    if (!flags.length) flags.push('Похоже на типичные сообщения вербовщиков')
    if (rush) flags.push(RUSH[1])
    return ['drop_recruitment', drop, flags]
  }
  const scheme = other[0]?.[0] ?? 'other_fraud'
  const flags = other.length ? other.map(([, m]) => m) : ['Похоже на типичную мошенническую схему']
  if (link) flags.push('В сообщении есть ссылка')
  if (rush) flags.push(RUSH[1])
  return [scheme, fraud, flags]
}

function template(scheme: string, risk: RiskLevel): [string, string[]] {
  if (scheme === 'drop_recruitment' && risk === 'medium')
    return [
      'Есть признаки вербовки в дропы, но не все. Если вам предлагают принять деньги на карту и переслать их дальше — это схема, даже если звучит как подработка или просьба знакомого.',
      ['Не принимайте и не пересылайте чужие деньги', 'Уточните, кто пишет, по другому каналу', 'Если деньги уже пришли — откройте «Безопасный выход»'],
    ]
  if (scheme === 'drop_recruitment')
    return [
      'Похоже на вербовку в дропы: через вашу карту хотят провести чужие, скорее всего украденные деньги. Это не подработка — отвечать за операции будете вы.',
      ['Не отвечайте и не передавайте данные карты', 'Заблокируйте отправителя', 'Если деньги уже пришли — откройте «Безопасный выход»'],
    ]
  if (scheme === 'safe') return ['Явных признаков мошенничества не нашли. Но если вас торопят или просят деньги — остановитесь и проверьте.', []]
  if (scheme === 'relative_in_trouble')
    return [
      'Похоже на схему «родственник в беде»: мошенники пишут с нового номера и просят срочно перевести деньги.',
      ['Позвоните родственнику по старому номеру', 'Задайте вопрос, ответ на который знает только он', 'Не переводите, пока не убедитесь'],
    ]
  if (scheme === 'phishing')
    return [
      'Похоже на мошенников, которые представляются банком. Настоящий банк не просит коды из СМС и не переводит деньги на «безопасный счёт».',
      ['Положите трубку или не отвечайте', 'Не называйте коды и данные карты', 'Позвоните в банк по номеру на обороте карты'],
    ]
  return [
    'Похоже на мошенничество: вас пытаются заставить действовать быстро и без проверки.',
    ['Не переходите по ссылкам и не называйте коды', 'Позвоните в банк по номеру на карте'],
  ]
}

export function checkMessage(text: string): ShieldResult {
  const [scheme, score, flags] = classify(text)
  const risk: RiskLevel = scheme === 'safe' ? 'low' : score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  const [explanation, advice] = template(scheme, risk)
  const consequences =
    scheme === 'drop_recruitment' ? ['card_block', 'cbr_base', 'uk187'].filter((k) => LEGAL[k]).map((k) => LEGAL[k].short) : []
  return { risk, score: Math.round(score * 100) / 100, scheme, red_flags: flags, explanation, consequences, advice }
}

export const SCHEME_LABEL: Record<string, string> = {
  drop_recruitment: 'Вербовка в дропы',
  phishing: 'Звонок «из банка»',
  relative_in_trouble: '«Родственник в беде»',
  prize: '«Вы выиграли»',
  other_fraud: 'Мошенничество',
  safe: 'Явных признаков нет',
}
