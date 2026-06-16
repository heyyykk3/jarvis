import { atom } from 'nanostores'

export type VoiceModeStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'

export interface VoiceModeSnapshot {
  active: boolean
  level: number
  muted: boolean
  status: VoiceModeStatus
}

const DEFAULT_VOICE_MODE: VoiceModeSnapshot = {
  active: false,
  level: 0,
  muted: false,
  status: 'idle'
}

export const $voiceMode = atom<VoiceModeSnapshot>(DEFAULT_VOICE_MODE)

export function setVoiceModeState(next: Partial<VoiceModeSnapshot>) {
  const current = $voiceMode.get()
  $voiceMode.set({ ...current, ...next })
}

export function resetVoiceModeState() {
  $voiceMode.set(DEFAULT_VOICE_MODE)
}
