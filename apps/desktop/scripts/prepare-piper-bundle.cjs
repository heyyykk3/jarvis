'use strict'

/**
 * Prepare Piper assets for Jarvis desktop installers.
 *
 * The desktop installer should know that Piper is the default local TTS engine
 * and, when the default voice has already been downloaded on the build machine,
 * carry that voice alongside the app.  This script is intentionally safe for
 * CI/offline builds: it never downloads during packaging; it stages cached
 * assets if present and writes a manifest telling first-run setup what to
 * install/cache otherwise.
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const APP_ROOT = path.resolve(__dirname, '..')
const STAGE_ROOT = path.join(APP_ROOT, 'build', 'piper-bundle')
const DEFAULT_VOICE = process.env.JARVIS_PIPER_VOICE || 'en_US-lessac-medium'
const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
const VOICES_DIR = process.env.JARVIS_PIPER_VOICES_DIR || path.join(HERMES_HOME, 'cache', 'piper-voices')

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
  return true
}

function main() {
  rmrf(STAGE_ROOT)
  ensureDir(STAGE_ROOT)

  const stagedVoiceDir = path.join(STAGE_ROOT, 'voices')
  const onnx = path.join(VOICES_DIR, `${DEFAULT_VOICE}.onnx`)
  const json = path.join(VOICES_DIR, `${DEFAULT_VOICE}.onnx.json`)
  const copied = [
    copyIfExists(onnx, path.join(stagedVoiceDir, `${DEFAULT_VOICE}.onnx`)),
    copyIfExists(json, path.join(stagedVoiceDir, `${DEFAULT_VOICE}.onnx.json`))
  ].filter(Boolean).length

  const manifest = {
    provider: 'piper',
    pythonRequirement: 'piper-tts==1.4.2',
    defaultVoice: DEFAULT_VOICE,
    stagedVoiceFiles: copied,
    voicesDirHint: 'cache/piper-voices',
    notes: [
      'Jarvis defaults to Piper for local/free TTS.',
      'If stagedVoiceFiles is 0, first run may download the default voice with python -m piper.download_voices.',
      'Set JARVIS_PIPER_VOICE and JARVIS_PIPER_VOICES_DIR at build time to stage a different pre-downloaded voice.'
    ]
  }

  fs.writeFileSync(path.join(STAGE_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  fs.writeFileSync(path.join(STAGE_ROOT, 'requirements.txt'), `${manifest.pythonRequirement}\n`)
  fs.writeFileSync(
    path.join(STAGE_ROOT, 'README.txt'),
    [
      'Jarvis Piper TTS bundle',
      '========================',
      '',
      `Default provider: ${manifest.provider}`,
      `Default voice: ${manifest.defaultVoice}`,
      `Python requirement: ${manifest.pythonRequirement}`,
      '',
      'This directory is included in desktop installers as a packaging-time manifest.',
      'If the default voice model was cached on the build machine, the .onnx files are copied under voices/.',
      ''
    ].join('\n')
  )

  console.log(`[prepare-piper-bundle] provider=piper voice=${DEFAULT_VOICE} stagedVoiceFiles=${copied}`)
}

main()
