// Оплатить покупку. Покупки в магазинах — не транзит, отдельного скоринга нет.
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AmountInput, Label } from '@/components/forms'
import { SheetScreen } from '@/components/sheet-screen'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { rub } from '@/engine/format'
import * as svc from '@/engine/services'
import { useApp } from '@/store/app-store'
import { useUi } from '@/store/ui-store'
import { alpha, useTheme } from '@/theme/use-theme'

const SHOPS = [
  { merchant: 'Магазин одежды', category: 'clothes', icon: 'shirt', amount: 2490 },
  { merchant: 'Доставка еды', category: 'food', icon: 'food', amount: 690 },
  { merchant: 'Кинотеатр', category: 'fun', icon: 'film', amount: 450 },
  { merchant: 'Подписка на музыку', category: 'subscriptions', icon: 'music', amount: 249 },
  { merchant: 'Игровой магазин', category: 'fun', icon: 'game', amount: 999 },
  { merchant: 'Проездной', category: 'other', icon: 'bus', amount: 1200 },
]

export default function Pay() {
  const { c } = useTheme()
  const [shop, setShop] = useState(SHOPS[0])
  const [amount, setAmount] = useState(String(SHOPS[0].amount))
  const [error, setError] = useState('')

  const submit = () => {
    const r = useApp.getState().mutate((acc) => svc.pay(acc, shop.merchant, shop.category, Number(amount)))
    if (r.status === 'rejected') return setError(r.message)
    router.back()
    useUi.getState().notify(`Оплачено: ${shop.merchant}, ${rub(Number(amount))}`)
  }

  return (
    <SheetScreen
      title="Оплатить покупку"
      icon="bag"
      footer={<Button title={`Оплатить ${Number(amount) ? rub(Number(amount)) : ''}`} disabled={!Number(amount)} onPress={submit} />}
    >
      <Label>Где</Label>
      <View style={styles.grid}>
        {SHOPS.map((s) => {
          const on = s === shop
          return (
            <PressableScale
              key={s.merchant}
              haptic
              onPress={() => {
                setShop(s)
                setAmount(String(s.amount))
                setError('')
              }}
              style={[styles.shop, { borderColor: on ? c.brand : c.line, backgroundColor: on ? alpha(c.brand, 0.08) : c.surface }]}
            >
              <View style={[styles.icon, { backgroundColor: on ? c.brand : c.page }]}>
                <Icon name={s.icon} size={19} color={on ? '#fff' : c.ink} />
              </View>
              <T variant="small" style={{ fontFamily: 'Manrope_700Bold' }} numberOfLines={2}>
                {s.merchant}
              </T>
            </PressableScale>
          )
        })}
      </View>
      <Label>Сумма</Label>
      <AmountInput value={amount} onChange={setAmount} chips={[shop.amount, 500, 1000, 3000]} />
      {error ? (
        <View style={[styles.error, { backgroundColor: c.dangerSoft }]}>
          <T variant="small" color={c.riskHigh}>
            {error}
          </T>
        </View>
      ) : null}
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shop: { width: '31.6%', borderWidth: 2, borderRadius: 18, padding: 12, gap: 10, minHeight: 104 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 14, borderRadius: 14, padding: 12 },
})
