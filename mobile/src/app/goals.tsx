// Цели и копилка: пополнить цель или завести новую. В ВТБ — накопительный счёт для 14–25 лет.
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Field, Label } from '@/components/forms'
import { SheetScreen } from '@/components/sheet-screen'
import { Icon } from '@/components/ui/icon'
import { Button, Progress } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { rub } from '@/engine/format'
import * as svc from '@/engine/services'
import { useAccount, useApp } from '@/store/app-store'
import { useUi } from '@/store/ui-store'
import { fonts, gradients } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

export default function Goals() {
  const { c } = useTheme()
  const acc = useAccount()
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  if (!acc) return null
  const ui = useUi.getState()

  const put = (goalId: string, amount: number) => {
    try {
      const r = useApp.getState().mutate((a) => svc.deposit(a, goalId, amount))
      ui.notify(r.message)
      ui.celebrateXp(r.gained)
    } catch (e) {
      ui.notify((e as Error).message)
    }
  }

  const create = () => {
    if (!title.trim() || !(Number(target) > 0)) return
    useApp.getState().mutate((a) => svc.createGoal(a, title.trim(), Number(target)))
    setTitle('')
    setTarget('')
  }

  return (
    <SheetScreen title="Цели и копилка" icon="piggy" iconColor={c.sky}>
      {acc.goals.length === 0 ? (
        <T variant="body" muted>
          Пока нет целей — заведите первую.
        </T>
      ) : null}
      <View style={{ gap: 12 }}>
        {acc.goals.map((g, i) => {
          const pct = Math.min(1, g.saved / g.target)
          return (
            <Enter key={g.id} style={[styles.goal, { backgroundColor: c.page }]}>
              <View style={styles.goalHead}>
                <T variant="title">{g.title}</T>
                <T variant="small" muted>
                  {Math.round(pct * 100)}%
                </T>
              </View>
              <T variant="h3" style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>
                {rub(g.saved)}{' '}
                <T variant="small" muted>
                  из {rub(g.target)}
                </T>
              </T>
              <View style={{ marginTop: 10 }}>
                <Progress value={pct} gradient={gradients.lime} height={10} track={c.surface} />
              </View>
              <View style={styles.chips}>
                {[100, 500, 1000].map((a) => (
                  <PressableScale key={a} haptic onPress={() => put(g.id, a)} style={[styles.chip, { backgroundColor: alpha(c.brand, 0.1) }]}>
                    <Icon name="plus" size={14} color={c.brand} strokeWidth={2.6} />
                    <T variant="small" color={c.brand} style={{ fontFamily: fonts.bold }}>
                      {rub(a)}
                    </T>
                  </PressableScale>
                ))}
              </View>
            </Enter>
          )
        })}
      </View>
      <Label>Новая цель</Label>
      <View style={styles.form}>
        <Field value={title} onChangeText={setTitle} placeholder="На что копим?" style={{ flex: 1 }} />
        <Field value={target} onChangeText={(t) => setTarget(t.replace(/\D/g, ''))} placeholder="Сумма" keyboardType="number-pad" style={{ width: 120 }} />
      </View>
      <Button title="Добавить цель" icon="plus" onPress={create} disabled={!title.trim() || !(Number(target) > 0)} style={{ marginTop: 10 }} />
      <T variant="caption" muted style={{ marginTop: 12 }}>
        В ВТБ копилка — накопительный счёт для 14–25 лет с ежедневными процентами.
      </T>
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  goal: { borderRadius: 22, padding: 16 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  form: { flexDirection: 'row', gap: 8 },
})
