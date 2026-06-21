import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const PROVIDER_ID = "xiaomi-voicedesign";
const DEFAULT_MODEL = "mimo-v2.5-tts-voicedesign";
const DEFAULT_BASE_URL = "https://api.xiaomimimo.com/v1";
const DEFAULT_STYLE = "Warm, natural, and friendly voice with clear pronunciation and conversational pacing.";
const ENV_KEY = "XIAOMI_API_KEY";

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "Xiaomi MiMo VoiceDesign",
  description: "Voice design TTS via Xiaomi MiMo V2.5 VoiceDesign model",
  register(api) {
    api.registerSpeechProvider({
      id: PROVIDER_ID,
      label: "Xiaomi MiMo VoiceDesign",
      aliases: ["mimo-voicedesign"],
      defaultModel: DEFAULT_MODEL,
      models: [DEFAULT_MODEL],
      autoSelectOrder: 44,

      resolveConfig({ rawConfig }) {
        const style =
          rawConfig?.style ||
          rawConfig?.voiceStyle ||
          rawConfig?.personaStyle ||
          DEFAULT_STYLE;
        const model = rawConfig?.model || DEFAULT_MODEL;
        return { model, style };
      },

      isConfigured({ providerConfig }) {
        const apiKey =
          providerConfig?.apiKey ||
          process.env[ENV_KEY];
        return !!apiKey;
      },

      async synthesize(req) {
        const apiKey =
          req.providerConfig?.apiKey ||
          process.env[ENV_KEY];

        if (!apiKey) {
          throw new Error(
            `Xiaomi VoiceDesign: API key missing. Set ${ENV_KEY} environment variable.`
          );
        }

        const model = req.providerOverrides?.model ||
          req.providerConfig?.model ||
          DEFAULT_MODEL;

        const style = req.providerOverrides?.style ||
          req.providerConfig?.style ||
          req.providerConfig?.personaStyle ||
          DEFAULT_STYLE;

        const baseUrl = (
          req.providerConfig?.baseUrl ||
          DEFAULT_BASE_URL
        ).replace(/\/+$/, "");

        const format = req.providerOverrides?.format ||
          req.providerConfig?.format ||
          "mp3";

        const body = {
          model,
          messages: [
            {
              role: "user",
              content: style,
            },
            {
              role: "assistant",
              content: req.text,
            },
          ],
          audio: { format },
        };

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(req.timeoutMs || 60_000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Xiaomi VoiceDesign API error (${response.status}): ${text}`
          );
        }

        const json = await response.json();
        const audioData =
          json?.choices?.[0]?.message?.audio?.data;

        if (!audioData) {
          throw new Error(
            "Xiaomi VoiceDesign: response missing audio.data"
          );
        }

        const audioBuffer = Buffer.from(audioData, "base64");

        return {
          audioBuffer,
          outputFormat: format,
          fileExtension: `.${format}`,
          voiceCompatible: false,
        };
      },
    });
  },
});
