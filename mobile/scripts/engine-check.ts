// Проверка движка без телефона: npx tsx scripts/engine-check.ts
import { FEATURES } from '../src/engine/features'
import { probability } from '../src/engine/risk-model'
import { newAccount, incoming } from '../src/engine/bank'
import { transfer } from '../src/engine/services'
import { liveRisk } from '../src/engine/risk'
import { checkMessage, predictProba } from '../src/engine/shield'

const rows = [
  [3, 30000, 0.9, 1, 1, 1, 16, 420, 12.0, 0, 0, 0, 1, 30000],
  [10080, 0, 0, 0, 0, 0, 16, 420, 1.1, 0, 0, 2, 0, 0],
  [45, 12000, 0.5, 1, 2, 3, 19, 60, 4.0, 1, 1, 0, 3, 6000],
  [40, 21000, 0.4, 0, 2, 6, 20, 800, 5.0, 0, 0, 2, 12, 5000],
]
// predict_proba той же модели в Python (backend/app/ml/models/risk.cbm)
const ref = [0.9728708958009669, 9.703678062933815e-10, 0.9960256706973069, 0.15427314072255235]
rows.forEach((r, i) => {
  const f = Object.fromEntries(FEATURES.map((n, k) => [n, r[k]])) as any
  const p = probability(f)
  console.log('catboost', i, p.toPrecision(8), 'ref', ref[i].toPrecision(8), Math.abs(p - ref[i]) < 1e-6 ? 'OK' : 'MISMATCH')
})

const acc = newAccount('artem')
incoming(acc, 30000, 'Иван К.', true)
console.log('flagged', acc.transactions.at(-1)!.flagged, 'live', JSON.stringify(liveRisk(acc)).slice(0, 300))
const r = transfer(acc, '+79990001234', 27000)
console.log('transfer', r.status, r.risk.score, r.risk.reasons)
const ok = transfer(newAccount('artem'), 'Мама', 300)
console.log('normal transfer', ok.status, ok.risk.score)

const texts = [
  'Привет! Ищем ребят на подработку, без опыта, 3–5к в день Интересно?',
  'Переведи 27 000 на +7 999 000-12-34 по СБП, 3к твои. Только быстро, ок?',
  'Мам, приду домой к семи, купи хлеба',
  'Здравствуйте, служба безопасности банка. Назовите код из смс, ваша карта заблокирована',
  'Мама, я попала в беду, срочно нужны деньги, это мой новый номер',
  'заходи на vk.com/promo там розыгрыш айфона',
]
for (const t of texts) {
  const s = checkMessage(t)
  const p = predictProba(t)
  console.log(JSON.stringify({ t: t.slice(0, 30), risk: s.risk, score: s.score, scheme: s.scheme, flags: s.red_flags, p: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, +v.toFixed(4)])) }))
}
