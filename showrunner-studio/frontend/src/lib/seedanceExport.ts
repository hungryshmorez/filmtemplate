// seedanceExport.ts — Parses scene data into Seedance's motion-decoupled export format.
import type {
  SceneEntity,
  SetEntity,
  CharacterEntity,
  AspectRatio,
  SeedanceShotBlock,
  SeedanceExportPayload,
  SeedanceCastWarning,
  ShowrunnerPacingWarning,
} from "../types";
import {
  buildTakeTransitions,
  renderTransitionBlock,
  MAX_DIALOGUE_WORDS_PER_CLIP,
  type TransitionChoiceMap,
} from "./showrunnerFormat";

// --- Keyword heuristics -----------------------------------------------

const CAMERA_KEYWORDS = [
  "shot", "camera", "zoom", "pan", "tilt", "dolly", "crane", "push-in", "push in",
  "pull back", "pull-back", "track", "tracking", "close-up", "closeup", "wide",
  "angle", "frame", "framing", "lens", "static", "handheld", "whip pan", "steadicam",
  "aerial", "drone", "pov", "establishing", "rack focus", "focal", "orbit", "roll",
  "axis", "crash zoom", "slow motion", "slo-mo",
];

const SFX_KEYWORDS = [
  "creak", "buzz", "hum", "rattle", "squelch", "groan", "click", "thud", "crackle",
  "static", "whir", "screech", "hiss", "squeak", "rustle", "clatter", "thump",
  "bang", "clang", "drip", "sizzle", "growl", "rumble",
];

const isCameraSentence = (s: string) => {
  const lower = s.toLowerCase();
  return CAMERA_KEYWORDS.some((kw) => lower.includes(kw));
};

const isSfxSentence = (s: string) => {
  const lower = s.toLowerCase();
  return SFX_KEYWORDS.some((kw) => lower.includes(kw));
};

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

// --- Character DNA -------------------------------------------------------

