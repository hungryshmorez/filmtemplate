// showrunnerFormat.ts — Formats scene action/dialogue into Showrunner-ready clip blocks.
//
// Showrunner/Seedance generation rules this engine enforces:
//   - Every clip is a fixed 15 seconds — that's the hard cap per generation.
//   - A "take" is a chain of up to 4 clips: 1 regular generation + up to 3
//     extensions (each extending the previous clip), for a max of 60s
//     (1 minute) of continuous footage per take.
//   - The cast is LOCKED for the whole take — an extension can never
//     introduce or remove a character from the shot.
//   - A take can have at most 3 characters and exactly 1 set.
import type { SceneEntity, SetEntity, CharacterEntity, ShowrunnerClip, ShowrunnerCastWarning, ShowrunnerFormatResult, ShowrunnerPacingWarning, TransitionType, TakeTransition } from "../types";

export const CLIP_SECONDS = 15;
export const MAX_EXTENSIONS_PER_TAKE = 3; // + 1 regular generation = 4 segments
export const MAX_SEGMENTS_PER_TAKE = MAX_EXTENSIONS_PER_TAKE + 1;
export const MAX_TAKE_SECONDS = CLIP_SECONDS * MAX_SEGMENTS_PER_TAKE; // 60s
export const MAX_CAST_PER_TAKE = 3;
// Natural spoken pace in a 15s clip: ~2 words/sec with room for beats and
// camera action. Anything more reads as rushed/garbled on screen.
export const MAX_DIALOGUE_WORDS_PER_CLIP = 25;

// --- Take-to-take transitions --------------------------------------------
// Every take boundary (wherever a take actually ends — clip 4, or earlier if
// cut short) needs its cut into the next take written explicitly into the
// prompt so the sequence flows correctly when stitched together.

export type { TransitionType } from "../types";

export const TRANSITION_TYPES: TransitionType[] = [
  "hard_cut",
  "cut_to_black",
  "dissolve",
  "whip_pan",
  "match_cut",
  "push_through",
];

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  hard_cut: "Hard Cut",
  cut_to_black: "Cut to Black",
  dissolve: "Dissolve",
  whip_pan: "Whip Pan",
  match_cut: "Match Cut",
  push_through: "Push-Through Object",
};

export const DEFAULT_TRANSITION: TransitionType = "hard_cut";

/** Per-boundary user choices, keyed by the take the transition comes AFTER. */
export type TransitionChoiceMap = Partial<Record<number, TransitionType>>;

export function transitionPrompt(
  type: TransitionType,
  nextCastNames: string[],
  nextSetName: string | null
): string {
  const cast = nextCastNames.length ? nextCastNames.join(", ") : "the next take's cast";
  const set = nextSetName ?? "the next take's set";
  switch (type) {
    case "hard_cut":
      return "Hard cut, no dissolve — cut directly on action into the next take's opening frame.";
    case "cut_to_black":
      return "Cut to black for a beat (about half a second), then cut in on the next take's opening frame.";
    case "dissolve":
      return "Cross-dissolve from the last frame of this take into the next take's opening frame.";
    case "whip_pan":
      return `Whip the camera hard to one side, frame smearing into motion blur, and continue that same blur speed into the next take so the two shots read as one movement — landing on ${cast} in ${set}.`;
    case "match_cut":
      return `Match cut on a shared shape, motion or position into the next take — ${cast} now in ${set}, same framing carried across the cut.`;
    case "push_through":
      return `Push forward through a foreground object filling the frame (a hand, a doorway, a flame), and continue that same push out the other side into ${cast} in ${set}.`;
    default:
      return "Hard cut into the next take.";
  }
}

/** Builds an explicit transition entry for every consecutive take boundary. */
export function buildTakeTransitions(
  takeNumbers: number[],
  choices: TransitionChoiceMap,
  nextCastNames: string[],
  nextSetName: string | null
): TakeTransition[] {
  const sorted = Array.from(new Set(takeNumbers)).sort((a, b) => a - b);
  const out: TakeTransition[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const afterTake = sorted[i];
    const toTake = sorted[i + 1];
    out.push({
      afterTake,
      toTake,
      type: choices[afterTake] ?? DEFAULT_TRANSITION,
      nextCastNames,
      nextSetName,
    });
  }
  return out;
}

export function renderTransitionBlock(transition: TakeTransition): string {
  return `>>> TRANSITION (Take ${transition.afterTake} → Take ${transition.toTake}) — ${TRANSITION_LABELS[transition.type]}: ${transitionPrompt(transition.type, transition.nextCastNames, transition.nextSetName)}`;
}

