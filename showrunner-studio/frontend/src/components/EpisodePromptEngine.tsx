// EpisodePromptEngine.tsx — Episode-scoped workspace. The primary output is the
// AI "Broadcast (15s)" reference format: interpret the episode's script into
// self-contained Scene / Dialogue / Action prompts, ONE PER 15 SECONDS, with
// camera + transition + DNA detail folded in. A length selector targets the
// runtime; if the script needs more prompts than the cap, it offers uncapped
// "free" generation. Deterministic Showrunner/Seedance exports remain as
// secondary formats. Runs persist to Dexie (survive reload / episode switch).
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { FileStack, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type {
  AspectRatio,
  CharacterEntity,
  EpisodeEntity,
  EpisodeLength,
  EpisodePromptRun,
  PromptFormat,
  SceneEntity,
  SetEntity,
  ShowMeta,
} from "../types";
import { db } from "../lib/db";
import {
  LENGTH_BANDS,
  deletePromptRun,
  estimatePromptCount,
  generatePromptRun,
  generateReferenceRun,
  regeneratePromptCard,
  regenerateReferenceCard,
  renderRunDocument,
} from "../lib/episodePrompts";
import { buildEpisodeScriptText } from "../lib/templateLearning";
import { providerNeedsSetup, useProviderSettings } from "../lib/providerSettings";
import { Button, Chip, CopyButton, Label, Select, Spinner } from "./ui";
import { useConfirm } from "./ConfirmDialog";

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "21:9"];
const LENGTHS: EpisodeLength[] = ["short", "medium", "large"];

interface Props {
  className?: string;
  show: ShowMeta | null;
  episode: EpisodeEntity | null;
  scenes: SceneEntity[];
  sets: SetEntity[];
  characters: CharacterEntity[];
}

