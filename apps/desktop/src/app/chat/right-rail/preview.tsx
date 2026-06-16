import { useStore } from '@nanostores/react'
import { useEffect, useMemo } from 'react'

import type { SetTitlebarToolGroup } from '@/app/shell/titlebar-controls'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { translateNow, useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  $rightRailActiveTabId,
  RIGHT_RAIL_JARVIS_TAB_ID,
  RIGHT_RAIL_PREVIEW_TAB_ID,
  type RightRailTabId,
  selectRightRailTab
} from '@/store/layout'
import {
  $filePreviewTabs,
  $previewReloadRequest,
  $previewTarget,
  closeRightRail,
  closeRightRailTab,
  type PreviewTarget
} from '@/store/preview'
import { $voiceMode, type VoiceModeSnapshot } from '@/store/voice-mode'

import { JarvisPanel } from './jarvis-panel'
import { PreviewPane } from './preview-pane'

export const PREVIEW_RAIL_MIN_WIDTH = '22rem'
export const PREVIEW_RAIL_MAX_WIDTH = '42rem'

const INTRINSIC = `clamp(${PREVIEW_RAIL_MIN_WIDTH}, 34vw, 34rem)`

// Track for <Pane id="preview">. Folds the intrinsic clamp with a min-floor
// against --chat-min-width so the chat surface never gets squeezed below it.
// Subtracts the project browser width so preview yields rather than crushing
// the chat when both right-side panes are open.
export const PREVIEW_RAIL_PANE_WIDTH = `min(${INTRINSIC}, max(0rem, calc(100vw - var(--pane-chat-sidebar-width) - var(--pane-file-browser-width, 0rem) - var(--chat-min-width))))`

interface ChatPreviewRailProps {
  onRestartServer?: (url: string, context?: string) => Promise<string>
  setTitlebarToolGroup?: SetTitlebarToolGroup
}

type JarvisRailTab = {
  id: typeof RIGHT_RAIL_JARVIS_TAB_ID
  kind: 'jarvis'
  label: string
  state: VoiceModeSnapshot
}

type PreviewRailTab = {
  id: RightRailTabId
  kind: 'preview'
  label: string
  target: PreviewTarget
}

type RailTab = JarvisRailTab | PreviewRailTab

function tabLabelFor(target: PreviewTarget): string {
  const value = target.label || target.path || target.source || target.url
  const tail = value.split(/[\\/]/).filter(Boolean).at(-1)

  return tail || value || translateNow('preview.tab')
}

