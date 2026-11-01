// Вход за героя: сброс счёта, остановка сценария, приветствие Бита.
import { START_SUGGESTIONS } from '@/engine/assistant'
import { RAW_PERSONAS } from '@/engine/content'

import { useApp } from './app-store'
import { stopScenario } from './scenario-store'
import { useUi } from './ui-store'

export function enterAs(id: string) {
  stopScenario()
  useApp.getState().choosePersona(id)
  useUi.getState().resetBit(
    `Здравствуйте, ${RAW_PERSONAS[id].name}! Я Бит, помощник раздела «Старт». Подскажу, если с деньгами происходит что-то странное, и отвечу на вопросы.`,
    START_SUGGESTIONS,
  )
}

export function resetCurrent() {
  const id = useApp.getState().personaId
  if (!id) return
  stopScenario()
  useApp.getState().resetPersona(id)
  useUi.getState().notify('Аккаунт сброшен к исходному состоянию')
}
