/**
 * Jarvis branded builds intentionally do not substitute or contact the upstream
 * Hermes source repository for passive update checks.
 */

const OFFICIAL_REPO_HTTPS_URL = ''
const OFFICIAL_REPO_CANONICAL = ''

function canonicalGitHubRemote(url) {
  if (!url) return ''
  let value = String(url).trim()
  if (value.startsWith('git@github.com:')) {
    value = `github.com/${value.slice('git@github.com:'.length)}`
  } else if (value.startsWith('ssh://git@github.com/')) {
    value = `github.com/${value.slice('ssh://git@github.com/'.length)}`
  } else {
    try {
      const parsed = new URL(value)
      if (parsed.hostname && parsed.pathname) value = `${parsed.hostname}${parsed.pathname}`
    } catch {
      // Leave non-URL forms unchanged.
    }
  }
  value = value.trim().replace(/\/+$/, '')
  if (value.endsWith('.git')) value = value.slice(0, -4)
  return value.toLowerCase()
}

function isSshRemote(url) {
  const value = String(url || '').trim().toLowerCase()
  return value.startsWith('git@') || value.startsWith('ssh://')
}

function isOfficialSshRemote(_url) {
  return false
}

module.exports = {
  OFFICIAL_REPO_HTTPS_URL,
  OFFICIAL_REPO_CANONICAL,
  canonicalGitHubRemote,
  isSshRemote,
  isOfficialSshRemote
}
