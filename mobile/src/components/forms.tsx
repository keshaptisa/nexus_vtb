// Элементы форм: крупное поле суммы с быстрыми суммами, выбор варианта, текстовое поле.
import { useState } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'

import { rub } from '@/engine/format'
import { fonts } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'

import { Icon } from './ui/icon'
import { PressableScale } from './ui/pressable-scale'
import { T } from './ui/text'

export function AmountInput({ value, onChange, chips }: { value: string; onChange: (v: string) => void; chips: number[] }) {
  const { c } = useTheme()
  const [focus, setFocus] = useState(false)
  const pretty = value ? Number(value).toLocaleString('ru-RU') : ''
  return (
    <View>
      <View style={[styles.amountBox, { borderColor: focus ? c.brand : c.line, backgroundColor: c.surface }]}>
        <TextInput
          value={pretty}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 7))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={c.muted}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[styles.amount, { color: c.ink }]}
        />
        <T style={[styles.currency, { color: c.muted }]}>₽</T>
      </View>
      <View style={styles.chips}>
        {chips.map((x) => (
          <PressableScale key={x} onPress={() => onChange(String(x))} style={[styles.chip, { backgroundColor: c.page }]}>
            <T variant="small" style={{ fontFamily: fonts.semibold }}>
              {rub(x)}
            </T>
          </PressableScale>
        ))}
      </View>
    </View>
  )
}

export function Choice({
  active,
  onPress,
  icon,
  title,
  sub,
  danger,
  vertical,
}: {
  active: boolean
  onPress: () => void
  icon: string
  title: string
  sub?: string
  danger?: boolean
  vertical?: boolean
}) {
  const { c } = useTheme()
  const tone = danger ? c.riskHigh : c.brand
  return (
    <PressableScale
      haptic
      onPress={onPress}
      style={[
        styles.choice,
        vertical ? styles.choiceV : styles.choiceH,
        { borderColor: active ? tone : c.line, backgroundColor: active ? alpha(tone, 0.08) : c.surface },
      ]}
    >
      <View style={[styles.choiceIcon, { backgroundColor: active ? tone : c.page }]}>
        <Icon name={icon} size={19} color={active ? '#fff' : c.ink} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <T variant="title" numberOfLines={1}>
          {title}
        </T>
        {sub ? (
          <T variant="caption" muted numberOfLines={2}>
            {sub}
          </T>
        ) : null}
      </View>
    </PressableScale>
  )
}

export function Field(props: TextInputProps) {
  const { c } = useTheme()
  const [focus, setFocus] = useState(false)
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      onFocus={(e) => {
        setFocus(true)
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocus(false)
        props.onBlur?.(e)
      }}
      style={[styles.field, { color: c.ink, borderColor: focus ? c.brand : c.line, backgroundColor: c.surface }, props.style]}
    />
  )
}

export function Label({ children }: { children: string }) {
  return (
    <T variant="label" muted style={styles.label}>
      {children}
    </T>
  )
}

const styles = StyleSheet.create({
  amountBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 20, paddingHorizontal: 18 },
  amount: { flex: 1, fontFamily: fonts.extrabold, fontSize: 34, paddingVertical: 14, fontVariant: ['tabular-nums'] },
  currency: { fontFamily: fonts.extrabold, fontSize: 30 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  choice: { borderWidth: 2, borderRadius: 18, padding: 12, gap: 10 },
  choiceH: { flexDirection: 'row', alignItems: 'center' },
  choiceV: { flex: 1, alignItems: 'flex-start' },
  choiceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  field: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fonts.medium, fontSize: 16 },
  label: { marginTop: 22, marginBottom: 10 },
})
