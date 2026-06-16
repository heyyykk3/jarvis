'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'

interface MarkdownBlock {
  id: string
  title: string
  body: string
  kind: 'note' | 'markdown' | 'quote' | 'checklist'
}

interface KanbanCard {
  id: string
  title: string
  body: string
}

interface KanbanColumn {
  id: 'todo' | 'doing' | 'done'
  title: string
  cards: KanbanCard[]
}

interface MarkdownWorkspaceState {
  activeBlockId: string
  blocks: MarkdownBlock[]
  kanban: KanbanColumn[]
  updatedAt?: null | number
  version?: number
}

type DeskMode = 'notes' | 'blocks' | 'kanban' | 'export'

const STORAGE_KEY = 'hermes.desktop.markdown-workspace.v1'
const API_PATH = '/api/markdown-desk'
const VALID_MODES = new Set<DeskMode>(['notes', 'blocks', 'kanban', 'export'])

const DEFAULT_STATE: MarkdownWorkspaceState = {
  activeBlockId: 'daily-note',
  blocks: [
    {
      id: 'daily-note',
      title: 'Daily note',
      kind: 'note',
      body: 'Write here like a normal note. Jarvis can also add notes here for you.'
    },
    {
      id: 'scratchpad',
      title: 'Scratchpad',
      kind: 'markdown',
      body: 'Links\nSnippets\nDrafts'
    }
  ],
  kanban: [
    { id: 'todo', title: 'To do', cards: [] },
    { id: 'doing', title: 'Doing', cards: [] },
    { id: 'done', title: 'Done', cards: [] }
  ]
}

const modes: Record<DeskMode, { icon: string; label: string }> = {
  notes: { icon: 'note', label: 'Notes' },
  blocks: { icon: 'markdown', label: 'Blocks' },
  kanban: { icon: 'project', label: 'Kanban' },
  export: { icon: 'export', label: 'Export' }
}