const FRAMING_RULES: { keywords: string[]; label: string }[] = [
  { keywords: ["extreme close", "ecu"], label: "Extreme close-up:" },
  { keywords: ["close-up", "closeup", "close up"], label: "Close-up:" },
  { keywords: ["push-in", "push in", "zoom in"], label: "Push-in:" },
  { keywords: ["pull back", "pull-back", "zoom out"], label: "Pull-back:" },
  { keywords: ["wide", "establishing"], label: "Wide shot:" },
  { keywords: ["low angle"], label: "Low-angle shot:" },
  { keywords: ["high angle"], label: "High-angle shot:" },
  { keywords: ["tracking", "track"], label: "Tracking shot:" },
  { keywords: ["pov"], label: "POV shot:" },
];

const DEFAULT_FRAMING = "Medium shot:";

function pickFraming(text: string): string {
  const lower = text.toLowerCase();
  for (const rule of FRAMING_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.label;
  }
  return DEFAULT_FRAMING;
}

// ~4 characters per token, rough GPT/Gemini-style estimate — kept for the
// export panel's token-budget hint, though duration is now always fixed.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

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

export function formatSceneForShowrunner(
  scene: SceneEntity,
  set: SetEntity | undefined,
  allCharacters: CharacterEntity[],
  transitionChoices: TransitionChoiceMap = {}
): ShowrunnerFormatResult {
  const allActiveCharacters = allCharacters.filter((c) => scene.activeCharacterIds.includes(c.id));
  const paragraphs = splitParagraphs(scene.action).length
    ? splitParagraphs(scene.action)
    : [scene.action || ""];

  // Enforce the 3-cast-per-take limit up front: lock the take's cast to the
  // first 3 active characters and flag anyone excluded so the writer can
  // split the scene manually if needed.
  const lockedCast = allActiveCharacters.slice(0, MAX_CAST_PER_TAKE);
  const excludedCast = allActiveCharacters.slice(MAX_CAST_PER_TAKE);
  const castNames = lockedCast.map((c) => c.name);

  // Distribute the scene's ordered dialogue list across paragraphs (segments)
  // proportionally, so every clip carries its own slice of dialogue instead
  // of dumping everything into one block.
  const dialogueBuckets = distributeEvenly(scene.dialogue, paragraphs.length);

  const dnaCharLookup = new Map(allCharacters.map((c) => [c.id, c] as const));

  const clips: ShowrunnerClip[] = paragraphs.map((paragraph, i) => {
    const takeNumber = Math.floor(i / MAX_SEGMENTS_PER_TAKE) + 1;
    const segmentIndex = i % MAX_SEGMENTS_PER_TAKE;
    const generationType: "regular" | "extension" = segmentIndex === 0 ? "regular" : "extension";

    const tagLine = [...castNames.map((n) => `@${n}`), set ? `#${set.name}` : ""].filter(Boolean).join(" ");

    const dialogue = (dialogueBuckets[i] ?? []).map((d) => {
      const char = dnaCharLookup.get(d.characterId);
      return { characterName: char?.name ?? "UNKNOWN", text: d.text, parenthetical: d.parenthetical };
    });

    return {
      takeNumber,
      segmentIndex,
      generationType,
      tagLine,
      shotFraming: pickFraming(paragraph),
      description: paragraph,
      dialogue,
      durationSeconds: CLIP_SECONDS,
      castNames,
      setName: set?.name ?? null,
      surroundings: set?.description || "(no set/atmosphere description on file)",
    };
  });

  // One cast-warning entry per take that had to drop characters.
  const takeNumbers = new Set(clips.map((c) => c.takeNumber));
  const castWarnings: ShowrunnerCastWarning[] = excludedCast.length
    ? Array.from(takeNumbers).map((takeNumber) => ({
        takeNumber,
        excludedNames: excludedCast.map((c) => c.name),
      }))
    : [];

  // Dialogue pacing: flag any clip whose slice of dialogue can't naturally be
  // spoken within its 15 seconds (~2 words/sec with room for beats/action).
  const wordCount = (lines: { text: string }[]) =>
    lines.reduce((n, d) => n + d.text.split(/\s+/).filter(Boolean).length, 0);
  const pacingWarnings: ShowrunnerPacingWarning[] = [];
  clips.forEach((clip) => {
    const wc = wordCount(clip.dialogue);
    if (wc > MAX_DIALOGUE_WORDS_PER_CLIP) {
      pacingWarnings.push({
        takeNumber: clip.takeNumber,
        segmentIndex: clip.segmentIndex,
        wordCount: wc,
        maxWords: MAX_DIALOGUE_WORDS_PER_CLIP,
      });
    }
  });

  // Every take boundary gets an explicitly written transition into the next
  // take (hard cut by default, user-selectable per boundary).
  const takeTransitions = buildTakeTransitions(
    Array.from(takeNumbers),
    transitionChoices,
    castNames,
    set?.name ?? null
  );

  const dialogueBlocks = scene.dialogue.map((d) => {
    const char = dnaCharLookup.get(d.characterId);
    return { characterName: char?.name ?? "UNKNOWN", text: d.text, parenthetical: d.parenthetical };
  });

  return { sceneId: scene.id, sceneName: scene.sceneName, clips, dialogueBlocks, castWarnings, pacingWarnings, takeTransitions };
}

