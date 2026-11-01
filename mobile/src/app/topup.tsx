// Пополнить: от мамы, папы или незнакомца. Этап 1 алгоритма — подозрительное зачисление помечается.
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AmountInput, Choice, Label } from '@/components/forms'
import { SheetScreen } from '@/components/sheet-screen'
import { Button } from '@/components/ui/kit'
import { T } from '@/components/ui/text'
import { rub } from '@/engine/format'
import { liveRisk } from '@/engine/risk'
import * as svc from '@/engine/services'
import { useApp } from '@/store/app-store'
import { useScenario } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

export default function TopUp() {
  const { c } = useTheme()
  const [sender, setSender] = useState('Мама')
  const [amount, setAmount] = useState('1500')

  const submit = () => {
    const r = useApp.getState().mutate((acc) => {
      const res = svc.topup(acc, sender, Number(amount))
      return { res, live: liveRisk(acc) }
    })
    router.back()
    const tx = r.res.transaction!
    const ui = useUi.getState()
    if (r.res.status === 'flagged') {
      ui.notify(`Зачислено ${rub(tx.amount)} — сумма под проверкой`)
      // Этап 1: новое подозрительное зачисление — Бит пишет сам (в сценарии за это отвечают окна банка)
      if (!useScenario.getState().scenarioId) {
        ui.sayBit(
          `Вам пришло ${rub(tx.amount)} от «${tx.counterparty}». Это необычно для вашего счёта:\n— ` +
            r.live.signals.slice(0, 3).join('\n— ') +
            '\n\nПожалуйста, не переводите эти деньги дальше — даже «обратно», если попросят. Если вам предложили за это процент, это вербовка в дропы.',
          ['Мне пришли чужие деньги', 'Почему нельзя вернуть самому?', 'Что такое дроп?'],
        )
      }
    } else {
      ui.notify(`Зачислено ${rub(tx.amount)}`)
    }
  }

  return (
    <SheetScreen
      title="Пополнить счёт"
      icon="plus"
      footer={<Button title={`Зачислить ${Number(amount) ? rub(Number(amount)) : ''}`} disabled={!Number(amount)} onPress={submit} />}
    >
      <Label>От кого</Label>
      <View style={styles.row}>
        <Choice vertical active={sender === 'Мама'} onPress={() => setSender('Мама')} icon="user" title="Мама" sub="Переводит часто" />
        <Choice vertical active={sender === 'Папа'} onPress={() => setSender('Папа')} icon="user" title="Папа" sub="Переводит часто" />
        <Choice vertical danger active={sender === 'Неизвестный'} onPress={() => setSender('Неизвестный')} icon="alert" title="Незнакомец" sub="Раньше не переводил" />
      </View>
      {sender === 'Неизвестный' ? (
        <Enter kind="fade" style={[styles.note, { backgroundColor: c.page }]}>
          <T variant="small" muted>
            Перевод от человека, который раньше вам не переводил, — например, от «работодателя» из мессенджера. Посмотрите, что сделает банк.
          </T>
        </Enter>
      ) : null}
      <Label>Сумма</Label>
      <AmountInput value={amount} onChange={setAmount} chips={[500, 1500, 5000, 30000]} />
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  note: { marginTop: 12, borderRadius: 16, padding: 12 },
})
