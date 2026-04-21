# SillyTavern xAI TTS

Standalone xAI Text to Speech add-on for SillyTavern.

This repo contains two pieces:

- `extension/`: the client-side TTS provider that registers `xAI` in SillyTavern's TTS extension UI
- `server/`: the server plugin that reads SillyTavern's existing `api_key_xai` secret and proxies requests to xAI's native TTS API

## What it does

- Reuses the existing xAI API key from SillyTavern's API Connections screen
- Fetches voice data from `POST /v1/tts/voices` with a built-in fallback list
- Generates speech through `POST /v1/tts`
- Supports `mp3`, `wav`, `pcm`, `mulaw`, and `alaw`
- Supports smart chunking for longer text

## Install the extension

In SillyTavern:

1. Open Extensions.
2. Choose Install extension from Git URL.
3. Paste this repo URL.

SillyTavern will use the root `manifest.json`, which loads `extension/index.js`.

## Install the server plugin

Copy this repo into your SillyTavern `plugins/` directory so it ends up at:

```text
SillyTavern/plugins/xai-tts
```

Then enable server plugins in your SillyTavern config:

```yaml
enableServerPlugins: true
```

Because the repo root contains `package.json` with `"main": "server/index.mjs"`, SillyTavern can load it as a server plugin directly from that folder.

## Local layout

```text
manifest.json
package.json
extension/index.js
server/index.mjs
README.md
```