export const characterDnaKey = (name: string) =>
  `DNA_${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;

export const buildCharacterDna = (characters: CharacterEntity[]): Record<string, string> => {
  const dna: Record<string, string> = {};
  for (const c of characters) {
    dna[characterDnaKey(c.name)] = c.visualDescription || "(no visual description set)";
  }
  return dna;
};

// --- Motion decoupling ----------------------------------------------------

export interface DecoupledMotion {
  subjectMotion: string;
  cameraMotion: string;
  beats: string[];
  sfxLines: string[];
}

/**
 * Splits a raw action paragraph into isolated Subject Motion / Camera Motion
 * clauses using keyword heuristics, plus an ordered beat list and detected SFX.
 * Supports an explicit `[CAM: ...]` inline marker to force camera classification
 * for a clause regardless of keywords.
 */
export function decoupleMotion(paragraph: string): DecoupledMotion {
  // Extract explicit [CAM: ...] markers first.
  const explicitCamMatches: string[] = [];
  const stripped = paragraph.replace(/\[CAM:\s*([^\]]+)\]/gi, (_m, inner) => {
    explicitCamMatches.push(inner.trim());
    return "";
  });

  const sentences = splitSentences(stripped);
  const subjectParts: string[] = [];
  const cameraParts: string[] = [...explicitCamMatches];
  const sfxLines: string[] = [];

  for (const sentence of sentences) {
    if (isCameraSentence(sentence)) {
      cameraParts.push(sentence);
    } else {
      subjectParts.push(sentence);
    }
    if (isSfxSentence(sentence)) {
      sfxLines.push(sentence);
    }
  }

  return {
    subjectMotion: subjectParts.join(" ") || "(no subject motion described)",
    cameraMotion: cameraParts.join(" ") || "Static shot, locked frame.",
    beats: sentences,
    sfxLines,
  };
}

// --- Full scene → Seedance shot batch export -----------------------------

export const SEEDANCE_CLIP_SECONDS = 15;
export const SEEDANCE_MAX_EXTENSIONS_PER_TAKE = 3;
export const SEEDANCE_MAX_SEGMENTS_PER_TAKE = SEEDANCE_MAX_EXTENSIONS_PER_TAKE + 1;
export const SEEDANCE_MAX_CAST_PER_TAKE = 3;

/** Splits an ordered list into `n` roughly-even, order-preserving buckets. */
function distributeEvenly<T>(items: T[], n: number): T[][] {
  if (n <= 0) return [];
  const buckets: T[][] = Array.from({ length: n }, () => []);
  if (items.length === 0) return buckets;
  items.forEach((item, i) => {
    const bucketIndex = Math.min(n - 1, Math.floor((i / items.length) * n));
    buckets[bucketIndex].push(item);
  });
  return buckets;
}

export interface SeedanceExportOptions {
  aspect: AspectRatio;
  fps: number;
}

export function exportSceneToSeedance(
  scene: SceneEntity,
  set: SetEntity | undefined,
  allCharacters: CharacterEntity[],
  options: SeedanceExportOptions,
  transitionChoices: TransitionChoiceMap = {}
): SeedanceExportPayload {
  const allActiveCharacters = allCharacters.filter((c) => scene.activeCharacterIds.includes(c.id));
  const paragraphs = splitParagraphs(scene.action).length
    ? splitParagraphs(scene.action)
    : [scene.action || ""];

  // Seedance only supports up to 3 characters per generation — lock the
  // take's cast to the first 3 and flag anyone excluded.
  const lockedCast = allActiveCharacters.slice(0, SEEDANCE_MAX_CAST_PER_TAKE);
  const excludedCast = allActiveCharacters.slice(SEEDANCE_MAX_CAST_PER_TAKE);
  const castNames = lockedCast.map((c) => c.name);
  const dnaRefs = lockedCast.map((c) => characterDnaKey(c.name));

  const tagLine = [...castNames.map((n) => `@${n}`), set ? `#${set.name}` : ""].filter(Boolean).join(" ");

  // Distribute the scene's ordered dialogue across paragraphs/segments
  // proportionally so each shot carries only its own slice — no duplication
  // across shots that happen to mention the same character.
  const dialogueBuckets = distributeEvenly(scene.dialogue, paragraphs.length);

  const shots: SeedanceShotBlock[] = paragraphs.map((paragraph, idx) => {
    const { subjectMotion, cameraMotion, beats, sfxLines } = decoupleMotion(paragraph);
    const takeNumber = Math.floor(idx / SEEDANCE_MAX_SEGMENTS_PER_TAKE) + 1;
    const segmentIndex = idx % SEEDANCE_MAX_SEGMENTS_PER_TAKE;
    const generationType: "regular" | "extension" = segmentIndex === 0 ? "regular" : "extension";

    const speechLines = dialogueBuckets[idx] ?? [];
    const speech = speechLines.map((d) => {
      const char = allCharacters.find((c) => c.id === d.characterId);
      return { characterName: char?.name ?? "UNKNOWN", line: d.text };
    });

    const voiceProfiles = lockedCast
      .filter((c) => speech.some((s) => s.characterName === c.name))
      .map((c) => ({
        characterName: c.name,
        voiceDescription:
          [c.age, c.gender].filter(Boolean).join(" ") + (c.voiceDescription ? `, ${c.voiceDescription}` : ""),
      }));

    return {
      shotNumber: idx + 1,
      takeNumber,
      segmentIndex,
      generationType,
      durationSeconds: SEEDANCE_CLIP_SECONDS,
      aspect: options.aspect,
      tags: tagLine,
      characterDnaRefs: dnaRefs,
      castNames,
      setName: set?.name ?? null,
      subjectMotion,
      cameraMotion,
      beats,
      audio: {
        speech,
        ambient: set?.description || "(no set ambience described)",
        sfx: sfxLines.join(" ") || "(none detected)",
        voiceProfiles,
      },
    };
  });

  const takeNumbers = new Set(shots.map((s) => s.takeNumber));
  const castWarnings: SeedanceCastWarning[] = excludedCast.length
    ? Array.from(takeNumbers).map((takeNumber) => ({
        takeNumber,
        excludedNames: excludedCast.map((c) => c.name),
      }))
    : [];

  const takeTransitions = buildTakeTransitions(
    Array.from(takeNumbers),
    transitionChoices,
    castNames,
    set?.name ?? null
  );

  const pacingWarnings: ShowrunnerPacingWarning[] = [];
  shots.forEach((shot) => {
    const wc = shot.audio.speech.reduce(
      (n, s) => n + s.line.split(/\s+/).filter(Boolean).length,
      0
    );
    if (wc > MAX_DIALOGUE_WORDS_PER_CLIP) {
      pacingWarnings.push({
        takeNumber: shot.takeNumber,
        segmentIndex: shot.segmentIndex,
        wordCount: wc,
        maxWords: MAX_DIALOGUE_WORDS_PER_CLIP,
      });
    }
  });

  return {
    sceneId: scene.id,
    sceneName: scene.sceneName,
    aspect: options.aspect,
    fps: options.fps,
    totalShots: shots.length,
    totalTakes: takeNumbers.size,
    characterDna: buildCharacterDna(lockedCast),
    shots,
    castWarnings,
    pacingWarnings,
    takeTransitions,
  };
}

