# openclaw-xiaomi-mimo-tts-voicedesign

Voice Design TTS plugin for [OpenClaw](https://openclaw.ai) using the Xiaomi MiMo V2.5 VoiceDesign model.

Creates custom voices from text descriptions — no preset voices required.

## Prerequisites

- A [Xiaomi MiMo API](https://mimo.mi.com) key
- Set `XIAOMI_API_KEY` in `~/.openclaw/.env`

## Installation

```bash
# Clone
gh repo clone denisneuf/openclaw-xiaomi-mimo-tts-voicedesign \
  ~/.openclaw/plugins/xiaomi-voicedesign

# Install as link
openclaw plugins install --link ~/.openclaw/plugins/xiaomi-voicedesign

# Restart gateway
openclaw gateway restart
```

## Usage

Add a persona in `openclaw.json`:

```json
"personas": {
  "my-voice": {
    "label": "My Custom Voice",
    "providers": {
      "xiaomi-voicedesign": {
        "style": "Describe the voice here: deep, gravelly, slow..."
      }
    }
  }
}
```

Then activate with `/tts persona my-voice`.

## How it works

The plugin sends two messages to the MiMo API:
- `role: user` → the voice style description
- `role: assistant` → the text to speak

### API call

```
POST https://api.xiaomimimo.com/v1/chat/completions
Content-Type: application/json
api-key: <XIAOMI_API_KEY>

{
  "model": "mimo-v2.5-tts-voicedesign",
  "messages": [
    { "role": "user", "content": "<style description>" },
    { "role": "assistant", "content": "<text to speak>" }
  ],
  "audio": { "format": "mp3", "optimize_text_preview": true }
}
```

## Configuration precedence

The plugin resolves the voice style in this order:
1. `req.providerOverrides?.style` – per-call override (highest priority)
2. `req.providerConfig?.style` – resolved config from the persona/provider definition
3. `req.personaConfig?.style` – fallback if passed separately by the framework
4. `DEFAULT_STYLE` – built-in fallback

### `resolveConfig` note

The `resolveConfig` hook receives the full TTS config block from OpenClaw as `rawConfig`. Provider-specific settings are nested under `rawConfig["xiaomi-voicedesign"]` (or `rawConfig.providers["xiaomi-voicedesign"]`), **not** at `rawConfig.style`.

Precedence used by `resolveConfig`:
1. `rawConfig?.style` – top-level (usually unset)
2. `rawConfig?.[PROVIDER_ID]?.style` – provider-specific key at root
3. `rawConfig?.providers?.[PROVIDER_ID]?.style` – nested under providers
4. `rawConfig?.voiceStyle` / `rawConfig?.personaStyle` – legacy keys
5. `DEFAULT_STYLE` – fallback

## Debug logging

The plugin logs all activity to `/tmp/voicedesign-exec-log.txt`:
- Module load and registration
- `resolveConfig` input/output (including the full rawConfig JSON)
- `synthesize` call details (text, providerConfig, overrides, personaConfig)
- The exact API payload sent
- API response status and audio size

To watch in real time:
```bash
tail -f /tmp/voicedesign-exec-log.txt
```

Then activate with `/tts persona my-voice`.

### `optimizeTextPreview` option

By default `optimize_text_preview` is sent as `true` to the API, which may cause the API to modify or improve the text before speaking (adding/correcting words).

To disable this (send the text exactly as written):

```json
"personas": {
  "my-voice": {
    "label": "My Custom Voice",
    "providers": {
      "xiaomi-voicedesign": {
        "style": "Describe the voice...",
        "optimizeTextPreview": false
      }
    }
  }
}
```

Or set it globally in the provider config:

```json
"providers": {
  "xiaomi-voicedesign": {
    "style": "...",
    "optimizeTextPreview": false
  }
}
```

Default: `true` (backward compatible).

Logs are **appended** — clear with:
```bash
: > /tmp/voicedesign-exec-log.txt
```

## Known issues

- The first `resolveConfig()` call after gateway start may use cached module code even after `SIGUSR1` reload. Use a full process restart (`kill -9`) if debugging config resolution.
- Temporary audio files may be left in `/private/tmp/openclaw/tts-*/` if the gateway process is killed without cleanup.

## License

MIT
