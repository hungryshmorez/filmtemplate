// EpisodePromptEngine.tsx — Episode-scoped workspace: compile the selected
// episode into per-scene, copy-ready generation prompt cards, persisted to
// Dexie (survive reload / episode switch). Regenerate the whole batch or a
// single card. Reuses the Showrunner/Seedance engines, so all generation
// constraints (15s cap, ~25-word pacing, 3-char/take) are preserved.
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { FileStack, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type {
  AspectRatio,
  CharacterEntity,
  EpisodeEntity,
  EpisodePromptRun,
  PromptFormat,
  SceneEntity,
  SetEntity,
  ShowMeta,
} from "../types";
import { db } from "../lib/db";
import {
  deletePromptRun,
  generatePromptRun,
  regeneratePromptCard,
  renderRunDocument,
} from "../lib/episodePrompts";
import { Button, Chip, CopyButton, Label, Select, Spinner } from "./ui";

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "21:9"];

interface Props {
  className?: string;
  show: ShowMeta | null;
  episode: EpisodeEntity | null;
  scenes: SceneEntity[];
  sets: SetEntity[];
  characters: CharacterEntity[];
}

export function EpisodePromptEngine({ className, show, episode, scenes, sets, characters }: Props) {
  const [format, setFormat] = useState<PromptFormat>("showrunner");
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [busy, setBusy] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);

  const run = useLiveQuery<EpisodePromptRun | undefined>(
    async () => (episode ? db.episodePromptRuns.where("episodeId").equals(episode.id).first() : undefined),
    [episode?.id]
  );

  // Sync the format/aspect controls to a loaded run so "Regenerate" is honest
  // about what's currently on screen.
  useEffect(() => {
    if (run) {
      setFormat(run.format);
      setAspect(run.aspect);
    }
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!episode) {
    return (
      <Wrap className={className}>
        <Empty
          title="No episode selected"
          body="Pick or create an episode in the tree — the Prompt Engine compiles all of its scenes into copy-ready generation prompts."
        />
      </Wrap>
    );
  }

  const generate = async () => {
    if (scenes.length === 0 || busy) return;
    setBusy(true);
    try {
      await generatePromptRun(episode, scenes, sets, characters, format, aspect);
    } finally {
      setBusy(false);
    }
  };

  const regenerateOne = async (cardId: string) => {
    if (!run || regenId) return;
    setRegenId(cardId);
    try {
      await regeneratePromptCard(run, cardId, sets, characters);
    } finally {
      setRegenId(null);
    }
  };

  const runMatchesControls = run && run.format === format && (format !== "seedance" || run.aspect === aspect);
  const generateLabel = !run ? "Generate prompt run" : runMatchesControls ? "Regenerate batch" : "Rebuild in this format";

  return (
    <Wrap className={className}>
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        {/* Header + generation triggers (in the active view, no full-page jump) */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="amber">
            <FileStack size={10} aria-hidden /> EPISODE PROMPT ENGINE
          </Chip>
          <span className="text-sm font-semibold text-neutral-100">{episode.title}</span>
          {show?.genre && <Chip tone="dim">{show.genre}</Chip>}
        </div>

        <p className="text-[12.5px] leading-relaxed text-neutral-400">
          Compile every scene in this episode into per-scene, copy-ready generation prompts. Runs are saved to this
          browser, so they survive reloads and switching episodes. Regenerate the whole batch, or re-run a single
          card after editing its scene.
        </p>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="space-y-1">
            <Label>Format</Label>
            <div className="flex gap-1">
              {(["showrunner", "seedance"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={clsx(
                    "rounded-md px-2.5 py-1.5 text-[12px] font-medium capitalize transition-colors",
                    format === f ? "bg-amber-500/15 text-amber-300" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
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
          <Button variant="primary" size="md" onClick={generate} disabled={busy || scenes.length === 0} className="ml-auto">
            {busy ? <Spinner size={13} /> : <Sparkles size={13} />}
            {generateLabel}
          </Button>
          {run && (
            <>
              <CopyButton text={renderRunDocument(run)} label="Copy whole run" size="md" variant="ghost" />
              <Button
                variant="subtle"
                size="md"
                onClick={() => void deletePromptRun(run.id)}
                title="Discard this saved prompt run"
              >
                Clear
              </Button>
            </>
          )}
        </div>

        {scenes.length === 0 && (
          <Empty title="This episode has no scenes yet" body="Add scenes in the editor, then compile them into a prompt run." />
        )}

        {run && run.cards.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Label>
                Prompt cards <span className="text-neutral-500">({run.cards.length})</span>
              </Label>
              <Chip tone="dim">{run.format === "seedance" ? `Seedance · ${run.aspect}` : "Showrunner"}</Chip>
              <span className="font-mono text-[10px] text-neutral-500">saved {new Date(run.updatedAt).toLocaleString()}</span>
            </div>
            <ul className="space-y-3">
              {run.cards.map((card) => (
                <li key={card.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="amber">SCENE {card.order}</Chip>
                    <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-100">{card.sceneName}</span>
                    <Chip tone="dim">{card.clips} clips</Chip>
                    <Chip tone="dim">{card.takes} take{card.takes === 1 ? "" : "s"}</Chip>
                    {card.hasCastWarning && (
                      <Chip tone="danger" title="More than 3 characters in a take — see the editor.">
                        <TriangleAlert size={9} aria-hidden /> cast
                      </Chip>
                    )}
                    {card.hasPacingWarning && (
                      <Chip tone="danger" title="Dialogue over the ~25-word / 15s pacing budget.">
                        <TriangleAlert size={9} aria-hidden /> pacing
                      </Chip>
                    )}
                    {!card.sceneId && <Chip tone="dim" title="Source scene was deleted">orphaned</Chip>}
                    <div className="ml-auto flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => regenerateOne(card.id)}
                        disabled={!card.sceneId || regenId !== null}
                        title={card.sceneId ? "Re-run just this card from its scene" : "Source scene was deleted"}
                      >
                        {regenId === card.id ? <Spinner size={11} /> : <RefreshCw size={11} />}
                        Regenerate
                      </Button>
                      <CopyButton text={card.prompt} size="xs" variant="ghost" />
                    </div>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-400">
                    {card.prompt}
                  </pre>
                </li>
              ))}
            </ul>
          </>
        )}

        {!run && scenes.length > 0 && (
          <Empty
            title="No prompt run yet"
            body={`Generate a run to compile ${scenes.length} scene${scenes.length === 1 ? "" : "s"} into copy-ready prompt cards.`}
          />
        )}
      </div>
    </Wrap>
  );
}

function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className={clsx("min-h-0 min-w-0 flex-1 overflow-y-auto lg:block", className)}>{children}</main>
  );
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
