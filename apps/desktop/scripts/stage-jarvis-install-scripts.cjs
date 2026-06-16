#!/usr/bin/env node
/*
 * Stage Jarvis-branded first-launch installer scripts without hardcoded links
 * to the upstream Hermes repository. These copies are packaged as resources so
 * the desktop app never displays or contacts the Hermes main repo by default.
 *
 * If a future Jarvis-hosted repo/update location is created, point the staged
 * scripts at that location here instead of reintroducing upstream Hermes URLs.
 */
const fs = require('node:fs')
const path = require('node:path')

const desktopRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const outDir = path.join(desktopRoot, 'build', 'jarvis-install-scripts')

const replacements = [
  [/git@github\.com:NousResearch\/hermes-agent\.git/g, ''],
  [/https:\/\/github\.com\/NousResearch\/hermes-agent\.git/g, ''],
  [/https:\/\/github\.com\/NousResearch\/hermes-agent\/archive/g, 'jarvis-disabled://archive'],
  [/https:\/\/raw\.githubusercontent\.com\/NousResearch\/hermes-agent/g, 'jarvis-disabled://raw'],
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
