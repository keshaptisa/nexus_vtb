// «Что видит банк»: оценка риска, что насторожило, обычное поведение клиента, как считается оценка.
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { RiskGauge, RiskPill } from '@/components/risk'
import { SheetScreen } from '@/components/sheet-screen'
import { Icon } from '@/components/ui/icon'
import { T } from '@/components/ui/text'
import { rub } from '@/engine/format'
import { liveRisk } from '@/engine/risk'
import { MODEL_INFO } from '@/engine/risk-model'
import { useAccount } from '@/store/app-store'
import { fonts, riskColor, riskLabel } from '@/theme/tokens'
import { mix, useTheme } from '@/theme/use-theme'
import { STAGGER_MS } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

// Правила — те же, что в engine/risk.ts (и backend/app/services/risk.py)
const RULES = {
  incoming: [
    ['Отправитель раньше вам не переводил', '+0.35'],
    ['Сумма в 5 раз и больше выше обычного пополнения', '+0.30'],
    ['Сумма в 2,5–5 раз выше обычного пополнения', '+0.15'],
    ['Незнакомый отправитель и клиенту меньше 18 лет', '+0.10'],
    ['Два и больше незнакомых отправителя за сутки', '+0.20'],
  ],
  transfer: [
    ['Сколько пришло от незнакомцев за сутки'],
    ['Какую долю пересылают дальше'],
    ['Сколько минут прошло после зачисления'],
    ['Новый ли получатель, возраст клиента и карты'],
    ['Скачок оборота, ночь, снятие наличных'],
  ],
}

function Metric({ icon, label, value, chips, hint, alert }: { icon: string; label: string; value?: string; chips?: string[]; hint: string; alert?: boolean }) {
  const { c } = useTheme()
  return (
    <View style={[styles.metric, { borderColor: c.line }]}>
      <View style={styles.metricHead}>
        <Icon name={icon} size={16} color={c.muted} />
        <T variant="small" muted>
          {label}
        </T>
      </View>
      {value ? (
        <T variant="h3" color={alert ? c.riskHigh : c.ink} style={{ marginTop: 4 }}>
          {value}
        </T>
      ) : null}
      {chips ? (
        <View style={styles.chips}>
          {chips.length ? (
            chips.map((x) => (
              <View key={x} style={[styles.chip, { backgroundColor: c.page }]}>
                <T variant="caption" style={{ fontFamily: fonts.semibold }}>
                  {x}
                </T>
              </View>
            ))
          ) : (
            <T variant="small" muted>
              —
            </T>
          )}
        </View>
      ) : null}
      <T variant="caption" muted style={{ marginTop: 6 }}>
        {hint}
      </T>
    </View>
  )
}

