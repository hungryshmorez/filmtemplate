// SeedancePanel.tsx — Motion-decoupled Seedance shot batch export with
// structured sanity-check view (Character DNA + per-shot motion) above the
// copy-ready raw payload.
import { useEffect, useMemo, useState } from "react";
import { Aperture, Video, TriangleAlert, Scissors } from "lucide-react";
import type { AspectRatio, CharacterEntity, SceneEntity, SetEntity, TransitionType } from "../types";
import { exportSceneToSeedance, renderSeedancePayload, SEEDANCE_CLIP_SECONDS, SEEDANCE_MAX_EXTENSIONS_PER_TAKE, SEEDANCE_MAX_CAST_PER_TAKE } from "../lib/seedanceExport";
import { MAX_DIALOGUE_WORDS_PER_CLIP, TRANSITION_TYPES, TRANSITION_LABELS, DEFAULT_TRANSITION, type TransitionChoiceMap } from "../lib/showrunnerFormat";
import { Chip, CopyButton, Field, Label, Select, TextInput } from "./ui";
import { EmptyHint, RawBlock } from "./ShowrunnerPanel";

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "21:9"];

interface SeedancePanelProps {
  scene: SceneEntity | null;
  set: SetEntity | undefined;
  characters: CharacterEntity[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function SeedancePanel({ scene, set, characters }: SeedancePanelProps) {
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [fps, setFps] = useState(24);
  const [transitionChoices, setTransitionChoices] = useState<TransitionChoiceMap>({});
  useEffect(() => setTransitionChoices({}), [scene?.id]);

  const payload = useMemo(
    () =>
      scene
        ? exportSceneToSeedance(
            scene,
            set,
            characters,
            {
              aspect,
              fps: clamp(Math.round(fps) || 24, 1, 60),
            },
            transitionChoices
          )
        : null,
    [scene, set, characters, aspect, fps, transitionChoices]
  );
  const rendered = useMemo(() => (payload ? renderSeedancePayload(payload) : ""), [payload]);

  if (!scene || !payload) {
    return (
      <EmptyHint>
        Select a scene to build its Seedance shot batch. Each blank-line-separated action paragraph becomes
        one fixed-{SEEDANCE_CLIP_SECONDS}s decoupled-motion shot, grouped into takes of up to{" "}
        {SEEDANCE_MAX_EXTENSIONS_PER_TAKE + 1} (1 regular + {SEEDANCE_MAX_EXTENSIONS_PER_TAKE} extensions).
      </EmptyHint>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Aspect">
          <Select value={aspect} onChange={(e) => setAspect(e.target.value as AspectRatio)} aria-label="Aspect ratio">
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="FPS">
          <TextInput
            type="number"
            min={1}
            max={60}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            onBlur={() => setFps((v) => clamp(Math.round(v) || 24, 1, 60))}
            aria-label="Frames per second"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="inline-flex items-center gap-1.5">
          <Video size={11} aria-hidden /> Shot batch
        </Label>
        <Chip tone="dim">{payload.totalShots} shots</Chip>
        <Chip tone="dim">{payload.totalTakes} take{payload.totalTakes === 1 ? "" : "s"}</Chip>
        <Chip tone="dim">
          {aspect} · {SEEDANCE_CLIP_SECONDS}s/shot (fixed) · {clamp(Math.round(fps) || 24, 1, 60)} fps
        </Chip>
      </div>

      {payload.castWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-[12px] leading-snug text-amber-200">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            This scene has more than {SEEDANCE_MAX_CAST_PER_TAKE} characters. Seedance only supports{" "}
            {SEEDANCE_MAX_CAST_PER_TAKE} per take — excluded:{" "}
            {Array.from(new Set(payload.castWarnings.flatMap((w) => w.excludedNames))).join(", ")}. Split them into a
            separate scene to include them.
          </span>
        </div>
      )}

      {payload.pacingWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-[12px] leading-snug text-amber-200">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Dialogue pacing: a {SEEDANCE_CLIP_SECONDS}s clip fits at most ~{MAX_DIALOGUE_WORDS_PER_CLIP} spoken words
            (~2 words/sec with room for beats and camera action). Over budget:{" "}
            {payload.pacingWarnings
              .map((w) => `take ${w.takeNumber}/shot ${w.segmentIndex + 1} (${w.wordCount}w)`)
              .join(", ")}
            . Trim the lines or move the overflow into the next shot.
          </span>
        </div>
      )}

      {/* Character DNA */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
        <Label className="text-amber-400/90">Character DNA persistence</Label>
        {Object.keys(payload.characterDna).length === 0 ? (
          <p className="mt-1.5 text-[12px] text-neutral-600">
            No active characters. Mark characters as active in the scene editor to embed their DNA.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {Object.entries(payload.characterDna).map(([key, desc]) => (
              <li key={key} className="text-[12px] leading-relaxed">
                <span className="font-mono text-[10.5px] text-amber-300">{key}</span>
                <span className="text-neutral-500"> — {desc}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-shot structured view */}
      {payload.shots.map((shot) => (
        <section key={shot.shotNumber} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="amber">
              <Aperture size={10} aria-hidden /> SHOT {shot.shotNumber}
            </Chip>
            <Chip tone="dim">TAKE {shot.takeNumber}</Chip>
            <Chip tone={shot.generationType === "regular" ? "green" : "dim"}>
              {shot.generationType === "regular" ? "Regular generation" : `Extension ${shot.segmentIndex}/${SEEDANCE_MAX_EXTENSIONS_PER_TAKE}`}
            </Chip>
            <Chip tone="dim">{shot.durationSeconds}s</Chip>
            <Chip tone="dim">{shot.aspect}</Chip>
            <span className="ml-auto font-mono text-[10px] text-neutral-500">{shot.tags}</span>
          </div>
          {shot.characterDnaRefs.length > 0 && (
            <p className="font-mono text-[10px] text-neutral-600">DNA: {shot.characterDnaRefs.join(" · ")}</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-800/80 bg-neutral-950/60 p-2">
              <Label className="text-[9px]">Subject motion</Label>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-300">{shot.subjectMotion}</p>
            </div>
            <div className="rounded-md border border-neutral-800/80 bg-neutral-950/60 p-2">
              <Label className="text-[9px]">Camera motion</Label>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-300">{shot.cameraMotion}</p>
            </div>
          </div>
          {shot.beats.length > 0 && (
            <div>
              <Label className="text-[9px]">Beats</Label>
              <ol className="mt-1 list-inside list-decimal space-y-0.5 text-[12px] leading-relaxed text-neutral-400">
                {shot.beats.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            </div>
          )}
          <div className="rounded-md border border-neutral-800/80 bg-neutral-950/60 p-2">
            <Label className="text-[9px]">Audio</Label>
            <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-neutral-400">
              {shot.audio.speech.map((s, i) => (
                <li key={i}>
                  <span className="font-mono text-amber-300/90">@{s.characterName}</span>: “{s.line}”
                </li>
              ))}
              {shot.audio.voiceProfiles.map((vp, i) => (
                <li key={`vp-${i}`} className="text-neutral-600">
                  voice profile ({vp.characterName}): {vp.voiceDescription}
                </li>
              ))}
              <li className="text-neutral-500">ambient: {shot.audio.ambient}</li>
              <li className="text-neutral-500">sfx: {shot.audio.sfx}</li>
            </ul>
          </div>
        </section>
      ))}

      {payload.takeTransitions.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <Label className="inline-flex items-center gap-1.5">
            <Scissors size={11} aria-hidden /> Take transitions
          </Label>
          <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-500">
            Each take ends with an explicitly written transition into the next take so the stitched clips flow.
          </p>
          <div className="mt-2 space-y-2">
            {payload.takeTransitions.map((t) => (
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
        </section>
      )}

      <RawBlock text={rendered} label="Seedance payload" />

      <CopyButton text={rendered} label="Copy Seedance Payload" size="lg" variant="primary" className="w-full" />
    </div>
  );
}
