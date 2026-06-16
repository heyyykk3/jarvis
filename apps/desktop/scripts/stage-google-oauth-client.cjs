#!/usr/bin/env node
/*
 * Stages Google OAuth APP credentials for the packaged Jarvis build.
 *
 * This intentionally stages only the OAuth client configuration used to open
 * Google's consent screen. It never stages google_token.json, refresh tokens,
 * Gmail data, Calendar data, or any signed-in user account.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const desktopRoot = path.resolve(__dirname, '..')
const buildDir = path.join(desktopRoot, 'build')
const outFile = path.join(buildDir, 'google-oauth-client-secret.json')

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function validate(payload) {
  if (!payload || typeof payload !== 'object' || payload.disabled === true) {
    return null
  }
  const section = payload.installed || payload.web
  if (!section || typeof section !== 'object') {
    return null
  }
  if (!section.client_id || !section.client_secret) {
    return null
  }
  return payload
}

function firstAvailablePayload() {
  const envJson = process.env.JARVIS_GOOGLE_OAUTH_CLIENT_JSON || process.env.HERMES_GOOGLE_OAUTH_CLIENT_JSON
  if (envJson) {
    const payload = validate(JSON.parse(envJson))
    if (!payload) throw new Error('JARVIS_GOOGLE_OAUTH_CLIENT_JSON is not a valid Google OAuth client JSON')
    return { payload, source: 'env-json' }
  }

  const fileCandidates = [
    process.env.JARVIS_GOOGLE_CLIENT_SECRET_FILE,
    process.env.HERMES_GOOGLE_CLIENT_SECRET_FILE,
    path.join(os.homedir(), '.hermes', 'google_client_secret.json')
  ].filter(Boolean)

  for (const file of fileCandidates) {
    if (!fs.existsSync(file)) continue
    const payload = validate(readJsonFile(file))
    if (!payload) throw new Error(`Google OAuth client file is invalid: ${file}`)
    return { payload, source: file === fileCandidates[fileCandidates.length - 1] ? 'profile' : 'file' }
  }

  return { payload: { disabled: true }, source: 'none' }
}

fs.mkdirSync(buildDir, { recursive: true })
const { payload, source } = firstAvailablePayload()
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 })
try {
  fs.chmodSync(outFile, 0o600)
} catch (_) {}

if (payload.disabled) {
  console.log('[stage-google-oauth-client] no app OAuth credentials staged')
} else {
  console.log(`[stage-google-oauth-client] staged app OAuth credentials from ${source} (values redacted)`)
}