export default function BankSees() {
  const { c } = useTheme()
  const acc = useAccount()
  const live = useMemo(() => (acc ? liveRisk(acc) : null), [acc])
  if (!live) return null
  const color = riskColor[live.level]
  const p = live.profile
  const verdict = {
    low: 'Всё спокойно: ваши операции похожи на обычные. Банк ничего не ограничивает.',
    medium: 'Есть необычные операции. Банк предупреждает вас, но ничего не блокирует.',
    high: 'Похоже на схему с дропами. Перевод таких денег дальше будет остановлен.',
  }[live.level]

  return (
    <SheetScreen title="Что видит банк" icon="eye">
      <Enter style={[styles.hero, { backgroundColor: mix(color, c.surface, 0.1) }]}>
        <View style={styles.heroTop}>
          <View>
            <T variant="small" muted>
              Оценка риска
            </T>
            <T style={[styles.score, { color }]}>{live.score.toFixed(2)}</T>
          </View>
          <RiskPill level={live.level} label={`${riskLabel[live.level]} риск`} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <RiskGauge score={live.score} level={live.level} size={250} />
        </View>
        <T variant="body" style={{ marginTop: 10 }}>
          {verdict}
        </T>
        <View style={styles.legend}>
          {(
            [
              ['до 0.4', 'обычные операции', c.riskLow],
              ['0.4–0.7', 'предупреждение', c.riskMedium],
              ['от 0.7', 'перевод остановлен', c.riskHigh],
            ] as const
          ).map(([a, b, col]) => (
            <View key={a} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: col }]} />
              <T variant="small" color={col} style={{ fontFamily: fonts.extrabold, width: 64 }}>
                {a}
              </T>
              <T variant="small" muted>
                {b}
              </T>
            </View>
          ))}
        </View>
      </Enter>

      <T variant="h3" style={styles.h}>
        Что насторожило
      </T>
      {live.signals.length ? (
        live.signals.map((s, i) => (
          <Enter delay={STAGGER_MS} key={s} style={[styles.signal, { backgroundColor: mix(color, c.surface, 0.08) }]}>
            <Icon name="alert" size={18} color={color} />
            <T variant="body" style={{ flex: 1 }}>
              {s}
            </T>
          </Enter>
        ))
      ) : (
        <T variant="body" muted>
          Ничего: ни одно правило не сработало.
        </T>
      )}

      {p ? (
        <>
          <T variant="h3" style={styles.h}>
            Ваше обычное поведение
          </T>
          <T variant="small" muted style={{ marginBottom: 10 }}>
            С этим банк сравнивает каждую новую операцию. Считается по истории, без подозрительных операций.
          </T>
          <View style={styles.grid}>
            <View style={styles.half}>
              <Metric icon="plus" label="Обычное пополнение" value={`≈ ${rub(p.avg_topup)}`} hint="Если пришло в 5 раз больше — это сигнал." />
            </View>
            <View style={styles.half}>
              <Metric icon="bag" label="Обычная трата" value={`≈ ${rub(p.avg_spend)}`} hint="Перевод в разы больше выглядит необычно." />
            </View>
          </View>
          <Metric icon="users" label="Свои отправители" chips={p.known_senders} hint="Перевод от нового человека повышает риск." />
          <View style={{ height: 10 }} />
          <Metric icon="send" label="Свои получатели" chips={p.known_recipients} hint="Перевод новому человеку — дополнительный сигнал." />
          <View style={{ height: 10 }} />
          <Metric
            icon="zap"
            label="Скорость транзита"
            value={p.min_transit_minutes == null ? 'Транзита не было' : `${p.min_transit_minutes} мин`}
            alert={p.min_transit_minutes != null}
            hint="Сколько прошло между зачислением от незнакомца и переводом дальше. Чем быстрее, тем больше похоже на дропа."
          />
        </>
      ) : null}

      <T variant="h3" style={styles.h}>
        Как считается оценка
      </T>
      <View style={[styles.rules, { backgroundColor: c.page }]}>
        <T variant="title">1. Деньги пришли</T>
        <T variant="caption" muted>
          Помечаем, но не блокируем: запретить получить деньги нельзя
        </T>
        {RULES.incoming.map(([rule, pts]) => (
          <View key={rule} style={styles.rule}>
            <T variant="small" style={{ flex: 1 }}>
              {rule}
            </T>
            <T variant="small" color={c.brand} style={{ fontFamily: fonts.extrabold }}>
              {pts}
            </T>
          </View>
        ))}
      </View>
      <View style={[styles.rules, { backgroundColor: c.page, marginTop: 10 }]}>
        <T variant="title">2. Деньги уходят дальше</T>
        <T variant="caption" muted>
          Решает модель CatBoost прямо на телефоне ({MODEL_INFO.trees} деревьев). От 0.7 — перевод остановлен
        </T>
        {RULES.transfer.map(([rule]) => (
          <View key={rule} style={styles.rule}>
            <View style={[styles.ruleDot, { backgroundColor: c.brand }]} />
            <T variant="small" style={{ flex: 1 }}>
              {rule}
            </T>
          </View>
        ))}
      </View>
      <T variant="caption" muted style={{ marginTop: 12 }}>
        Решение принимает алгоритм, ассистент только объясняет его. Данные в демо синтетические.
      </T>
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, padding: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  score: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 50 },
  legend: { gap: 6, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  h: { marginTop: 24, marginBottom: 10 },
  signal: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  half: { flex: 1 },
  metric: { borderWidth: 1.5, borderRadius: 18, padding: 14 },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rules: { borderRadius: 18, padding: 14 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  ruleDot: { width: 6, height: 6, borderRadius: 3 },
})
