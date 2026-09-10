// SettingsModal.tsx — Bring-your-own-key provider configuration. Everything is
// stored in this browser only and sent with each AI request.
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import {
  DEFAULT_MODELS,
  PROVIDER_LABELS,
  getProviderSettings,
  setProviderSettings,
  type Provider,
  type ProviderSettings,
} from "../lib/providerSettings";
import { Button, Field, Modal, Select, TextInput } from "./ui";

const PROVIDERS: Provider[] = ["google", "anthropic", "openai", "openai_compatible"];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<ProviderSettings>(getProviderSettings());

  useEffect(() => {
    if (open) setDraft(getProviderSettings());
  }, [open]);

  const isLocal = draft.provider === "openai_compatible";
  const isGoogle = draft.provider === "google";

  const save = () => {
    setProviderSettings(draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI provider"
      subtitle="Bring your own key. Stored only in this browser and sent with each generation request."
      wide
    >
      <div className="space-y-4 p-4">
        <Field label="Provider">
          <Select
            value={draft.provider}
            onChange={(e) => {
              const provider = e.target.value as Provider;
              setDraft((d) => ({ ...d, provider, model: d.model || "" }));
            }}
            aria-label="AI provider"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>

        {isLocal && (
          <Field label="Base URL" hint="e.g. http://localhost:11434/v1 (Ollama), or any OpenAI-compatible endpoint.">
            <TextInput
              value={draft.baseUrl}
              onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              placeholder="http://localhost:11434/v1"
              aria-label="Base URL"
            />
          </Field>
        )}

        <Field
          label="API key"
          hint={
            isGoogle
              ? "Optional — if blank, the server's configured Gemini key is used."
              : isLocal
                ? "Often not required for local servers."
                : "Required. Your key is stored locally and never leaves your browser except to reach the provider."
          }
        >
          <div className="relative">
            <KeyRound size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden />
            <TextInput
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
              placeholder={isGoogle ? "(uses server key if blank)" : "sk-…"}
              aria-label="API key"
              className="pl-7"
              autoComplete="off"
            />
          </div>
        </Field>

        <Field label="Model" hint={`Default: ${DEFAULT_MODELS[draft.provider] || "(set by your server)"}. Model ids change over time — edit as needed.`}>
          <TextInput
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            placeholder={DEFAULT_MODELS[draft.provider] || "model id"}
            aria-label="Model"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
