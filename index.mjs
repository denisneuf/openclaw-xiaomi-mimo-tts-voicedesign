import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { appendFileSync } from "node:fs";

const LOG = (msg) => {
  try {
    appendFileSync("/tmp/voicedesign-exec-log.txt", `[${new Date().toISOString()}] ${msg}\n`, "utf8");
  } catch(e) {
    // ignore
  }
};

LOG("MODULE LOADED - top level execution");

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
    LOG("register() CALLED - api keys: " + Object.keys(api).join(", "));

    api.registerSpeechProvider({
      id: PROVIDER_ID,
      label: "Xiaomi MiMo VoiceDesign",
      aliases: ["mimo-voicedesign"],
      defaultModel: DEFAULT_MODEL,
      models: [DEFAULT_MODEL],
      autoSelectOrder: 44,

      resolveConfig({ rawConfig }) {
        LOG("resolveConfig called, rawConfig: " + JSON.stringify(rawConfig));
        const style =
          rawConfig?.style ||
          rawConfig?.[PROVIDER_ID]?.style ||
          rawConfig?.providers?.[PROVIDER_ID]?.style ||
          rawConfig?.voiceStyle ||
          rawConfig?.personaStyle ||
          DEFAULT_STYLE;
        const model = rawConfig?.model || rawConfig?.[PROVIDER_ID]?.model || DEFAULT_MODEL;
        const result = { model, style };
        LOG("resolveConfig returns: " + JSON.stringify(result));
        return result;
      },

      isConfigured({ providerConfig }) {
        LOG("isConfigured called, providerConfig keys: " + (providerConfig ? Object.keys(providerConfig).join(",") : "undefined"));
        const apiKey =
          providerConfig?.apiKey ||
          process.env[ENV_KEY];
        const result = !!apiKey;
        LOG("isConfigured returns: " + result);
        return result;
      },

      async synthesize(req) {
        LOG("synthesize() CALLED. req keys: " + Object.keys(req).join(","));
        LOG("req.text: " + (req.text || "").substring(0, 100));
        LOG("req.providerConfig: " + JSON.stringify(req.providerConfig));
        LOG("req.providerOverrides: " + JSON.stringify(req.providerOverrides));
        LOG("req.personaConfig: " + JSON.stringify(req.personaConfig));

        const apiKey =
          req.providerConfig?.apiKey ||
          process.env[ENV_KEY];

        if (!apiKey) {
          LOG("ERROR: No API key");
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
          req.personaConfig?.style ||
          DEFAULT_STYLE;

        const baseUrl = (
          req.providerConfig?.baseUrl ||
          DEFAULT_BASE_URL
        ).replace(/\/+$/, "");

        const format = req.providerOverrides?.format ||
          req.providerConfig?.format ||
          "mp3";

        LOG("Resolved style: " + style);
        LOG("Resolved model: " + model);
        LOG("Resolved format: " + format);

        const body = {
          model,
          messages: [
            { role: "user", content: style },
            { role: "assistant", content: req.text },
          ],
          audio: { format, optimize_text_preview: true },
        };

        LOG("PAYLOAD: " + JSON.stringify(body));

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

        LOG("Synthesize success, audio size: " + audioBuffer.length + " bytes");

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
