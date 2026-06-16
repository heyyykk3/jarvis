import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getGoogleCalendar,
  getGoogleGmail,
  getGoogleStatus,
  revokeGoogleAuth,
  saveGoogleClientSecret,
  startGoogleAuth,
  submitGoogleAuthCode,
  type GoogleCalendarEvent,
  type GoogleGmailMessage,
  type GoogleStatusResponse
} from '@/hermes'
import { AtSign, CalendarDays, CheckCircle2, ExternalLink, Mail, RefreshCw, Trash2 } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'

import { Pill, SectionHeading, SettingsContent } from './primitives'

function compactScopes(scopes: string[]) {
  return scopes
    .map(scope => scope.replace('https://www.googleapis.com/auth/', ''))
    .join(', ')
}

function GoogleStatusPill({ status }: { status: GoogleStatusResponse | null }) {
  if (!status) {
    return <Pill>checking</Pill>
  }
  if (status.connected) {
    return <Pill tone="primary">connected</Pill>
  }
  if (status.has_client_secret) {
    return <Pill>ready to sign in</Pill>
  }
  return <Pill>setup needed</Pill>
}

function MessageRow({ message }: { message: GoogleGmailMessage }) {
  return (
    <div className="rounded-md border border-border/35 bg-card/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground">{message.subject || '(No subject)'}</div>
          <div className="mt-1 truncate text-[0.7rem] text-muted-foreground">{message.from}</div>
        </div>
        <div className="shrink-0 text-[0.65rem] text-muted-foreground/70">{message.date}</div>
      </div>
      {message.snippet && <div className="mt-2 line-clamp-2 text-[0.72rem] text-muted-foreground">{message.snippet}</div>}
    </div>
  )
}

function EventRow({ event }: { event: GoogleCalendarEvent }) {
  return (
    <div className="rounded-md border border-border/35 bg-card/45 p-3">
      <div className="text-xs font-medium text-foreground">{event.summary || '(No title)'}</div>
      <div className="mt-1 text-[0.7rem] text-muted-foreground">
        {event.start || 'No start'} {event.end ? `→ ${event.end}` : ''}
      </div>
      {event.location && <div className="mt-1 text-[0.7rem] text-muted-foreground/80">{event.location}</div>}
    </div>
  )
}

