// Вся история операций: фильтр и группировка по дням. Список виртуализирован.
import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'

import { TxRow } from '@/components/finance'
import { SheetScreen } from '@/components/sheet-screen'
import { Chip } from '@/components/ui/kit'
import { T } from '@/components/ui/text'
import { dayTitle } from '@/engine/format'
import type { Transaction } from '@/engine/types'
import { useAccount } from '@/store/app-store'
import { useTheme } from '@/theme/use-theme'

type Row = { kind: 'day'; key: string; title: string } | { kind: 'tx'; key: string; t: Transaction }

const renderRow = ({ item }: { item: Row }) => (item.kind === 'day' ? <DayHeader title={item.title} /> : <TxRow t={item.t} />)

function DayHeader({ title }: { title: string }) {
  return (
    <T variant="label" muted style={styles.day}>
      {title}
    </T>
  )
}

export default function History() {
  const { c } = useTheme()
  const acc = useAccount()
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')
  const rows = useMemo(() => {
    const list = [...(acc?.transactions ?? [])].reverse().filter((t) => filter === 'all' || t.direction === filter)
    const out: Row[] = []
    let last = ''
    for (const t of list) {
      const d = dayTitle(t.ts)
      if (d !== last) {
        out.push({ kind: 'day', key: `d-${d}-${t.id}`, title: d })
        last = d
      }
      out.push({ kind: 'tx', key: t.id, t })
    }
    return out
  }, [acc, filter])

  return (
    <SheetScreen title="История операций" icon="history" scroll={false}>
      <View style={styles.filters}>
        <Chip label="Все" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Пополнения" active={filter === 'in'} onPress={() => setFilter('in')} />
        <Chip label="Траты и переводы" active={filter === 'out'} onPress={() => setFilter('out')} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.line }]} />}
        ListEmptyComponent={
          <T variant="body" muted center style={{ marginTop: 30 }}>
            Операций нет
          </T>
        }
        initialNumToRender={20}
      />
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  day: { marginTop: 18, marginBottom: 4 },
  sep: { height: StyleSheet.hairlineWidth },
})
