// providerSettings.ts — Bring-your-own-key LLM provider config, stored in this
// browser (localStorage). Sent with every AI request so users can run
// Anthropic, OpenAI, Google (Gemini), or any OpenAI-compatible / local server.
import { useSyncExternalStore } from "react";

export type Provider = "google" | "anthropic" | "openai" | "openai_compatible";

export interface ProviderSettings {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google (Gemini)",
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (ChatGPT)",
  openai_compatible: "Local / OpenAI-compatible",
};

// Editable defaults — model ids drift, so these are just starting points.
export const DEFAULT_MODELS: Record<Provider, string> = {
  google: "gemini-3.8-flash",
  anthropic: "claude-3-5-sonnet-latest",
  openai: "gpt-4o-mini",
  openai_compatible: "",
};

const KEY = "showrunner.provider.v1";

const DEFAULTS: ProviderSettings = { provider: "google", apiKey: "", model: "", baseUrl: "" };

function read(): ProviderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ProviderSettings>;
    return {
      provider: parsed.provider ?? DEFAULTS.provider,
      apiKey: parsed.apiKey ?? "",
      model: parsed.model ?? "",
      baseUrl: parsed.baseUrl ?? "",
    };
  } catch {
    return DEFAULTS;
  }
}

const listeners = new Set<() => void>();
let cache: ProviderSettings = read();

export function getProviderSettings(): ProviderSettings {
  return cache;
}

export function setProviderSettings(next: ProviderSettings) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage may be unavailable (private mode) — keep the in-memory value
  }
  listeners.forEach((l) => l());
}

export function useProviderSettings(): ProviderSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
    () => cache
  );
}

/** The wire shape sent to the backend (snake_case). Model falls back to the
 *  provider default; an empty model lets the backend pick its own default. */
export function toProviderConfig(s: ProviderSettings = cache) {
  return {
    provider: s.provider,
    api_key: s.apiKey || null,
    model: s.model || DEFAULT_MODELS[s.provider] || null,
    base_url: s.baseUrl || null,
  };
}

/** True when the current provider still needs the user to enter something. */
export function providerNeedsSetup(s: ProviderSettings = cache): string | null {
  if (s.provider === "google") return null; // env key fallback is allowed
  if (s.provider === "openai_compatible") {
    if (!s.baseUrl.trim()) return "Set a Base URL for your local / OpenAI-compatible server in Settings.";
    return null;
  }
  if (!s.apiKey.trim()) return `Add your ${PROVIDER_LABELS[s.provider]} API key in Settings.`;
  return null;
}
