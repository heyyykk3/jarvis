# Jarvis Desktop

Jarvis is a standalone branded desktop build based on Hermes Agent.

## Safety / credentials

This repository is source code only. Do not commit local user credentials or tokens.

Excluded by `.gitignore`:
- `.env`, `.env.*`
- `config.yaml`, `config.yml`
- `google_token.json`
- `google_client_secret.json`
- desktop `build/`, `dist/`, and `release/` outputs
- virtualenvs and `node_modules`

The packaged app may include an OAuth client configuration for Google sign-in if supplied at build time, but it must never include a user's Google token, refresh token, Gmail data, Calendar data, Codex auth, or GitHub auth.

## Windows packaging

From `apps/desktop`:

```powershell
npm install
npm run dist:win:nsis
# or
npm run dist:win:msi
```

For a Windows release with local voice, build and verify on Windows so the STT/TTS Python packages and native audio stack are tested in the final environment.
