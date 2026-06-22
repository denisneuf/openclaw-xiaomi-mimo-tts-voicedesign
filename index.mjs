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

// Runtime toggle state — persists within the process
let _optimizeTextPreview = undefined; // undefined → fallback to persona/provider config, then true

function parseOptimizeArg(arg) {
  const val = (arg || "").trim().toLowerCase();
  if (val === "off" || val === "false" || val === "0") return false;
  if (val === "on" || val === "true" || val === "1") return true;
  return undefined; // unknown → status-only
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "Xiaomi MiMo VoiceDesign",
  description: "Voice design TTS via Xiaomi MiMo V2.5 VoiceDesign model",
  register(api) {
    LOG("register() CALLED - api keys: " + Object.keys(api).join(", "));

    // ── Plugin command: /vd optimize [on|off|status] ──
    api.registerCommand({
      name: "vd",
      description: "Control VoiceDesign plugin settings. Usage: /vd optimize [on|off|status]",
      acceptsArgs: true,
      requireAuth: false,
      handler(ctx) {
        const args = (ctx.args || "").trim();
        const parts = args.split(/\s+/);
        const sub = parts[0]?.toLowerCase();

        if (sub === "optimize") {
          const newVal = parseOptimizeArg(parts[1]);
          if (newVal === undefined) {
            // status display
            const current = _optimizeTextPreview === undefined
              ? "default (true)"
              : String(_optimizeTextPreview);
            return {
              text: `📢 VoiceDesign optimizeTextPreview: \`${current}\`\nToggle with \`/vd optimize on\` or \`/vd optimize off\``,
            };
          }
          _optimizeTextPreview = newVal;
          LOG(`Command: /vd optimize ${newVal}`);
          return {
            text: `✅ VoiceDesign optimizeTextPreview → \`${newVal}\``,
          };
        }

        return {
          text: `⚠️  Unknown subcommand: \`/vd ${sub || ""}\`\nUsage: \`/vd optimize [on|off|status]\``,
        };
      },
    });

    api.registerSpeechProvider({
      id: PROVIDER_ID,
      label: "Xiaomi MiMo VoiceDesign",
      aliases: ["mimo-voicedesign"],
      defaultModel: DEFAULT_MODEL,
      models: [DEFAULT_MODEL],
      autoSelectOrder: 44,

      resolveConfig({ rawConfig }) {
        LOG("resolveConfig called, rawConfig: " + JSON.stringify(rawConfig));

        // 1. Find the active persona config
        const activePersonaName = rawConfig?.persona;
        const personaEntry = activePersonaName
          ? rawConfig?.personas?.[activePersonaName]
          : undefined;
        const personaProviderConfig = personaEntry
          ? personaEntry?.providers?.[PROVIDER_ID]
          : undefined;

        // 2. Global provider config (rawConfig[PROVIDER_ID])
        const globalProviderConfig = rawConfig?.[PROVIDER_ID] || {};

        // 3. Merge: persona takes precedence over global
        const merged = { ...globalProviderConfig, ...personaProviderConfig };

        // 4. Resolve style: merged > rawConfig direct > personaStyle/voiceStyle > default
        const style =
          merged?.style ||
          rawConfig?.style ||
          rawConfig?.voiceStyle ||
          rawConfig?.personaStyle ||
          DEFAULT_STYLE;

        const model = merged?.model || DEFAULT_MODEL;

        // 5. Pass through all fields from merged config (optimizeTextPreview, format, etc.)
        const result = { model, style };
        for (const key of Object.keys(merged)) {
          if (key !== "model" && key !== "style") {
            result[key] = merged[key];
          }
        }

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

        // Precedence: per-call override > persona/provider config > runtime toggle > default true
        const optimizeTextPreview = req.providerOverrides?.optimizeTextPreview ??
          req.providerConfig?.optimizeTextPreview ??
          _optimizeTextPreview ??
          true;

        LOG("Resolved style: " + style);
        LOG("Resolved model: " + model);
        LOG("Resolved format: " + format);
        LOG("Resolved optimizeTextPreview: " + optimizeTextPreview);

        const body = {
          model,
          messages: [
            { role: "user", content: style },
            { role: "assistant", content: req.text },
          ],
          audio: { format, optimize_text_preview: optimizeTextPreview },
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
