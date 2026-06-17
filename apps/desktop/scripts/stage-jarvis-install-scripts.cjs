#!/usr/bin/env node
/*
 * Stage Jarvis-branded first-launch installer scripts that point at the Jarvis
 * repo. These copies are packaged as resources so the desktop app never
 * displays or contacts the Hermes main repo by default.
 */
const fs = require('node:fs')
const path = require('node:path')

const desktopRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const outDir = path.join(desktopRoot, 'build', 'jarvis-install-scripts')

const JARVIS_REPO_SSH = 'git@github.com:heyyykk3/jarvis.git'
const JARVIS_REPO_HTTPS = 'https://github.com/heyyykk3/jarvis.git'
const JARVIS_ARCHIVE_BASE = 'https://github.com/heyyykk3/jarvis/archive'
const JARVIS_RAW_BASE = 'https://raw.githubusercontent.com/heyyykk3/jarvis'

const replacements = [
  [/git@github\.com:NousResearch\/hermes-agent\.git/g, JARVIS_REPO_SSH],
  [/https:\/\/github\.com\/NousResearch\/hermes-agent\.git/g, JARVIS_REPO_HTTPS],
  [/https:\/\/github\.com\/NousResearch\/hermes-agent\/archive/g, JARVIS_ARCHIVE_BASE],
  [/https:\/\/raw\.githubusercontent\.com\/NousResearch\/hermes-agent/g, JARVIS_RAW_BASE],
  [/Hermes Desktop/g, 'Jarvis Desktop'],
  [/Hermes Agent/g, 'Jarvis Agent']
]

fs.mkdirSync(outDir, { recursive: true })
for (const name of ['install.sh', 'install.ps1']) {
  const source = path.join(repoRoot, 'scripts', name)
  const dest = path.join(outDir, name)
  let text = fs.readFileSync(source, 'utf8')
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement)
  }
  fs.writeFileSync(dest, text)
  fs.chmodSync(dest, 0o755)
  console.log(`[stage-jarvis-install-scripts] staged ${name}`)
}