function parseDeskMode(value: string | undefined): DeskMode {
  return value && VALID_MODES.has(value as DeskMode) ? (value as DeskMode) : 'notes'
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeState(value: unknown): MarkdownWorkspaceState {
  const raw = value && typeof value === 'object' ? (value as Partial<MarkdownWorkspaceState>) : {}
  const blocks = Array.isArray(raw.blocks) && raw.blocks.length ? raw.blocks : DEFAULT_STATE.blocks
  const kanban = Array.isArray(raw.kanban) && raw.kanban.length ? raw.kanban : DEFAULT_STATE.kanban
  const activeBlockId = raw.activeBlockId && blocks.some(block => block.id === raw.activeBlockId) ? raw.activeBlockId : blocks[0].id

  return { ...raw, activeBlockId, blocks, kanban }
}

function loadFallbackState(): MarkdownWorkspaceState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeState(JSON.parse(raw)) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

async function readDeskState(): Promise<MarkdownWorkspaceState> {
  if (window.hermesDesktop?.api) {
    return normalizeState(await window.hermesDesktop.api<MarkdownWorkspaceState>({ path: API_PATH }))
  }

  return loadFallbackState()
}

async function writeDeskState(state: MarkdownWorkspaceState): Promise<MarkdownWorkspaceState> {
  if (window.hermesDesktop?.api) {
    return normalizeState(await window.hermesDesktop.api<MarkdownWorkspaceState>({ path: API_PATH, method: 'PUT', body: state }))
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

function stateToMarkdown(state: MarkdownWorkspaceState): string {
  const pages = state.blocks.map(block => `# ${block.title}\n\n${block.body.trim()}`).join('\n\n---\n\n')
  const board = state.kanban
    .map(column => {
      const cards = column.cards.map(card => `- [ ] **${card.title}**${card.body ? ` — ${card.body}` : ''}`).join('\n')
      return `## ${column.title}\n${cards || '_No cards yet._'}`
    })
    .join('\n\n')

  return `${pages}\n\n---\n\n# Kanban\n\n${board}\n`
}

export function MarkdownWorkspaceView() {
  const params = useParams()
  const [mode, setMode] = useState<DeskMode>(() => parseDeskMode(params.mode))
  const [state, setState] = useState<MarkdownWorkspaceState>(DEFAULT_STATE)
  const [status, setStatus] = useState('Loading…')
  const [copied, setCopied] = useState(false)
  const modeInfo = modes[mode]
  const pages = mode === 'notes' ? state.blocks.filter(block => block.kind === 'note') : state.blocks.filter(block => block.kind !== 'note')
  const activePage = pages.find(block => block.id === state.activeBlockId) ?? pages[0]
  const combinedMarkdown = useMemo(() => stateToMarkdown(state), [state])

  useEffect(() => {
    setMode(parseDeskMode(params.mode))
  }, [params.mode])

  useEffect(() => {
    let cancelled = false

    void readDeskState()
      .then(next => {
        if (!cancelled) {
          setState(next)
          setStatus('hermesDesktop' in window ? 'Synced' : 'Browser local')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(loadFallbackState())
          setStatus('Local fallback')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const persist = (updater: (current: MarkdownWorkspaceState) => MarkdownWorkspaceState) => {
    setState(current => {
      const next = updater(current)
      setStatus('Saving…')
      void writeDeskState(next)
        .then(saved => {
          setState(saved)
          setStatus('Saved')
        })
        .catch(() => setStatus('Save failed'))
      return next
    })
  }

  const refresh = async () => {
    setStatus('Refreshing…')
    try {
      const next = await readDeskState()
      setState(next)
      setStatus('Synced')
    } catch {
      setStatus('Refresh failed')
    }
  }

  const addPage = () => {
    const id = createId(mode === 'notes' ? 'note' : 'page')
    const next: MarkdownBlock = {
      id,
      title: mode === 'notes' ? 'Untitled note' : 'Untitled page',
      kind: mode === 'notes' ? 'note' : 'markdown',
      body: ''
    }
    persist(current => ({ ...current, activeBlockId: id, blocks: [...current.blocks, next] }))
  }

  const selectPage = (page: MarkdownBlock) => persist(current => ({ ...current, activeBlockId: page.id }))

  const updatePage = (patch: Partial<MarkdownBlock>) => {
    if (!activePage) return
    persist(current => ({
      ...current,
      blocks: current.blocks.map(block => (block.id === activePage.id ? { ...block, ...patch } : block))
    }))
  }

  const removePage = () => {
    if (!activePage || state.blocks.length <= 1) return
    persist(current => {
      const blocks = current.blocks.filter(block => block.id !== activePage.id)
      return { ...current, activeBlockId: blocks[0]?.id ?? '', blocks }
    })
  }

  const addCard = (columnId: KanbanColumn['id']) => {
    const title = window.prompt('Card title')?.trim()
    if (!title) return
    persist(current => ({
      ...current,
      kanban: current.kanban.map(column =>
        column.id === columnId ? { ...column, cards: [...column.cards, { id: createId('card'), title, body: '' }] } : column
      )
    }))
  }

  const moveCard = (cardId: string, fromId: KanbanColumn['id'], direction: -1 | 1) => {
    persist(current => {
      const fromIndex = current.kanban.findIndex(column => column.id === fromId)
      const to = current.kanban[fromIndex + direction]
      const card = current.kanban[fromIndex]?.cards.find(item => item.id === cardId)
      if (!to || !card) return current

      return {
        ...current,
        kanban: current.kanban.map(column => {
          if (column.id === fromId) return { ...column, cards: column.cards.filter(item => item.id !== cardId) }
          if (column.id === to.id) return { ...column, cards: [...column.cards, card] }
          return column
        })
      }
    })
  }

  const removeCard = (cardId: string) => {
    persist(current => ({
      ...current,
      kanban: current.kanban.map(column => ({ ...column, cards: column.cards.filter(card => card.id !== cardId) }))
    }))
  }

  const copyMarkdown = async () => {
    await window.navigator.clipboard.writeText(combinedMarkdown)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-(--ui-chat-surface-background) pt-(--titlebar-height)">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Codicon className="text-(--ui-text-tertiary)" name="markdown" />
            Markdown Desk
            <span className="text-(--ui-text-quaternary)">/</span>
            <Codicon className="text-(--ui-text-tertiary)" name={modeInfo.icon} />
            {modeInfo.label}
          </div>
          <p className="mt-0.5 text-xs text-(--ui-text-tertiary)">
            Simple notes. Pick a page, type normally, done.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-(--ui-text-tertiary)">{status}</span>
          <Button onClick={() => void refresh()} size="sm" variant="outline">Refresh</Button>
          <Button onClick={() => void copyMarkdown()} size="sm" variant="outline">{copied ? 'Copied' : 'Copy Markdown'}</Button>
        </div>
      </header>

      {mode === 'kanban' ? (
        <KanbanMode columns={state.kanban} onAddCard={addCard} onMoveCard={moveCard} onRemoveCard={removeCard} />
      ) : mode === 'export' ? (
        <ExportMode markdown={combinedMarkdown} onCopy={() => void copyMarkdown()} />
      ) : (
        <ObsidianMode
          activePage={activePage}
          mode={mode}
          onAddPage={addPage}
          onRemovePage={removePage}
          onSelectPage={selectPage}
          onUpdatePage={updatePage}
          pages={pages}
        />
      )}
    </div>
  )
}

interface ObsidianModeProps {
  activePage?: MarkdownBlock
  mode: Exclude<DeskMode, 'export' | 'kanban'>
  onAddPage: () => void
  onRemovePage: () => void
  onSelectPage: (page: MarkdownBlock) => void
  onUpdatePage: (patch: Partial<MarkdownBlock>) => void
  pages: MarkdownBlock[]
}

function ObsidianMode({ activePage, mode, onAddPage, onRemovePage, onSelectPage, onUpdatePage, pages }: ObsidianModeProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] overflow-hidden">
      <aside className="flex min-h-0 flex-col border-r border-border/70 bg-background/30">
        <div className="border-b border-border/70 p-3">
          <Button className="w-full" onClick={onAddPage} size="sm">
            <Codicon name="new-file" />
            {mode === 'notes' ? 'New note' : 'New page'}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {pages.map(page => (
            <button
              className={cn(
                'mb-1 flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-sm text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-foreground',
                page.id === activePage?.id && 'border-(--ui-stroke-tertiary) bg-(--ui-control-active-background) text-foreground'
              )}
              key={page.id}
              onClick={() => onSelectPage(page)}
              type="button"
            >
              <Codicon name={page.kind === 'note' ? 'note' : 'markdown'} />
              <span className="min-w-0 flex-1 truncate">{page.title || 'Untitled'}</span>
            </button>
          ))}
          {!pages.length && <div className="p-3 text-center text-xs text-(--ui-text-tertiary)">No pages yet.</div>}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/70 p-3">
          <input
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-(--ui-text-quaternary)"
            disabled={!activePage}
            onChange={event => onUpdatePage({ title: event.target.value })}
            placeholder="Untitled"
            value={activePage?.title ?? ''}
          />
          <Button disabled={!activePage} onClick={onRemovePage} size="sm" variant="ghost">
            <Codicon name="trash" />
          </Button>
        </div>

        <textarea
          className="min-h-0 flex-1 resize-none bg-transparent p-8 text-[1rem] leading-8 text-foreground outline-none placeholder:text-(--ui-text-quaternary)"
          disabled={!activePage}
          onChange={event => onUpdatePage({ body: event.target.value })}
          placeholder="Start writing…"
          spellCheck
          value={activePage?.body ?? ''}
        />
      </main>
    </div>
  )
}

interface KanbanModeProps {
  columns: KanbanColumn[]
  onAddCard: (columnId: KanbanColumn['id']) => void
  onMoveCard: (cardId: string, fromId: KanbanColumn['id'], direction: -1 | 1) => void
  onRemoveCard: (cardId: string) => void
}

function KanbanMode({ columns, onAddCard, onMoveCard, onRemoveCard }: KanbanModeProps) {
  return (
    <main className="min-h-0 flex-1 overflow-hidden p-5">
      <div className="grid h-full grid-cols-3 gap-3">
        {columns.map(column => (
          <div className="flex min-h-0 flex-col rounded-xl border border-border/70 bg-background/70" key={column.id}>
            <div className="flex items-center justify-between border-b border-border/70 px-3 py-2 text-sm font-semibold text-foreground">
              {column.title}
              <Button onClick={() => onAddCard(column.id)} size="icon-xs" variant="ghost"><Codicon name="add" /></Button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {column.cards.map(card => (
                <article className="rounded-lg border border-border/70 bg-(--ui-chat-surface-background) p-3 text-xs" key={card.id}>
                  <div className="font-medium text-foreground">{card.title}</div>
                  {card.body ? <p className="mt-1 text-(--ui-text-tertiary)">{card.body}</p> : null}
                  <div className="mt-3 flex items-center justify-between gap-1 text-(--ui-text-tertiary)">
                    <button disabled={column.id === 'todo'} onClick={() => onMoveCard(card.id, column.id, -1)} type="button">←</button>
                    <button onClick={() => onRemoveCard(card.id)} type="button">remove</button>
                    <button disabled={column.id === 'done'} onClick={() => onMoveCard(card.id, column.id, 1)} type="button">→</button>
                  </div>
                </article>
              ))}
              {!column.cards.length && <div className="rounded-lg border border-dashed border-border/80 p-8 text-center text-xs text-(--ui-text-quaternary)">No cards</div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

function ExportMode({ markdown, onCopy }: { markdown: string; onCopy: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Export Markdown</h2>
          <p className="text-xs text-(--ui-text-tertiary)">Everything in the desk as one Markdown document.</p>
        </div>
        <Button onClick={onCopy} size="sm">Copy all</Button>
      </div>
      <textarea className="min-h-0 flex-1 resize-none rounded-xl border border-border bg-background p-4 font-mono text-xs leading-5 text-foreground outline-none" readOnly value={markdown} />
    </main>
  )
}
