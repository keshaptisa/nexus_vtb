// Короткое сообщение внизу экрана: «Перевод отменён», «Зачислено 1 500 ₽».
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useUi } from '@/store/ui-store'
import { useTheme } from '@/theme/use-theme'

import { T } from './ui/text'
import { Enter } from '@/components/ui/enter'

export function ToastHost() {
  const toast = useUi((s) => s.toast)
  const hide = useUi((s) => s.hideToast)
  const insets = useSafeAreaInsets()
  const { c } = useTheme()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hide, 3200)
    return () => clearTimeout(t)
  }, [toast, hide])

  if (!toast) return null
  return (
    <Enter
      key={toast.id}
     
      pointerEvents="none"
      style={[styles.toast, { bottom: insets.bottom + 96, backgroundColor: c.night, shadowColor: c.shadow }]}
    >
      <T variant="bodyStrong" color="#fff" center>
        {toast.text}
      </T>
    </Enter>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 18,
    zIndex: 800,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
})
