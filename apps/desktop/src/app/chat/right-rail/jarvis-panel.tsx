import { type CSSProperties } from 'react'

import type { VoiceModeSnapshot } from '@/store/voice-mode'

function statusTone(state: VoiceModeSnapshot) {
  if (state.muted) {
    return 'muted'
  }

  return state.active ? state.status : 'idle'
}

export function JarvisPanel({ state }: { state: VoiceModeSnapshot }) {
  const level = Math.max(0.05, Math.min(state.level || 0, 1))

  if (!state.active) {
    return null
  }

  return (
    <section
      aria-label="Jarvis voice visualizer"
      className="jarvis-aura-panel relative isolate grid h-full min-h-0 w-full place-items-center overflow-hidden bg-black"
      data-status={statusTone(state)}
      role="status"
      style={{ '--voice-level': level } as CSSProperties}
    >
      <div aria-hidden className="jarvis-aura-backdrop absolute inset-0 -z-10" />
      <div className="jarvis-aura-visualizer" aria-hidden="true">
        <span className="jarvis-aura-glow jarvis-aura-glow-a" />
        <span className="jarvis-aura-glow jarvis-aura-glow-b" />
        <span className="jarvis-aura-ring jarvis-aura-ring-a" />
        <span className="jarvis-aura-ring jarvis-aura-ring-b" />
        <span className="jarvis-aura-ring jarvis-aura-ring-c" />
        <span className="jarvis-aura-center" />
      </div>
    </section>
  )
}
