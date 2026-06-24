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

## Examples

Interactive HTML canvas demos are available in [`docs/`](./docs/). Open them directly in a browser — no setup needed.

Start at the gallery page: **[`docs/index.html`](./docs/index.html)**

| Example | File | What it shows |
|---------|------|---------------|
| **VoiceDesign Gallery** | [`MiMo-V2.5-TTS-VoiceDesign.html`](./docs/MiMo-V2.5-TTS-VoiceDesign.html) | All voice personas with inline audio samples — pirate, ASMR, Russian accent, Hunan accent, Gandalf-style, etc. |
| **Multi-voice dialogues** (×8) | [`dialogue-changshajam.html`](./docs/dialogue-changshajam.html) — [CatBar](./docs/dialogue-catbar.html) — [Casting](./docs/dialogue-casting.html) — [Elevator](./docs/dialogue-elevator.html) — [HunanDinner](./docs/dialogue-hunandinner.html) — [IronAnchor](./docs/dialogue-ironanchor.html) — [Vending](./docs/dialogue-vending.html) — [Zoom](./docs/dialogue-zoom.html) | `/vd dialogue` scenes — multiple personas conversing in one audio stream |

> ℹ️ Audio assets live in [`docs/assets/`](./docs/assets/). Each HTML file references these relative to its own directory.

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

## Plugin commands

### `/vd optimize [on|off|status]`

Toggle `optimizeTextPreview` at runtime without editing JSON config.

- `on` — enable text optimization (default behavior)
- `off` — disable (text spoken exactly as written; critical for character voices with intentional accents)
- `status` or no argument — show current state

**Precedence (highest first):**
1. Per-call override (`providerOverrides`)
2. Runtime toggle (`/vd optimize`)
3. Persona config (`personas.<name>.providers.xiaomi-voicedesign.optimizeTextPreview`)
4. Global provider config (`providers.xiaomi-voicedesign.optimizeTextPreview`)
5. Default: `true`

### `/vd dialogue persona:: text || persona:: text [...]`

Generate a multi-voice dialogue from a single command. Each segment specifies a persona name and text, separated by `||`. The persona name and text within a segment are separated by `::`.

**Format:**
```
/vd dialogue persona1:: Hello there || persona2:: Hey, how's it going? || persona1:: Not bad!
```

**How it works:**
1. Reads persona styles from `openclaw.json`
2. Sends each segment to the MiMo API independently, using each persona's voice style
3. Concatenates the MP3 outputs into a single audio file
4. Strips ID3 headers from all segments after the first for seamless playback
5. Saves the result to `/tmp/voicedesign-dialogue-<timestamp>.mp3`

**Requirements:**
- At least 2 segments
- Each persona must be defined in `messages.tts.personas` in `openclaw.json`
- All personas must use the `xiaomi-voicedesign` provider

### `ensureTextPreview` config option

By default `optimize_text_preview` is sent as `true` to the API, which may cause the API to modify or improve the text before speaking (adding/correcting words).

To disable this globally:

```json
"providers": {
  "xiaomi-voicedesign": {
    "style": "...",
    "optimizeTextPreview": false
  }
}
```

Or per-persona:

```json
"personas": {
  "my-voice": {
    "providers": {
      "xiaomi-voicedesign": {
        "style": "...",
        "optimizeTextPreview": false
      }
    }
  }
}
```

Use `/vd optimize` to toggle at runtime without editing JSON.

## Debug logging

The plugin logs to `/tmp/voicedesign-exec-log.txt`:
- Module load and registration
- `resolveConfig` input/output (full rawConfig JSON)
- `synthesize` call details (text, providerConfig, overrides, personaConfig)
- Exact API payload sent
- API response status and audio size

Tail in real time:
```bash
tail -f /tmp/voicedesign-exec-log.txt
```

Logs are **appended** — clear with:
```bash
: > /tmp/voicedesign-exec-log.txt
```

## Known issues

- OpenClaw's `SIGUSR1` graceful restart does **not** reload plugin modules. After changing plugin code, use a full kill+start: `kill <pid> && openclaw gateway start`.
- Temporary audio files may be left in `/private/tmp/openclaw/tts-*/` if the gateway process is killed without cleanup.

## Changelog

### v1.4.0 (2026-06-24) — Interactive examples gallery

**New features:**
- `docs/` directory with interactive HTML demo pages
- VoiceDesign gallery showcasing all personas with inline audio players
- 8 multi-voice dialogue scenes (ChangshaJam, CatBar, Casting, Elevator, HunanDinner, IronAnchor, Vending, Zoom)
- Gallery index page at [`docs/index.html`](./docs/index.html)
- All audio assets stored with relative paths — HTML pages work standalone in any browser

---

### v1.1.0 (2026-06-23) — `/vd dialogue` + command docs

**New features:**
- `/vd dialogue persona:: text || persona:: text [...]` — generate multi-voice dialogues from a single command. Reads persona styles from `openclaw.json`, fetches each segment from MiMo independently, concatenates MP3 outputs.
- Full plugin command documentation in README.

**Fixes:**
- `resolveConfig` now returns all merged fields (not just `model` + `style`), so `optimizeTextPreview`, `format`, `baseUrl`, etc. work per-persona.
- `synthesize()` properly reads `optimizeTextPreview` from persona-level config.

---

### v1.0.1 (2026-06-22) — `resolveConfig` persona-aware merge + field pass-through

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
