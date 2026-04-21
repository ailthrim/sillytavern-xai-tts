# SillyTavern xAI TTS

Native xAI Text to Speech support for SillyTavern, shipped as a single repo with two parts:

- a UI extension you install from the repo URL
- a server plugin you copy into your SillyTavern `plugins/` folder

This is a deliberate "combo" setup. The browser-side extension handles SillyTavern's TTS UI integration, while the server plugin securely talks to xAI using SillyTavern's existing stored xAI API key.

## Why this repo has two pieces

SillyTavern treats UI extensions and server plugins as separate install targets:

- UI extensions are loaded from a repo folder with a `manifest.json`
- server plugins are loaded from `SillyTavern/plugins/`

So this repo keeps both halves together for convenience, but they still install in two different places inside a real SillyTavern instance.

This split is also useful because xAI TTS is not just another OpenAI-style speech endpoint. xAI exposes its own native TTS API surface, including dedicated voice listing and synthesis endpoints:

- `GET /v1/tts/voices`
- `POST /v1/tts`

That makes the server plugin the clean adapter layer between SillyTavern's TTS provider UI and xAI's actual TTS API contract.

## What this combo does

### UI extension

The UI extension:

- registers `xAI` as a TTS provider inside SillyTavern
- adds provider settings to the TTS UI
- refreshes voices through the local plugin bridge
- previews voices
- sends generation requests through the server plugin instead of exposing your API key in the browser
- supports smart chunking for long messages

### Server plugin

The server plugin:

- reads SillyTavern's existing `api_key_xai` secret
- exposes local plugin routes under `/api/plugins/xai-tts`
- fetches voices from xAI with a built-in fallback list if voice lookup fails
- sends TTS generation requests to xAI's native `/v1/tts` endpoint
- returns audio back to SillyTavern in the requested output format

## Features

- Reuses the existing xAI API key from SillyTavern's API Connections screen
- Native xAI TTS flow instead of an OpenAI-compatible workaround
- Voice refresh with fallback defaults if xAI voice lookup is unavailable
- Voice preview support
- Browser-friendly output codec support for:
  - `mp3` (default)
  - `wav`
- Configurable sample rates
- Configurable MP3 bit rates
- Optional emoji stripping before requests
- Smart chunking for long text while staying under xAI's request limit

## Installation

You install the two halves separately.

### 1. Install the UI extension

In SillyTavern:

1. Open `Extensions`.
2. Choose `Install extension from Git URL`.
3. Paste this repository URL.

SillyTavern will clone this repository into its third-party extensions folder and use the root `manifest.json`, which points to `extension/index.js`.

### 2. Install the server plugin

Install the server plugin separately by placing another copy of this repo in your SillyTavern `plugins/` directory so it ends up like this:

```text
SillyTavern/plugins/xai-tts
```

In practice, that means downloading or cloning the repo again into the `plugins/` folder, or copying an existing local checkout there.

The plugin entry point is provided by the repo root `package.json`:

```json
{
  "main": "server/index.mjs"
}
```

That lets SillyTavern load the plugin directly from the repo root when the repo is placed in `plugins/xai-tts`.

### 3. Enable server plugins

In your SillyTavern `config.yaml`, make sure this is enabled:

```yaml
enableServerPlugins: true
```

Then restart SillyTavern.

## Setup in SillyTavern

1. Save your xAI API key in SillyTavern's normal API Connections area.
2. Open the TTS extension settings.
3. Select `xAI` as the TTS provider.
4. Refresh voices if needed.
5. Choose your preferred voice and output settings.

For browser playback inside SillyTavern, this extension intentionally limits codec selection to `mp3` and `wav`. xAI supports additional codecs, but those are not especially useful for the normal SillyTavern web playback path.

## How requests flow

1. The UI extension registers the `xAI` provider in SillyTavern.
2. SillyTavern calls the local server plugin at `/api/plugins/xai-tts/...`.
3. The server plugin reads the saved `api_key_xai` secret from SillyTavern.
4. The server plugin calls xAI's native TTS API.
5. Audio is returned to SillyTavern for playback.

This keeps the API key on the server side instead of exposing it directly to browser-side extension code.

## Repo layout

```text
manifest.json
package.json
README.md
extension/
  index.js
server/
  index.mjs
```

## Notes

- This repo is intended for personal or community use, not official SillyTavern content submission.
- The extension and plugin live in one repo for convenience, but SillyTavern still expects them to be installed into different locations.
- If the live voice list cannot be fetched from xAI, the extension falls back to a built-in default voice list so the provider can still function.
