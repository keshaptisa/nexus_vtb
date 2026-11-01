// Перевести: своим или по номеру. Этап 2 алгоритма — CatBoost на телефоне решает, остановить ли перевод.
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AmountInput, Choice, Field, Label } from '@/components/forms'
import { SheetScreen } from '@/components/sheet-screen'
import { Button } from '@/components/ui/kit'
import { T } from '@/components/ui/text'
import { available } from '@/engine/bank'
import { rub } from '@/engine/format'
import { profile } from '@/engine/risk'
import * as svc from '@/engine/services'
import { useAccount, useApp } from '@/store/app-store'
import { onTransferIntercepted } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

export default function Transfer() {
  const { c } = useTheme()
  const acc = useAccount()
  const [prefill] = useState(() => useUi.getState().transferPrefill)
  useEffect(() => () => useUi.getState().set({ transferPrefill: null }), [])
  const contacts = useMemo(
    () => [...new Set(['Мама', 'Папа', ...(acc ? profile(acc).known_recipients : [])])].slice(0, 6),
    [acc],
  )
  const external = prefill?.to && !contacts.includes(prefill.to)
  const [to, setTo] = useState(prefill?.to && !external ? prefill.to : contacts[0])
  const [byPhone, setByPhone] = useState(Boolean(external))
  const [phone, setPhone] = useState(external ? prefill!.to! : '')
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '')
  const [error, setError] = useState('')
  if (!acc) return null
  const target = byPhone ? phone.trim() : to

  const submit = () => {
    setError('')
    const sum = Number(amount)
    const r = useApp.getState().mutate((a) => svc.transfer(a, target, sum))
    if (r.status === 'error') return setError(r.message ?? 'Не получилось')
    if (r.status === 'intercepted') {
      useUi.getState().set({ intercept: { result: r, to: target, amount: sum } })
      router.replace('/intercept')
      onTransferIntercepted()
      useUi
        .getState()
        .sayBit(
          'Я остановил этот перевод. Похоже, вам пришли чужие деньги, и их просят переслать дальше — это классическая схема с дропами. Ничего страшного ещё не произошло: можно отменить перевод и спокойно вернуть деньги через банк.',
          ['Открыть «Безопасный выход»', 'Что мне грозит?', 'Как устроен алгоритм?'],
        )
      return
    }
    router.back()
    useUi.getState().notify(`Переведено ${rub(sum)} → ${target}`)
  }

  return (
    <SheetScreen
      title="Перевести"
      icon="send"
      footer={
        <Button
          title={`Перевести ${Number(amount) ? rub(Number(amount)) : ''}`}
          disabled={!Number(amount) || !target}
          onPress={submit}
        />
      }
    >
      <Label>Кому</Label>
      <View style={styles.grid}>
        {contacts.map((name) => (
          <View key={name} style={styles.cell}>
            <Choice
              active={!byPhone && to === name}
              onPress={() => {
                setTo(name)
                setByPhone(false)
              }}
              icon="user"
              title={name.replace(' (друг)', '')}
              sub={name.includes('(друг)') ? 'Друг · переводили раньше' : 'Переводили раньше'}
            />
          </View>
        ))}
        <View style={styles.cell}>
          <Choice active={byPhone} onPress={() => setByPhone(true)} icon="phone" title="По номеру" sub="Новый получатель" />
        </View>
      </View>
      {byPhone ? (
        <Enter kind="fade" style={{ marginTop: 12 }}>
          <Field value={phone} onChangeText={setPhone} placeholder="+7 900 000-00-00" keyboardType="phone-pad" autoFocus={!phone} />
        </Enter>
      ) : null}
      <Label>Сумма</Label>
      <AmountInput value={amount} onChange={setAmount} chips={[200, 500, 1000, 27000]} />
      <T variant="small" muted style={{ marginTop: 10 }}>
        Доступно {rub(available(acc))}
      </T>
      {error ? (
        <Enter kind="fade" style={[styles.error, { backgroundColor: c.dangerSoft }]}>
          <T variant="small" color={c.riskHigh}>
            {error}
          </T>
        </Enter>
      ) : null}
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48.5%' },
  error: { marginTop: 14, borderRadius: 14, padding: 12 },
})
