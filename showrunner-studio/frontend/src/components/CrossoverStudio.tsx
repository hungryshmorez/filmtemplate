// CrossoverStudio.tsx — Bridge two shows from the database into one
// generation-ready crossover episode (title, logline, outline, and scenes of
// reference 15s Scene/Dialogue/Action beats). AI-generated, persisted to Dexie.
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { GitMerge, Sparkles, Trash, TriangleAlert } from "lucide-react";
import type { ReferencePrompt, ShowMeta, StoredCrossover } from "../types";
import { db } from "../lib/db";
import { deleteCrossover, generateCrossover, renderCrossoverDocument, renderCrossoverScene } from "../lib/crossover";
import { MAX_CAST_PER_TAKE, MAX_DIALOGUE_WORDS_PER_CLIP } from "../lib/showrunnerFormat";
import { providerNeedsSetup, useProviderSettings } from "../lib/providerSettings";
import { Button, Chip, CopyButton, Field, Select, Spinner, TextArea, TextInput } from "./ui";
import { useConfirm } from "./ConfirmDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  shows: ShowMeta[];
}

export function CrossoverStudio({ open, onClose, shows }: Props) {
  const confirm = useConfirm();
  const providerSettings = useProviderSettings();
  const [show1Id, setShow1Id] = useState("");
  const [show2Id, setShow2Id] = useState("");
  const [premise, setPremise] = useState("");
  const [tone, setTone] = useState("");
  const [sceneCount, setSceneCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const crossovers = useLiveQuery<StoredCrossover[]>(
    async () => db.crossovers.orderBy("createdAt").reverse().toArray(),
    [],
  ) ?? [];

  // Seed the two show pickers the first time the studio opens.
  useEffect(() => {
    if (open) {
      setError(null);
      setShow1Id((prev) => prev || shows[0]?.id || "");
      setShow2Id((prev) => prev || shows[1]?.id || shows[0]?.id || "");
    }
  }, [open, shows]);

  const selected = useMemo(() => crossovers.find((c) => c.id === selectedId) ?? null, [crossovers, selectedId]);
  const providerHint = providerNeedsSetup(providerSettings);

  if (!open) return null;

  const generate = async () => {
    if (busy) return;
    if (!show1Id || !show2Id || show1Id === show2Id) {
      setError("Pick two different shows to cross over.");
      return;
    }
    if (!premise.trim()) {
      setError("Describe the crossover premise / inciting incident.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rec = await generateCrossover(show1Id, show2Id, premise.trim(), tone.trim(), sceneCount);
      setSelectedId(rec.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crossover generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-neutral-950 sm:h-[min(92vh,900px)] sm:rounded-xl sm:border sm:border-neutral-800">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <GitMerge size={16} className="text-amber-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-neutral-100">Crossover Studio</h2>
            <p className="truncate text-[11px] text-neutral-400">Bridge two shows into one generation-ready episode.</p>
          </div>
          {crossovers.length > 0 && (
            <Select
              aria-label="Saved crossovers"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="ml-auto max-w-52"
            >
              <option value="">Saved crossovers ({crossovers.length})</option>
              {crossovers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          )}
          <Button variant="ghost" size="sm" className={crossovers.length > 0 ? "" : "ml-auto"} onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Controls */}
          <div className="space-y-3 border-b border-neutral-800 p-4">
            {shows.length < 2 ? (
              <p className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[12.5px] text-neutral-400">
                You need at least two shows in your library to build a crossover. Create another show first.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Show 1">
                    <Select value={show1Id} onChange={(e) => setShow1Id(e.target.value)} aria-label="Show 1">
                      {shows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Show 2">
                    <Select value={show2Id} onChange={(e) => setShow2Id(e.target.value)} aria-label="Show 2">
                      {shows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Crossover premise / inciting incident" hint="The catalyst that collides the two worlds.">
                  <TextArea
                    rows={3}
                    value={premise}
                    onChange={(e) => setPremise(e.target.value)}
                    placeholder="e.g. A signal-splice error slides the couch from one show straight onto the set of the other, where the hosts are mistaken for the scheduled guests…"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
                  <Field label="Tone target (optional)">
                    <TextInput
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="e.g. deadpan exhaustion vs. upbeat existential dread"
                    />
                  </Field>
                  <Field label="Scenes">
                    <Select value={sceneCount} onChange={(e) => setSceneCount(Number(e.target.value))} aria-label="Scene count">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} scenes
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {providerHint && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-[12px] leading-snug text-amber-200">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{providerHint}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="md" onClick={generate} disabled={busy}>
                    {busy ? <Spinner size={13} /> : <Sparkles size={13} />}
                    {busy ? "Bridging worlds…" : "Generate crossover"}
                  </Button>
                  {selected && <CopyButton text={renderCrossoverDocument(selected)} label="Copy whole episode" size="md" variant="ghost" />}
                  {selected && (
                    <Button
                      variant="subtle"
                      size="md"
                      onClick={async () => {
                        if (await confirm({ message: `Delete crossover "${selected.title}"?`, confirmLabel: "Delete" })) {
                          if (selectedId === selected.id) setSelectedId(null);
                          void deleteCrossover(selected.id);
                        }
                      }}
                    >
                      <Trash size={13} /> Delete
                    </Button>
                  )}
                </div>
                {error && (
                  <div className="rounded-md border border-red-800/50 bg-red-950/40 p-2.5 text-[12px] leading-snug text-red-300">{error}</div>
                )}
              </>
            )}
          </div>

          {/* Result */}
          {selected ? (
            <div className="space-y-5 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="amber">
                    <GitMerge size={10} aria-hidden /> CROSSOVER
                  </Chip>
                  <h3 className="text-base font-semibold text-neutral-100">{selected.title}</h3>
                  <Chip tone="dim">
                    {selected.show1Title} × {selected.show2Title}
                  </Chip>
                </div>
                {selected.logline && <p className="mt-2 text-[13px] leading-relaxed text-neutral-300">{selected.logline}</p>}
                {selected.outline.length > 0 && (
                  <ol className="mt-2 space-y-1">
                    {selected.outline.map((o, i) => (
                      <li key={i} className="text-[12.5px] leading-relaxed text-neutral-400">
                        {o}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {selected.scenes.map((sc, si) => (
                <section key={si} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-1.5">
                    <Chip tone="amber">SCENE {si + 1}</Chip>
                    <span className="text-[13px] font-semibold text-neutral-100">{sc.name}</span>
                    <Chip tone="dim">{sc.prompts.length} beats</Chip>
                    <CopyButton text={renderCrossoverScene(sc.name, sc.prompts, si)} label="Copy scene" size="xs" variant="ghost" className="ml-auto" />
                  </div>
                  <ul className="space-y-3">
                    {sc.prompts.map((p, pi) => (
                      <li key={pi}>
                        <ReferenceCard index={pi} prompt={p} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-[12.5px] leading-relaxed text-neutral-400">
              {shows.length >= 2 && "Pick two shows, describe the collision, and generate a bridged episode."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferenceCard({ index, prompt }: { index: number; prompt: ReferencePrompt }) {
  const cast = new Set(prompt.dialogue.map((d) => d.character).filter(Boolean)).size;
  const words = prompt.dialogue.reduce((n, d) => n + (d.line || "").split(/\s+/).filter(Boolean).length, 0);
  return (
    <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="amber">PROMPT {index + 1}</Chip>
        <Chip tone="dim">15s</Chip>
        {cast > MAX_CAST_PER_TAKE && (
          <Chip tone="danger" title="More than 3 characters in a beat.">
            <TriangleAlert size={9} aria-hidden /> cast
          </Chip>
        )}
        {words > MAX_DIALOGUE_WORDS_PER_CLIP && (
          <Chip tone="danger" title="Dialogue over the ~25-word / 15s pacing budget.">
            <TriangleAlert size={9} aria-hidden /> pacing
          </Chip>
        )}
      </div>
      <div className="space-y-2 text-[12.5px] leading-relaxed">
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400/90">Scene</span>{" "}
          <span className="text-neutral-300">{prompt.scene}</span>
        </p>
        {prompt.dialogue.length > 0 && (
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400/90">Dialogue</span>
            <ul className="mt-0.5 space-y-0.5">
              {prompt.dialogue.map((d, di) => (
                <li key={di} className="text-neutral-300">
                  <span className="font-medium text-neutral-100">{d.character}</span>
                  {d.delivery ? <span className="italic text-neutral-500"> ({d.delivery})</span> : null}
                  <span>: “{d.line}”</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400/90">Action</span>{" "}
          <span className="text-neutral-300">{prompt.action}</span>
        </p>
      </div>
    </div>
  );
}
