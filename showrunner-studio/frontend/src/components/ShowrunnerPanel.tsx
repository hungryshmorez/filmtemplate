// ShowrunnerPanel.tsx — Live Showrunner clip-block preview for the selected scene.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MonitorPlay, Scissors, TriangleAlert } from "lucide-react";
import type { CharacterEntity, SceneEntity, SetEntity, TransitionType } from "../types";
import {
  formatSceneForShowrunner,
  renderShowrunnerBlocks,
  MAX_EXTENSIONS_PER_TAKE,
  MAX_CAST_PER_TAKE,
  MAX_DIALOGUE_WORDS_PER_CLIP,
  TRANSITION_TYPES,
  TRANSITION_LABELS,
  DEFAULT_TRANSITION,
  type TransitionChoiceMap,
} from "../lib/showrunnerFormat";
import { Chip, CopyButton, Label, Select } from "./ui";

interface ShowrunnerPanelProps {
  scene: SceneEntity | null;
  set: SetEntity | undefined;
  characters: CharacterEntity[];
}

export function ShowrunnerPanel({ scene, set, characters }: ShowrunnerPanelProps) {
  const [transitionChoices, setTransitionChoices] = useState<TransitionChoiceMap>({});
  useEffect(() => setTransitionChoices({}), [scene?.id]);

  const result = useMemo(
    () => (scene ? formatSceneForShowrunner(scene, set, characters, transitionChoices) : null),
    [scene, set, characters, transitionChoices]
  );
  const rendered = useMemo(() => (result ? renderShowrunnerBlocks(result) : ""), [result]);

  if (!scene || !result) {
    return (
      <EmptyHint>
        Select a scene on the left to see its Showrunner clip blocks. Blank-line-separated action paragraphs
        each become one 15s clip, grouped into takes of up to {MAX_EXTENSIONS_PER_TAKE + 1} (1 regular + {MAX_EXTENSIONS_PER_TAKE} extensions).
      </EmptyHint>
    );
  }

  const totalSeconds = result.clips.length * 15;
  const totalTakes = new Set(result.clips.map((c) => c.takeNumber)).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="inline-flex items-center gap-1.5">
          <MonitorPlay size={11} aria-hidden /> Showrunner preview
        </Label>
        <Chip tone="dim">{result.clips.length} clips</Chip>
        <Chip tone="dim">{totalTakes} take{totalTakes === 1 ? "" : "s"}</Chip>
        <Chip tone="dim">{totalSeconds}s total</Chip>
        <CopyButton text={rendered} label="Copy Showrunner Blocks" className="ml-auto" />
      </div>

      {result.castWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-[12px] leading-snug text-amber-200">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            This scene has more than {MAX_CAST_PER_TAKE} characters. Seedance only supports {MAX_CAST_PER_TAKE} per
            take — excluded from generation: {Array.from(new Set(result.castWarnings.flatMap((w) => w.excludedNames))).join(", ")}.
            Split them into a separate scene to include them.
          </span>
        </div>
      )}

      {result.pacingWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-[12px] leading-snug text-amber-200">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Dialogue pacing: a 15s clip fits at most ~{MAX_DIALOGUE_WORDS_PER_CLIP} spoken words (~2 words/sec with room
            for beats and camera action). Over budget:{" "}
            {result.pacingWarnings
              .map((w) => `take ${w.takeNumber}/clip ${w.segmentIndex + 1} (${w.wordCount}w)`)
              .join(", ")}
            . Trim the lines or move the overflow into the next clip.
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {result.clips.map((clip, i) => (
          <li key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Chip tone="amber">TAKE {clip.takeNumber}</Chip>
              <Chip tone={clip.generationType === "regular" ? "green" : "dim"}>
                {clip.generationType === "regular" ? "Regular generation" : `Extension ${clip.segmentIndex}/${MAX_EXTENSIONS_PER_TAKE}`}
              </Chip>
              <Chip tone="dim">{clip.durationSeconds}s</Chip>
              <span className="ml-auto font-mono text-[10px] text-amber-300/90">{clip.tagLine}</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-neutral-300">
              <span className="font-semibold text-neutral-100">{clip.shotFraming}</span> {clip.description}
            </p>
            {clip.dialogue.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-neutral-800/70 pt-2">
                {clip.dialogue.map((d, di) => (
                  <li key={di} className="text-[12px] leading-relaxed text-neutral-400">
                    <span className="font-mono text-amber-300/80">@{d.characterName}</span>
                    {d.parenthetical ? <span className="italic text-neutral-500"> ({d.parenthetical})</span> : null}
                    <span>: “{d.text}”</span>
                  </li>
                ))}
              </ul>
            )}
            {clip.generationType === "extension" && (
              <p className="mt-2 text-[11px] italic text-neutral-500">
                Extension — cast locked to {clip.castNames.join(", ") || "none"}. Do not introduce new characters.
              </p>
            )}
          </li>
        ))}
      </ul>

      {result.takeTransitions.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <Label className="inline-flex items-center gap-1.5">
            <Scissors size={11} aria-hidden /> Take transitions
          </Label>
          <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-500">
            Every take boundary gets an explicit transition written into the prompts so the generated clips flow
            together. Pick how each take cuts into the next.
          </p>
          <div className="mt-2 space-y-2">
            {result.takeTransitions.map((t) => (
              <div key={t.afterTake} className="flex items-center gap-2">
                <span className="w-28 shrink-0 font-mono text-[11px] text-neutral-400">
                  Take {t.afterTake} → {t.toTake}
                </span>
                <Select
                  value={transitionChoices[t.afterTake] ?? DEFAULT_TRANSITION}
                  onChange={(e) =>
                    setTransitionChoices((prev) => ({ ...prev, [t.afterTake]: e.target.value as TransitionType }))
                  }
                  className="w-48"
                >
                  {TRANSITION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TRANSITION_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.dialogueBlocks.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <Label>Full dialogue (scene order)</Label>
          <ul className="mt-1.5 space-y-1">
            {result.dialogueBlocks.map((d, i) => (
              <li key={i} className="text-[12.5px] leading-relaxed text-neutral-300">
                <span className="font-mono text-amber-300">@{d.characterName}</span>
                {d.parenthetical ? <span className="italic text-neutral-500"> ({d.parenthetical})</span> : null}
                <span>: “{d.text}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RawBlock text={rendered} />
    </div>
  );
}

// --- Shared bits used by the export panels ----------------------------------

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-[12.5px] leading-relaxed text-neutral-500">
      {children}
    </div>
  );
}

export function RawBlock({ text, label = "Copy-ready text" }: { text: string; label?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label>{label}</Label>
        <CopyButton text={text} size="xs" variant="ghost" />
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-[11px] leading-relaxed text-neutral-400">
        {text}
      </pre>
    </div>
  );
}
