// «Безопасный выход»: что делать, если чужие деньги уже пришли, вы уже переводили, отдали карту или вас заблокировали.
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { LegalNote } from '@/components/legal-note'
import { SheetScreen } from '@/components/sheet-screen'
import { Icon } from '@/components/ui/icon'
import { Button, IconTile, Progress } from '@/components/ui/kit'
import { PressableScale } from '@/components/ui/pressable-scale'
import { T } from '@/components/ui/text'
import { LEGAL, SOS_BRANCHES } from '@/engine/content'
import { rub } from '@/engine/format'
import * as svc from '@/engine/services'
import type { SosBranch } from '@/engine/types'
import { useApp } from '@/store/app-store'
import { onSafeExitComplete } from '@/store/scenario-store'
import { useUi } from '@/store/ui-store'
import { fonts, gradients } from '@/theme/tokens'
import { alpha, useTheme } from '@/theme/use-theme'
import { Enter } from '@/components/ui/enter'

const BRANCH_ICON: Record<string, string> = { A: 'plus', B: 'send', C: 'card', D: 'lock' }

export default function Sos() {
  const { c } = useTheme()
  const params = useLocalSearchParams<{ branch?: string }>()
  const [branchId, setBranchId] = useState<SosBranch['id'] | null>((params.branch as SosBranch['id']) ?? null)
  const [done, setDone] = useState<Record<number, string>>({})
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const branch = SOS_BRANCHES.find((b) => b.id === branchId)

  if (!branch) {
    return (
      <SheetScreen title="Безопасный выход" icon="lifebuoy" iconColor={c.coral}>
        <T variant="body" muted>
          Вы не первый, и это можно исправить. Чем раньше вы сообщите банку, тем проще выйти из ситуации. Выберите, что произошло:
        </T>
        <View style={{ gap: 10, marginTop: 18 }}>
          {SOS_BRANCHES.map((b, i) => (
            <Enter key={b.id}>
              <PressableScale
                haptic
                onPress={() => {
                  setBranchId(b.id)
                  setDone({})
                  setDrafts({})
                }}
                style={[styles.branch, { borderColor: c.line, backgroundColor: c.surface }]}
              >
                <IconTile name={BRANCH_ICON[b.id]} color={c.brand} bg={c.brandSoft} />
                <T variant="title" style={{ flex: 1 }}>
                  {b.title}
                </T>
                <Icon name="chevron" color={c.muted} />
              </PressableScale>
            </Enter>
          ))}
        </View>
        <View style={[styles.call, { backgroundColor: c.page }]}>
          <Icon name="phone" size={18} color={c.riskHigh} />
          <T variant="small" style={{ flex: 1 }}>
            <T variant="small" style={{ fontFamily: fonts.bold }}>
              Угрожают прямо сейчас?{' '}
            </T>
            Звоните 102 — это бесплатно.
          </T>
        </View>
      </SheetScreen>
    )
  }

  const actionable = branch.steps.filter((s) => s.action).length
  const finished = Object.keys(done).length >= actionable

  const run = async (i: number, action: string, withPhotos = false) => {
    const mutate = useApp.getState().mutate
    try {
      let text = ''
      if (action === 'return_funds') {
        const r = mutate((acc) => svc.returnFunds(acc))
        text = r ? `Заморожено ${rub(r.frozen)}, заявка ${r.claimId}. Банк вернёт деньги отправителю.` : 'Подозрительных зачислений не найдено'
      } else if (action === 'evidence' && withPhotos) {
        const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.6 })
        if (pick.canceled || !pick.assets.length) return
        // В демо картинки не храним — считаем и прикладываем номер пакета к обращению (PLAN.md, раздел 15)
        const id = mutate((acc) => svc.addEvidence(acc, pick.assets.length))
        text = `Прикреплено скриншотов: ${pick.assets.length}, номер ${id}. Они попадут в обращение в банк и заявление в полицию.`
      } else if (action === 'pause_outgoing') {
        mutate((acc) => svc.pauseOutgoing(acc))
        text = 'Исходящие переводы на паузе 24 часа'
      } else {
        text = svc.ACTION_RESULTS[action] ?? 'Готово'
        if (action === 'report_bank' || action === 'report_police') {
          const d = mutate((acc) => svc.draft(acc, action, branch.id))
          if (d) setDrafts((x) => ({ ...x, [i]: d }))
        }
      }
      setDone((x) => ({ ...x, [i]: text }))
    } catch (e) {
      setErrors((x) => ({ ...x, [i]: (e as Error).message }))
    }
  }

  const complete = () => {
    const gained = useApp.getState().mutate((acc) => svc.awardAction(acc, 'safe_exit'))
    router.back()
    const ui = useUi.getState()
    ui.celebrateXp(gained)
    onSafeExitComplete()
    ui.sayBit(
      'Вы всё сделали правильно. Деньги вернутся владельцу через банк, а переписка сохранена как доказательство. Если вам снова напишут — не отвечайте и сразу сообщите банку.',
      ['Что такое дроп?', 'Как устроен алгоритм?'],
    )
  }

  return (
    <SheetScreen title={branch.title} onBack={params.branch ? undefined : () => setBranchId(null)}>
      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <Progress value={actionable ? Object.keys(done).length / actionable : 1} gradient={gradients.good} height={8} />
        </View>
        <T variant="small" muted style={{ fontFamily: fonts.bold }}>
          {Object.keys(done).length} / {actionable}
        </T>
      </View>

      <View style={{ gap: 10, marginTop: 14 }}>
        {branch.steps.map((s, i) => {
          const ok = done[i]
          return (
            <Enter
              key={i}
             
              style={[styles.step, { borderColor: ok ? alpha(c.riskLow, 0.45) : c.line, backgroundColor: ok ? alpha(c.riskLow, 0.06) : c.surface }]}
            >
              <View style={[styles.num, { backgroundColor: ok ? c.riskLow : c.page }]}>
                {ok ? (
                  <Enter kind="icon">
                    <Icon name="check" size={15} color="#fff" strokeWidth={3} />
                  </Enter>
                ) : (
                  <T variant="small" style={{ fontFamily: fonts.bold }}>
                    {i + 1}
                  </T>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <T variant="body">{s.text}</T>
                {s.action === 'evidence' && !ok ? (
                  <View style={styles.buttons}>
                    <Button small icon="image" title="Прикрепить скриншоты" onPress={() => run(i, 'evidence', true)} />
                    <Button small kind="ghost" title="Сохранить чат из демо" onPress={() => run(i, 'evidence')} />
                  </View>
                ) : null}
                {s.action && s.action !== 'evidence' && !ok ? (
                  <View style={styles.buttons}>
                    <Button small title={svc.ACTION_LABEL[s.action] ?? 'Выполнить'} onPress={() => run(i, s.action!)} />
                  </View>
                ) : null}
                {s.legal && LEGAL[s.legal] ? <LegalNote items={[LEGAL[s.legal]]} /> : null}
                {errors[i] && !ok ? (
                  <T variant="small" color={c.riskHigh} style={{ marginTop: 6 }}>
                    {errors[i]}
                  </T>
                ) : null}
                {ok ? (
                  <Enter kind="fade">
                    <T variant="small" color={c.ok} style={{ marginTop: 6, fontFamily: fonts.semibold }}>
                      {ok}
                    </T>
                  </Enter>
                ) : null}
                {drafts[i] ? (
                  <Enter kind="fade" style={[styles.draft, { backgroundColor: c.page }]}>
                    <T variant="small" style={{ fontFamily: fonts.bold }}>
                      Черновик — проверьте и отправьте
                    </T>
                    <ScrollView style={{ maxHeight: 220, marginTop: 6 }} nestedScrollEnabled>
                      <T variant="caption" style={{ lineHeight: 18 }}>
                        {drafts[i]}
                      </T>
                    </ScrollView>
                    <View style={{ marginTop: 8, flexDirection: 'row' }}>
                      <Button
                        small
                        kind="outline"
                        icon="copy"
                        title="Скопировать"
                        onPress={() => {
                          Clipboard.setStringAsync(drafts[i]).catch(() => {})
                          useUi.getState().notify('Черновик скопирован')
                        }}
                      />
                    </View>
                  </Enter>
                ) : null}
              </View>
            </Enter>
          )
        })}
      </View>

      <T variant="caption" muted style={{ marginTop: 14 }}>
        Это не юридическая консультация. Тексты — из открытых материалов ЦБ и МВД.
      </T>

      {finished ? (
        <Enter style={styles.final}>
          <LinearGradient colors={gradients.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <T variant="h3" color="#fff">
            Вы всё сделали правильно
          </T>
          <T variant="small" color="rgba(255,255,255,0.88)" style={{ marginTop: 4 }}>
            Банк получил обращение. Дальше с вами свяжется специалист.
          </T>
          <Button kind="light" title="Готово · +50 XP" onPress={complete} style={{ marginTop: 14 }} />
        </Enter>
      ) : null}
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  branch: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, borderRadius: 20, padding: 14 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, marginTop: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { flexDirection: 'row', gap: 12, borderWidth: 1.5, borderRadius: 20, padding: 14 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  draft: { marginTop: 10, borderRadius: 14, padding: 12 },
  final: { marginTop: 18, borderRadius: 24, padding: 20, overflow: 'hidden' },
})