export function renderShowrunnerBlocks(result: ShowrunnerFormatResult): string {
  const lines: string[] = [];
  lines.push(`SCENE: ${result.sceneName}`);
  lines.push(`Every clip is a fixed ${CLIP_SECONDS}s generation. A take = 1 regular + up to ${MAX_EXTENSIONS_PER_TAKE} extensions (max ${MAX_TAKE_SECONDS}s). Cast is locked for the whole take — extensions cannot add or remove characters. Every take boundary ends with an explicitly written TRANSITION block that must be generated between the takes.`);
  lines.push("");

  if (result.castWarnings.length) {
    for (const w of result.castWarnings) {
      lines.push(
        `⚠ TAKE ${w.takeNumber}: scene has more than ${MAX_CAST_PER_TAKE} characters. Excluded from this take (split into another scene/take to include them): ${w.excludedNames.join(", ")}`
      );
    }
    lines.push("");
  }

  if (result.pacingWarnings.length) {
    lines.push(`⚠ DIALOGUE PACING: a 15s clip fits at most ~${MAX_DIALOGUE_WORDS_PER_CLIP} spoken words (~2 words/sec with room for beats and camera action). Trim or move the overflow into the next clip:`);
    for (const w of result.pacingWarnings) {
      lines.push(`  ⚠ Clip take ${w.takeNumber} / segment ${w.segmentIndex}: ${w.wordCount} words — over budget by ${w.wordCount - w.maxWords}.`);
    }
    lines.push("");
  }

  let currentTake = -1;
  result.clips.forEach((clip) => {
    if (clip.takeNumber !== currentTake) {
      if (currentTake !== -1) {
        const transition = result.takeTransitions.find((t) => t.afterTake === currentTake);
        if (transition) {
          lines.push(renderTransitionBlock(transition));
          lines.push("");
        }
      }
      currentTake = clip.takeNumber;
      lines.push(`=== TAKE ${clip.takeNumber} (cast locked: ${clip.castNames.join(", ") || "none"} | set: ${clip.setName ?? "none"}) ===`);
    }
    const genLabel =
      clip.generationType === "regular"
        ? "REGULAR GENERATION (clip 1 of take)"
        : `EXTENDED GENERATION (extension ${clip.segmentIndex} of ${MAX_EXTENSIONS_PER_TAKE} — do not change cast)`;
    lines.push(`--- ${genLabel} — ${clip.durationSeconds}s ---`);
    lines.push(clip.tagLine);
    lines.push(`SURROUNDINGS/ATMOSPHERE (this generation, in ${clip.setName ?? "unset set"}): ${clip.surroundings}`);
    lines.push(`${clip.shotFraming} ${clip.description}`);
    if (clip.dialogue.length) {
      lines.push(`Dialogue in this clip (max ~${MAX_DIALOGUE_WORDS_PER_CLIP} words for ${clip.durationSeconds}s):`);
      clip.dialogue.forEach((d) => {
        lines.push(`  @${d.characterName}${d.parenthetical ? ` (${d.parenthetical})` : ""}: "${d.text}"`);
      });
    }
    lines.push("");
  });

  if (result.dialogueBlocks.length) {
    lines.push("--- Full Dialogue (scene order, for reference) ---");
    result.dialogueBlocks.forEach((d) => {
      lines.push(`@${d.characterName}${d.parenthetical ? ` (${d.parenthetical})` : ""}: "${d.text}"`);
    });
  }
  return lines.join("\n");
}
