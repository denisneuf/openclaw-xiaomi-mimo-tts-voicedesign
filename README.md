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
  "audio": {
    "format": "mp3",
    "optimize_text_preview": true   <-- false to keep text verbatim
  }
}
```

## Configuration resolution (`resolveConfig`)

The `resolveConfig` hook receives the full TTS config block as `rawConfig`. The plugin
**merges** two sources — persona-first, then falls back to the global provider config:

1. **Persona config:** `rawConfig.personas[activePersona].providers.xiaomi-voicedesign`
2. **Global provider config:** `rawConfig["xiaomi-voicedesign"]` (provider-specific key at root)
3. **Legacy fallbacks:** `rawConfig.style`, `rawConfig.voiceStyle`, `rawConfig.personaStyle`
4. **Built-in default:** `DEFAULT_STYLE`

**Persona values override global values** (spread merge).

### Field pass-through

`resolveConfig` returns **all fields** from the merged config, not just `model` + `style`.
This means you can set any extra field (e.g. `optimizeTextPreview`, `format`, `baseUrl`)
in either the persona or the global provider config and it will be passed to the `synthesize()`
call as `req.providerConfig`.

### Precedence in `synthesize()`

Once merged, the plugin resolves each parameter with this order (highest first):
1. `req.providerOverrides?.<field>` — per-call override (set by the framework)
2. `req.providerConfig?.<field>` — the merged result from `resolveConfig`
3. `_<field>RuntimeToggle` — in-process toggle (e.g. `/vd optimize off`)
4. Built-in default

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

- OpenClaw's `SIGUSR1` graceful restart does **not** reload plugin modules. After changing plugin code, use a full kill+start: `kill <pid> && openclaw gateway start`.
- Temporary audio files may be left in `/private/tmp/openclaw/tts-*/` if the gateway process is killed without cleanup.

## Changelog

### 2026-06-22 — `resolveConfig` persona-aware merge + field pass-through

**Bug fix:** `resolveConfig` was reading only the global provider config (`rawConfig["xiaomi-voicedesign"]`),
ignoring the active persona's provider-specific config. This meant all personas using
`xiaomi-voicedesign` would get the same style (the one from the global provider config).

**Fix:**
- `resolveConfig` now looks up the active persona via `rawConfig.persona`,
  reads `rawConfig.personas[activePersona].providers.xiaomi-voicedesign`,
  and merges it with the global provider config (persona values win).
- All merged fields are passed through in the return value, not just `model` + `style`.
  This allows `optimizeTextPreview`, `format`, `baseUrl` (etc.) to be set per-persona
  or globally and actually take effect in `synthesize()`.

**Config change (recommended):** Add `"optimizeTextPreview": false` to the global
provider config `messages.tts.providers.xiaomi-voicedesign` to disable text
optimization by default.

## License

MIT