export function EpisodePromptEngine({ className, show, episode, scenes, sets, characters }: Props) {
  const confirm = useConfirm();
  const providerSettings = useProviderSettings();
  const [format, setFormat] = useState<PromptFormat>("reference");
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [length, setLength] = useState<EpisodeLength>("medium");
  const [free, setFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useLiveQuery<EpisodePromptRun | undefined>(
    async () => (episode ? db.episodePromptRuns.where("episodeId").equals(episode.id).first() : undefined),
    [episode?.id]
  );

  useEffect(() => {
    if (run) {
      setFormat(run.format);
      setAspect(run.aspect);
      if (run.length) setLength(run.length);
      if (typeof run.free === "boolean") setFree(run.free);
    }
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!episode) {
    return (
      <Wrap className={className}>
        <Empty
          title="No episode selected"
          body="Pick or create an episode in the tree — the Prompt Engine interprets its script into 15-second generation prompts."
        />
      </Wrap>
    );
  }

  const scriptText = buildEpisodeScriptText(episode, scenes, characters, sets);
  const providerHint = providerNeedsSetup(providerSettings);

  const generate = async () => {
    if (busy) return;
    setError(null);

    if (format === "reference") {
      if (scenes.length === 0 || !scriptText.trim()) {
        setError("This episode has no script yet — add scenes (the script) first, then interpret it into prompts.");
        return;
      }
      const band = LENGTH_BANDS[length];
      const est = estimatePromptCount(scriptText);
      let useFree = free;
      if (!useFree && est > band.max) {
        useFree = await confirm({
          message: `This script looks like it needs about ${est} 15-second prompts — more than the ${band.label} cap of ${band.max}. Generate freely (all ~${est}, no length limit) instead of capping at ${band.max}?`,
          confirmLabel: "Free generation",
          cancelLabel: `Cap at ${band.max}`,
          danger: false,
        });
        setFree(useFree);
      }
      setBusy(true);
      try {
        await generateReferenceRun(episode, scriptText, length, useFree, {
          showTitle: show?.title ?? "",
          genre: show?.genre ?? null,
          premise: show?.premise?.trim() || null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Deterministic per-scene formats (offline, no AI).
    if (scenes.length === 0) return;
    setBusy(true);
    try {
      await generatePromptRun(episode, scenes, sets, characters, format, aspect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const regenerateOne = async (cardId: string) => {
    if (!run || regenId) return;
    setRegenId(cardId);
    setError(null);
    try {
      if (run.format === "reference") {
        await regenerateReferenceCard(run, cardId, scriptText, {
          showTitle: show?.title ?? "",
          genre: show?.genre ?? null,
          premise: show?.premise?.trim() || null,
        });
      } else {
        await regeneratePromptCard(run, cardId, sets, characters);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed.");
    } finally {
      setRegenId(null);
    }
  };

  const isReference = format === "reference";
  const runMatches =
    run &&
    run.format === format &&
    (format !== "seedance" || run.aspect === aspect) &&
    (format !== "reference" || (run.length === length && !!run.free === free));
  const generateLabel = !run
    ? isReference
      ? "Generate 15s prompts"
      : "Generate prompt run"
    : runMatches
      ? "Regenerate"
      : "Rebuild in this format";

  return (
    <Wrap className={className}>
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="amber">
            <FileStack size={10} aria-hidden /> EPISODE PROMPT ENGINE
          </Chip>
          <span className="text-sm font-semibold text-neutral-100">{episode.title}</span>
          {show?.genre && <Chip tone="dim">{show.genre}</Chip>}
        </div>

        <p className="text-[12.5px] leading-relaxed text-neutral-400">
          Interpret this episode&apos;s script into copy-ready generation prompts. The <b>Broadcast (15s)</b> format is
          AI-generated — one self-contained Scene / Dialogue / Action prompt per 15 seconds, with camera, transitions
          and character detail folded in. Runs are saved to this browser and survive reloads.
        </p>

        {/* Controls */}
        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Format</Label>
              <div className="flex flex-wrap gap-1">
                {(["reference", "showrunner", "seedance"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={clsx(
                      "rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      format === f ? "bg-amber-500/15 text-amber-300" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                    )}
                  >
                    {f === "reference" ? "Broadcast (15s)" : f === "showrunner" ? "Showrunner" : "Seedance"}
                  </button>
                ))}
              </div>
            </div>

            {isReference && (
              <div className="space-y-1">
                <Label>Episode length</Label>
                <Select value={length} onChange={(e) => setLength(e.target.value as EpisodeLength)} aria-label="Episode length" className="w-48">
                  {LENGTHS.map((l) => (
                    <option key={l} value={l}>
                      {LENGTH_BANDS[l].label} ({LENGTH_BANDS[l].minutes}, ~{LENGTH_BANDS[l].min}–{LENGTH_BANDS[l].max} prompts)
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {format === "seedance" && (
              <div className="space-y-1">
                <Label>Aspect</Label>
                <Select value={aspect} onChange={(e) => setAspect(e.target.value as AspectRatio)} aria-label="Aspect ratio" className="w-24">
                  {ASPECTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <Button variant="primary" size="md" onClick={generate} disabled={busy || (scenes.length === 0)} className="ml-auto">
              {busy ? <Spinner size={13} /> : <Sparkles size={13} />}
              {generateLabel}
            </Button>
            {run && (
              <>
                <CopyButton text={renderRunDocument(run)} label="Copy whole run" size="md" variant="ghost" />
                <Button variant="subtle" size="md" onClick={() => void deletePromptRun(run.id)} title="Discard this saved prompt run">
                  Clear
                </Button>
              </>
            )}
          </div>

          {isReference && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-neutral-300">
              <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="size-3.5 accent-amber-500" />
              Free generation — no length cap (produce as many 15s prompts as the script needs)
            </label>
          )}

          {isReference && providerHint && (
            <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-[12px] leading-snug text-amber-200">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{providerHint}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-800/50 bg-red-950/40 p-2.5 text-[12px] leading-snug text-red-300">{error}</div>
        )}

        {scenes.length === 0 && (
          <Empty title="This episode has no scenes yet" body="Add scenes in the editor (they're the script) — then interpret them into prompts." />
        )}

        {run && run.cards.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Label>
                {run.format === "reference" ? "15-second prompts" : "Prompt cards"} <span className="text-neutral-500">({run.cards.length})</span>
              </Label>
              <Chip tone="dim">
                {run.format === "reference"
                  ? `Broadcast 15s${run.free ? " · free" : run.length ? ` · ${LENGTH_BANDS[run.length].label}` : ""}`
                  : run.format === "seedance"
                    ? `Seedance · ${run.aspect}`
                    : "Showrunner"}
              </Chip>
              <span className="font-mono text-[10px] text-neutral-500">saved {new Date(run.updatedAt).toLocaleString()}</span>
            </div>

            <ul className="space-y-3">
              {run.cards.map((card) => (
                <li key={card.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="amber">{run.format === "reference" ? `PROMPT ${card.order}` : `SCENE ${card.order}`}</Chip>
                    {run.format !== "reference" && (
                      <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-100">{card.sceneName}</span>
                    )}
                    <Chip tone="dim">15s</Chip>
                    {run.format !== "reference" && (
                      <>
                        <Chip tone="dim">{card.clips} clips</Chip>
                        <Chip tone="dim">{card.takes} take{card.takes === 1 ? "" : "s"}</Chip>
                      </>
                    )}
                    {card.hasCastWarning && (
                      <Chip tone="danger" title="More than 3 characters in a take.">
                        <TriangleAlert size={9} aria-hidden /> cast
                      </Chip>
                    )}
                    {card.hasPacingWarning && (
                      <Chip tone="danger" title="Dialogue over the ~25-word / 15s pacing budget.">
                        <TriangleAlert size={9} aria-hidden /> pacing
                      </Chip>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => regenerateOne(card.id)}
                        disabled={regenId !== null || (run.format !== "reference" && !card.sceneId)}
                        title={run.format === "reference" ? "Re-run just this 15s prompt" : card.sceneId ? "Re-run this card from its scene" : "Source scene was deleted"}
                      >
                        {regenId === card.id ? <Spinner size={11} /> : <RefreshCw size={11} />}
                        Regenerate
                      </Button>
                      <CopyButton text={card.prompt} size="xs" variant="ghost" />
                    </div>
                  </div>

                  {card.reference ? (
                    <div className="space-y-2 text-[12.5px] leading-relaxed">
                      <p>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400/90">Scene</span>{" "}
                        <span className="text-neutral-300">{card.reference.scene}</span>
                      </p>
                      {card.reference.dialogue.length > 0 && (
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400/90">Dialogue</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {card.reference.dialogue.map((d, di) => (
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
                        <span className="text-neutral-300">{card.reference.action}</span>
                      </p>
                    </div>
                  ) : (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-400">
                      {card.prompt}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {!run && scenes.length > 0 && (
          <Empty
            title="No prompt run yet"
            body={
              isReference
                ? `Interpret this episode's script into 15-second Broadcast prompts (${LENGTH_BANDS[length].label} target).`
                : `Compile ${scenes.length} scene${scenes.length === 1 ? "" : "s"} into ${format} prompt cards.`
            }
          />
        )}
      </div>
    </Wrap>
  );
}

function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <main className={clsx("min-h-0 min-w-0 flex-1 overflow-y-auto lg:block", className)}>{children}</main>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-neutral-300">{title}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-400">{body}</p>
      </div>
    </div>
  );
}