// --- Render payload to the copy-ready text block --------------------------

export function renderSeedancePayload(payload: SeedanceExportPayload): string {
  const lines: string[] = [];
  lines.push("=".repeat(50));
  lines.push(`SEEDANCE SHOT BATCH EXPORT: ${payload.sceneName.toUpperCase().replace(/\s+/g, "_")}`);
  lines.push(
    `ASPECT: ${payload.aspect} | TOTAL SHOTS: ${payload.totalShots} (${payload.totalTakes} take${payload.totalTakes === 1 ? "" : "s"}) | FPS: ${payload.fps}`
  );
  lines.push(
    `Every clip is a fixed ${SEEDANCE_CLIP_SECONDS}s generation. A take = 1 regular generation + up to ${SEEDANCE_MAX_EXTENSIONS_PER_TAKE} extensions, cast LOCKED across the whole take (max ${SEEDANCE_MAX_CAST_PER_TAKE} characters, 1 set). Every take boundary ends with an explicitly written TRANSITION block that must be generated between the takes.`
  );
  lines.push("=".repeat(50));
  lines.push("");

  if (payload.castWarnings.length) {
    for (const w of payload.castWarnings) {
      lines.push(
        `⚠ TAKE ${w.takeNumber}: scene exceeds ${SEEDANCE_MAX_CAST_PER_TAKE} characters — excluded: ${w.excludedNames.join(", ")}. Split into another scene to include them.`
      );
    }
    lines.push("");
  }

  if (payload.pacingWarnings.length) {
    lines.push(`⚠ DIALOGUE PACING: a ${SEEDANCE_CLIP_SECONDS}s clip fits at most ~${MAX_DIALOGUE_WORDS_PER_CLIP} spoken words (~2 words/sec with room for beats and camera action). Trim or move the overflow into the next clip:`);
    for (const w of payload.pacingWarnings) {
      lines.push(`  ⚠ Shot take ${w.takeNumber} / segment ${w.segmentIndex}: ${w.wordCount} words — over budget by ${w.wordCount - w.maxWords}.`);
    }
    lines.push("");
  }

  lines.push("--- CHARACTER DNA PERSISTENCE ---");
  for (const [key, desc] of Object.entries(payload.characterDna)) {
    lines.push(`${key}: ${desc}`);
  }
  lines.push("-".repeat(35));

  let currentTake = -1;
  for (const shot of payload.shots) {
    if (shot.takeNumber !== currentTake) {
      if (currentTake !== -1) {
        const transition = payload.takeTransitions.find((t) => t.afterTake === currentTake);
        if (transition) {
          lines.push("");
          lines.push(renderTransitionBlock(transition));
        }
      }
      currentTake = shot.takeNumber;
      lines.push("");
      lines.push(`### TAKE ${shot.takeNumber} — cast locked: ${shot.castNames.join(", ") || "none"} | set: ${shot.setName ?? "none"} ###`);
    }
    const genLabel =
      shot.generationType === "regular"
        ? "REGULAR GENERATION"
        : `EXTENDED GENERATION (${shot.segmentIndex}/${SEEDANCE_MAX_EXTENSIONS_PER_TAKE} — cast locked, do not change)`;
    lines.push("");
    lines.push(`[SHOT ${shot.shotNumber} | ${genLabel} | DURATION: ${shot.durationSeconds}s | ASPECT: ${shot.aspect}]`);
    lines.push(`TAGS: ${shot.tags}`);
    lines.push(`CHARACTER_DNA: ${shot.characterDnaRefs.join(", ")}`);
    lines.push("");
    lines.push(`SUBJECT MOTION: ${shot.subjectMotion}`);
    lines.push(`CAMERA MOTION: ${shot.cameraMotion}`);
    lines.push("BEATS:");
    shot.beats.forEach((b, i) => lines.push(`  ${i + 1}. ${b}`));
    lines.push("AUDIO:");
    lines.push(
      `  - Speech: ${
        shot.audio.speech.length
          ? shot.audio.speech.map((s) => `@${s.characterName}: "${s.line}"`).join(" / ")
          : "None"
      }`
    );
    if (shot.audio.voiceProfiles.length) {
      shot.audio.voiceProfiles.forEach((vp) =>
        lines.push(`  - Voice Profile (${vp.characterName}): ${vp.voiceDescription}`)
      );
    }
    lines.push(`  - Ambient: ${shot.audio.ambient}`);
    lines.push(`  - SFX: ${shot.audio.sfx}`);
  }
  lines.push("");
  lines.push("=".repeat(50));
  return lines.join("\n");
}
