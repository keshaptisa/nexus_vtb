// Щит: проверка подозрительного сообщения прямо на телефоне — классификатор TF-IDF + логрег и признаки схемы.
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Field } from '@/components/forms'
import { SheetScreen } from '@/components/sheet-screen'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { checkMessage, SCHEME_LABEL } from '@/engine/shield'
import type { ShieldResult } from '@/engine/types'
import { useUi } from '@/store/ui-store'
import { fonts, riskColor, riskLabel } from '@/theme/tokens'
import { mix, useTheme } from '@/theme/use-theme'
import { STAGGER_MS } from '@/theme/motion'
import { Enter } from '@/components/ui/enter'

const EXAMPLES = [
  'Подработка без опыта! Прими перевод на карту и перешли дальше, 10% оставь себе',
  'Здравствуйте, служба безопасности банка. Назовите код из смс',
  'Куплю баланс Пушкинской карты, плачу наличными',
  'Мам, задержусь на тренировке, буду к восьми',
]

export default function Shield() {
  const { c } = useTheme()
  const [text, setText] = useState(() => useUi.getState().shieldText)
  useEffect(() => () => useUi.getState().set({ shieldText: '' }), [])
  const [result, setResult] = useState<ShieldResult | null>(null)
  const [nonce, setNonce] = useState(0)

  const check = (value = text) => {
    if (!value.trim()) return
    setResult(checkMessage(value))
    setNonce((n) => n + 1)
  }

  const color = result ? riskColor[result.risk] : c.brand

  return (
    <SheetScreen title="Проверить сообщение" icon="shield" iconColor={c.night}>
      <T variant="body" muted>
        Вставьте текст из мессенджера — покажем признаки мошенничества. Проверка идёт на телефоне, текст никуда не отправляется.
      </T>
      <Field
        value={text}
        onChangeText={(t) => {
          setText(t)
          setResult(null)
        }}
        multiline
        placeholder="Например: «Подработка без опыта, прими перевод и перешли дальше»"
        style={styles.area}
        textAlignVertical="top"
      />
      <View style={styles.row}>
        <Button title="Проверить" icon="shield" disabled={!text.trim()} onPress={() => check()} style={{ flex: 1 }} />
        <Button
          kind="ghost"
          icon="paste"
          title="Вставить"
          onPress={async () => {
            const t = await Clipboard.getStringAsync().catch(() => '')
            if (t) {
              setText(t)
              check(t)
            } else useUi.getState().notify('В буфере обмена нет текста')
          }}
        />
      </View>

      {!result ? (
        <>
          <T variant="label" muted style={{ marginTop: 22, marginBottom: 8 }}>
            Примеры
          </T>
          <View style={{ gap: 8 }}>
            {EXAMPLES.map((e) => (
              <PressableScale
                key={e}
                onPress={() => {
                  setText(e)
                  check(e)
                }}
                style={[styles.example, { backgroundColor: c.page }]}
              >
                <Icon name="chat" size={16} color={c.muted} />
                <T variant="small" style={{ flex: 1 }} numberOfLines={2}>
                  {e}
                </T>
              </PressableScale>
            ))}
          </View>
        </>
      ) : (
        <View key={nonce} style={{ marginTop: 20, gap: 16 }}>
          <Enter style={[styles.verdict, { backgroundColor: mix(color, c.surface, 0.12) }]}>
            <View style={[styles.verdictIcon, { backgroundColor: color }]}>
              <Icon name={result.risk === 'low' ? 'check' : 'alert'} size={24} color="#fff" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="h3">Риск: {riskLabel[result.risk]}</T>
              <T variant="small" color={color} style={{ fontFamily: fonts.bold }}>
                {SCHEME_LABEL[result.scheme] ?? 'Мошенничество'} · {result.score.toFixed(2)}
              </T>
            </View>
          </Enter>
          <Enter delay={STAGGER_MS}>
            <T variant="body">{result.explanation}</T>
          </Enter>
          {result.red_flags.length ? (
            <Enter delay={2 * STAGGER_MS}>
              <T variant="title">Признаки</T>
              <View style={styles.flags}>
                {result.red_flags.map((f) => (
                  <View key={f} style={[styles.flag, { backgroundColor: c.page }]}>
                    <T variant="small" style={{ fontFamily: fonts.semibold }}>
                      {f}
                    </T>
                  </View>
                ))}
              </View>
            </Enter>
          ) : null}
          {result.advice.length ? (
            <Enter delay={3 * STAGGER_MS}>
              <T variant="title">Что делать</T>
              {result.advice.map((a) => (
                <T key={a} variant="body" style={{ marginTop: 4 }}>
                  — {a}
                </T>
              ))}
            </Enter>
          ) : null}
          {result.consequences.length ? (
            <Enter delay={3 * STAGGER_MS} style={[styles.consequences, { backgroundColor: mix(c.riskHigh, c.surface, 0.08) }]}>
              <T variant="title">Чем это грозит</T>
              {result.consequences.map((x) => (
                <T key={x} variant="small" style={{ marginTop: 4 }}>
                  — {x}
                </T>
              ))}
            </Enter>
          ) : null}
          {result.scheme === 'drop_recruitment' ? (
            <Button kind="ghost" icon="lifebuoy" title="Открыть «Безопасный выход»" onPress={() => router.replace('/sos')} />
          ) : null}
        </View>
      )}
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  area: { marginTop: 14, minHeight: 120 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  example: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 16 },
  verdictIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  flag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  consequences: { borderRadius: 18, padding: 14 },
})