export function ChatPreviewRail({ onRestartServer, setTitlebarToolGroup }: ChatPreviewRailProps) {
  const { t } = useI18n()
  const previewReloadRequest = useStore($previewReloadRequest)
  const activeTabId = useStore($rightRailActiveTabId)
  const filePreviewTabs = useStore($filePreviewTabs)
  const previewTarget = useStore($previewTarget)
  const voiceMode = useStore($voiceMode)

  const tabs = useMemo<readonly RailTab[]>(
    () => [
      ...(voiceMode.active
        ? [{ id: RIGHT_RAIL_JARVIS_TAB_ID, kind: 'jarvis', label: 'Jarvis', state: voiceMode } as JarvisRailTab]
        : []),
      ...(previewTarget
        ? [{ id: RIGHT_RAIL_PREVIEW_TAB_ID, kind: 'preview', label: t.preview.tab, target: previewTarget } as PreviewRailTab]
        : []),
      ...filePreviewTabs.map(({ id, target }) => ({ id, kind: 'preview', label: tabLabelFor(target), target }) as PreviewRailTab)
    ],
    [filePreviewTabs, previewTarget, t.preview.tab, voiceMode]
  )

  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? tabs[0]

  useEffect(() => {
    if (activeTab && activeTab.id !== activeTabId) {
      selectRightRailTab(activeTab.id)
    }
  }, [activeTab, activeTabId])

  if (!activeTab) {
    return null
  }

  const isPreview = activeTab.kind === 'preview' && activeTab.id === RIGHT_RAIL_PREVIEW_TAB_ID
  const previewTabsOpen = tabs.some(tab => tab.kind === 'preview')
  const showRailTabs = activeTab.kind !== 'jarvis' || tabs.length > 1

  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col overflow-hidden border-l border-cyan-200/15 bg-black text-(--ui-text-tertiary)">
      {showRailTabs && (
        <div className="group/rail-tabs flex h-(--titlebar-height) shrink-0 border-b border-cyan-200/12 bg-[#06111f]/95 backdrop-blur-xl">
          <div
            className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            {tabs.map(tab => {
              const active = tab.id === activeTab.id
              const isJarvis = tab.kind === 'jarvis'

              return (
                <div
                  className={cn(
                    'group/tab relative flex h-full min-w-0 max-w-48 shrink-0 items-center text-[0.6875rem] font-medium [-webkit-app-region:no-drag] last:border-r last:border-cyan-200/10',
                    active
                      ? 'bg-[#07182a] text-cyan-50 [--tab-bg:#07182a]'
                      : 'border-r border-cyan-200/10 text-cyan-100/55 [--tab-bg:#06111f] hover:bg-cyan-200/8 hover:text-cyan-50'
                  )}
                  key={tab.id}
                  onAuxClick={event => {
                    if (event.button !== 1 || isJarvis) {
                      return
                    }

                    event.preventDefault()
                    closeRightRailTab(tab.id)
                  }}
                  onMouseDown={event => {
                    if (event.button === 1) {
                      event.preventDefault()
                    }
                  }}
                >
                  {active && (
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.72)]" />
                  )}
                  <Tip label={tab.label}>
                    <button
                      aria-selected={active}
                      className="flex h-full min-w-0 max-w-full items-center gap-1.5 overflow-hidden pl-3 pr-2 text-left outline-none"
                      onClick={() => selectRightRailTab(tab.id)}
                      role="tab"
                      type="button"
                    >
                      {isJarvis && <Codicon name="hubot" size="0.8rem" />}
                      <span className="block min-w-0 truncate">{tab.label}</span>
                    </button>
                  </Tip>
                  {!isJarvis && (
                    <>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-[linear-gradient(to_right,transparent,var(--tab-bg)_55%)] opacity-0 transition-opacity group-hover/tab:opacity-100 group-focus-within/tab:opacity-100"
                      />
                      <button
                        aria-label={t.preview.closeTab(tab.label)}
                        className="pointer-events-none absolute right-1.5 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-sm text-cyan-100/55 opacity-0 transition-[background-color,color,opacity] hover:bg-cyan-200/10 hover:text-cyan-50 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 group-focus-within/tab:pointer-events-auto group-focus-within/tab:opacity-100"
                        onClick={() => closeRightRailTab(tab.id)}
                        type="button"
                      >
                        <Codicon name="close" size="0.75rem" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {previewTabsOpen && (
            <button
              aria-label={t.preview.closePane}
              className="mr-1.5 grid size-6 shrink-0 self-center place-items-center rounded-md text-cyan-100/55 opacity-0 transition-opacity hover:bg-cyan-200/10 hover:text-cyan-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 group-hover/rail-tabs:opacity-100 [-webkit-app-region:no-drag]"
              onClick={() => {
                closeRightRail()
                if (voiceMode.active) {
                  selectRightRailTab(RIGHT_RAIL_JARVIS_TAB_ID)
                }
              }}
              type="button"
            >
              <Codicon name="close" size="0.75rem" />
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab.kind === 'jarvis' ? (
          <JarvisPanel state={voiceMode} />
        ) : (
          <PreviewPane
            embedded
            onRestartServer={isPreview ? onRestartServer : undefined}
            reloadRequest={previewReloadRequest}
            setTitlebarToolGroup={setTitlebarToolGroup}
            target={activeTab.target}
          />
        )}
      </div>
    </aside>
  )
}