export function GoogleSettings() {
  const [status, setStatus] = useState<GoogleStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [clientJson, setClientJson] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [gmail, setGmail] = useState<GoogleGmailMessage[]>([])
  const [calendar, setCalendar] = useState<GoogleCalendarEvent[]>([])
  const [showCredentials, setShowCredentials] = useState(false)
  const [showCodeBox, setShowCodeBox] = useState(false)

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getGoogleStatus()
      setStatus(next)
      if (!next.has_client_secret) {
        setShowCredentials(next.client_secret_source !== 'app')
      }
      if (next.has_pending_auth) {
        setShowCodeBox(true)
      }
    } catch (err) {
      notifyError(err, 'Google status failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPreview = useCallback(async () => {
    if (!status?.connected) {
      return
    }
    setBusy('preview')
    try {
      const [messages, events] = await Promise.all([getGoogleGmail(5), getGoogleCalendar(7, 8)])
      setGmail(messages.messages)
      setCalendar(events.events)
    } catch (err) {
      notifyError(err, 'Google preview failed')
    } finally {
      setBusy(null)
    }
  }, [status?.connected])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (status?.connected) {
      void loadPreview()
    }
  }, [loadPreview, status?.connected])

  const saveCredentials = async () => {
    setBusy('credentials')
    try {
      let payload: Parameters<typeof saveGoogleClientSecret>[0]
      if (clientJson.trim()) {
        payload = { client_secret_json: JSON.parse(clientJson) as Record<string, unknown> }
      } else {
        payload = { client_id: clientId.trim(), client_secret: clientSecret.trim() }
      }
      const result = await saveGoogleClientSecret(payload)
      setStatus(result.status)
      setClientJson('')
      setClientId('')
      setClientSecret('')
      setShowCredentials(false)
      notify({ kind: 'success', message: 'Google app sign-in credentials saved' })
    } catch (err) {
      notifyError(err, 'Google app sign-in credentials failed')
    } finally {
      setBusy(null)
    }
  }

  const startLogin = async () => {
    if (!status?.has_client_secret) {
      setShowCredentials(true)
      notify({ kind: 'info', message: 'Google app sign-in is not configured yet.' })
      return
    }
    setBusy('login')
    try {
      const { auth_url } = await startGoogleAuth()
      setShowCodeBox(true)
      await window.hermesDesktop?.openExternal?.(auth_url)
      notify({ kind: 'info', message: 'Google sign-in opened. Paste the redirect URL here if Jarvis cannot capture it automatically.' })
      await refreshStatus()
    } catch (err) {
      notifyError(err, 'Google sign-in failed')
    } finally {
      setBusy(null)
    }
  }

  const finishLogin = async () => {
    setBusy('code')
    try {
      const result = await submitGoogleAuthCode(authCode.trim())
      setStatus(result.status)
      setAuthCode('')
      setShowCodeBox(false)
      notify({ kind: 'success', message: 'Google connected' })
    } catch (err) {
      notifyError(err, 'Google auth code failed')
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async () => {
    setBusy('disconnect')
    try {
      const result = await revokeGoogleAuth()
      setStatus(result.status)
      setGmail([])
      setCalendar([])
      setShowCodeBox(false)
      notify({ kind: 'success', message: 'Google disconnected' })
    } catch (err) {
      notifyError(err, 'Google disconnect failed')
    } finally {
      setBusy(null)
    }
  }

  const credentialsVisible = showCredentials || !status?.has_client_secret
  const canSignIn = Boolean(status?.has_client_secret) && busy === null
  const signInLabel = status?.connected ? 'Reconnect Google' : 'Sign in with Google'
  const signInDescription = status?.connected
    ? `Signed in${status.email ? ` as ${status.email}` : ''}. Jarvis can read Gmail and Calendar.`
    : status?.has_client_secret
      ? 'One click opens Google sign-in; the user authorizes their own Google account.'
      : 'Google app sign-in credentials are missing; add them once in advanced setup, then users just sign in.'

  return (
    <SettingsContent>
      <div className="space-y-6 pt-2">
        <header>
          <div className="flex items-center gap-2">
            <SectionHeading icon={AtSign} meta={loading ? 'checking' : undefined} title="Google Sign-In" />
            <GoogleStatusPill status={status} />
          </div>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
            Personal Google connection for Jarvis. Uses the app OAuth setup and enables Gmail + Calendar reads after sign-in.
          </p>
        </header>

        <section className="overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/55 to-card/35 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-background text-[0.95rem] font-bold shadow-sm">G</span>
                {status?.connected ? 'Google account connected' : 'Connect your Google account'}
              </div>
              <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{signInDescription}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button disabled={!canSignIn} onClick={() => void startLogin()} size="sm">
                <ExternalLink className="size-3.5" /> {signInLabel}
              </Button>
              <Button disabled={busy !== null} onClick={() => void refreshStatus()} size="sm" variant="outline">
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
              {status?.connected && (
                <Button disabled={busy !== null} onClick={() => void disconnect()} size="sm" variant="destructive">
                  <Trash2 className="size-3.5" /> Disconnect
                </Button>
              )}
            </div>
          </div>

          {!status?.has_client_secret && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
              Google app sign-in credentials are missing. Add the OAuth app/server credentials once; the user still signs in with their own Google account.
            </div>
          )}

          {status?.missing_scopes?.length ? (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
              Missing read scopes: {compactScopes(status.missing_scopes)}. Use “Reconnect Google” to approve Gmail + Calendar.
            </div>
          ) : null}

          {status?.error && <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{status.error}</div>}

          {(showCodeBox || status?.has_pending_auth) && (
            <div className="mt-4 rounded-lg border border-border/45 bg-background/45 p-3">
              <div className="mb-2 text-xs font-medium text-foreground">Finish Google sign-in</div>
              <Textarea
                className="min-h-20 font-mono text-xs"
                onChange={event => setAuthCode(event.target.value)}
                placeholder="Paste the Google localhost redirect URL or code"
                value={authCode}
              />
              <div className="mt-3 flex justify-end">
                <Button disabled={busy !== null || !authCode.trim()} onClick={() => void finishLogin()} size="sm">
                  Finish sign-in
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border/40 bg-card/35 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading icon={CheckCircle2} title="Connection details" />
            <GoogleStatusPill status={status} />
          </div>
          <div className="mt-2 text-xs leading-5 text-muted-foreground">
            {status?.connected
              ? `Signed in${status.email ? ` as ${status.email}` : ''}.`
              : status?.has_client_secret
                ? 'OAuth app credentials are saved. Use the Sign in with Google button above.'
                : 'OAuth app sign-in credentials are not saved yet.'}
          </div>
          {status?.scopes?.length ? (
            <div className="mt-3 rounded-md bg-muted/30 p-2 text-[0.7rem] text-muted-foreground">
              Scopes: {compactScopes(status.scopes)}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-border/40 bg-card/35 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading icon={AtSign} title="OAuth app sign-in" />
            {status?.has_client_secret && (
              <Button onClick={() => setShowCredentials(value => !value)} size="xs" variant="outline">
                {credentialsVisible ? 'Hide advanced' : 'Show advanced'}
              </Button>
            )}
          </div>
          {credentialsVisible ? (
            <>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Owner setup only. These are the Google OAuth app/server credentials, not a user account. They are saved locally and never shown back here.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Input
                  autoComplete="off"
                  onChange={event => setClientId(event.target.value)}
                  placeholder="Google OAuth app ID"
                  type="text"
                  value={clientId}
                />
                <Input
                  autoComplete="off"
                  onChange={event => setClientSecret(event.target.value)}
                  placeholder="Google OAuth app secret"
                  type="password"
                  value={clientSecret}
                />
              </div>
              <div className="mt-3">
                <Textarea
                  className="min-h-28 font-mono text-xs"
                  onChange={event => setClientJson(event.target.value)}
                  placeholder="Or paste the full downloaded Google OAuth app JSON here"
                  value={clientJson}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button disabled={busy !== null || (!clientJson.trim() && (!clientId.trim() || !clientSecret.trim()))} onClick={() => void saveCredentials()} size="sm">
                  Save app credentials
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">App sign-in is configured. The user only needs the Google sign-in button above.</p>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border/40 bg-card/35 p-4">
            <SectionHeading icon={Mail} title="Gmail preview" />
            <div className="mb-3 flex justify-end">
              <Button disabled={busy !== null || !status?.connected} onClick={() => void loadPreview()} size="xs" variant="outline">
                Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {gmail.length ? gmail.map(message => <MessageRow key={message.id} message={message} />) : <p className="text-xs text-muted-foreground">No messages loaded.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-card/35 p-4">
            <SectionHeading icon={CalendarDays} title="Calendar preview" />
            <div className="mb-3 flex justify-end">
              <Button disabled={busy !== null || !status?.connected} onClick={() => void loadPreview()} size="xs" variant="outline">
                Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {calendar.length ? calendar.map(event => <EventRow event={event} key={event.id} />) : <p className="text-xs text-muted-foreground">No events loaded.</p>}
            </div>
          </div>
        </section>
      </div>
    </SettingsContent>
  )
}
