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

## License

MIT
