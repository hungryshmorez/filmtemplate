// episodePrompts.ts — Episode Prompt Engine: compile an episode into per-scene,
// copy-ready generation prompts and persist them as a "run" in Dexie so they
// survive reloads and episode switches (Section 3). Cards reuse the existing
// Showrunner / Seedance engines, so the 15s cap, ~25-word dialogue pacing and
// 3-character-per-take limits are enforced exactly as in the export panels.
import { db, uid } from "./db";
import type {
  AspectRatio,
  CharacterEntity,
  EpisodeEntity,
  EpisodeLength,
  EpisodePromptCard,
  EpisodePromptRun,
  PromptFormat,
  ReferencePrompt,
  SceneEntity,
  SetEntity,
} from "../types";
import { formatSceneForShowrunner, renderShowrunnerBlocks, MAX_CAST_PER_TAKE, MAX_DIALOGUE_WORDS_PER_CLIP } from "./showrunnerFormat";
import { exportSceneToSeedance, renderSeedancePayload } from "./seedanceExport";
import { toProviderConfig } from "./providerSettings";

const SEEDANCE_FPS = 24;

/** Compile one scene into a persisted prompt card in the requested format. */
export function buildPromptCard(
  scene: SceneEntity,
  sets: SetEntity[],
  characters: CharacterEntity[],
  format: PromptFormat,
  aspect: AspectRatio
): EpisodePromptCard {
  const set = sets.find((s) => s.id === scene.targetSetId);
  const base = {
    id: uid("card"),
    sceneId: scene.id,
    sceneName: scene.sceneName || `Scene ${scene.order}`,
    order: scene.order,
    generatedAt: Date.now(),
  };

  if (format === "seedance") {
    const payload = exportSceneToSeedance(scene, set, characters, { aspect, fps: SEEDANCE_FPS }, {});
    return {
      ...base,
      prompt: renderSeedancePayload(payload),
      clips: payload.totalShots,
      takes: payload.totalTakes,
      hasCastWarning: payload.castWarnings.length > 0,
      hasPacingWarning: payload.pacingWarnings.length > 0,
    };
  }

  const result = formatSceneForShowrunner(scene, set, characters, {});
  return {
    ...base,
    prompt: renderShowrunnerBlocks(result),
    clips: result.clips.length,
    takes: new Set(result.clips.map((c) => c.takeNumber)).size,
    hasCastWarning: result.castWarnings.length > 0,
    hasPacingWarning: result.pacingWarnings.length > 0,
  };
}

/** Build (and persist) a full run for an episode — one card per scene, in order. */
export async function generatePromptRun(
  episode: EpisodeEntity,
  scenes: SceneEntity[],
  sets: SetEntity[],
  characters: CharacterEntity[],
  format: PromptFormat,
  aspect: AspectRatio
): Promise<EpisodePromptRun> {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const cards = ordered.map((sc) => buildPromptCard(sc, sets, characters, format, aspect));

  // Reuse the existing run id for this episode so a regenerated batch replaces
  // the prior one in place instead of stacking duplicates.
  const existing = await db.episodePromptRuns.where("episodeId").equals(episode.id).first();
  const now = Date.now();
  const run: EpisodePromptRun = {
    id: existing?.id ?? uid("run"),
    showId: episode.showId,
    episodeId: episode.id,
    episodeTitle: episode.title,
    format,
    aspect,
    cards,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.episodePromptRuns.put(run);
  return run;
}

/** Re-run a single card from its source scene's current state, leaving the
 *  rest of the batch untouched (Section 3 per-prompt Regenerate). */
export async function regeneratePromptCard(
  run: EpisodePromptRun,
  cardId: string,
  sets: SetEntity[],
  characters: CharacterEntity[]
): Promise<EpisodePromptRun> {
  const card = run.cards.find((c) => c.id === cardId);
  if (!card || !card.sceneId) return run;
  const scene = await db.scenes.get(card.sceneId);
  if (!scene) return run;

  const rebuilt = buildPromptCard(scene, sets, characters, run.format, run.aspect);
  const cards = run.cards.map((c) => (c.id === cardId ? { ...rebuilt, id: c.id } : c));
  const updated: EpisodePromptRun = { ...run, cards, updatedAt: Date.now() };
  await db.episodePromptRuns.put(updated);
  return updated;
}

export async function deletePromptRun(id: string): Promise<void> {
  await db.episodePromptRuns.delete(id);
}

/** The whole run rendered as one copy-ready document (all cards concatenated). */
export function renderRunDocument(run: EpisodePromptRun): string {
  const label =
    run.format === "reference"
      ? `Broadcast 15s${run.free ? " · free" : run.length ? ` · ${run.length}` : ""}`
      : run.format === "seedance"
        ? `Seedance · ${run.aspect}`
        : "Showrunner";
  const header = `EPISODE PROMPT RUN — ${run.episodeTitle} (${label})`;
  return [header, "", ...run.cards.map((c) => c.prompt)].join("\n\n" + "=".repeat(50) + "\n\n");
}

// --- Reference "Broadcast 15s" format (AI, one prompt per 15 seconds) --------

export const LENGTH_BANDS: Record<EpisodeLength, { label: string; minutes: string; min: number; max: number }> = {
  short: { label: "Short", minutes: "1–3 min", min: 4, max: 12 },
  medium: { label: "Medium", minutes: "8–12 min", min: 32, max: 48 },
  large: { label: "Large", minutes: "20–24 min", min: 80, max: 96 },
};

/** Rough estimate of how many 15-second prompts a source script implies
 *  (~40 source words per clip). Used only to trigger the "needs more" alert. */
export function estimatePromptCount(scriptText: string): number {
  const words = scriptText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 40));
}

/** Render one reference prompt to the copy-ready block shape. */
export function renderReferencePrompt(index: number, r: ReferencePrompt): string {
  const lines = [`Prompt ${index + 1}`, ` * Scene: ${r.scene}`];
  if (r.dialogue.length) {
    lines.push(" * Dialogue:");
    for (const d of r.dialogue) {
      lines.push(`   * ${d.character}${d.delivery ? ` (${d.delivery})` : ""}: "${d.line}"`);
    }
  } else {
    lines.push(" * Dialogue: (none)");
  }
  lines.push(` * Action: ${r.action}`);
  return lines.join("\n");
}

function referenceCard(p: ReferencePrompt, i: number): EpisodePromptCard {
  const dialogue = Array.isArray(p.dialogue) ? p.dialogue : [];
  const words = dialogue.reduce((n, d) => n + (d.line || "").split(/\s+/).filter(Boolean).length, 0);
  const cast = new Set(dialogue.map((d) => d.character).filter(Boolean)).size;
  const normalized: ReferencePrompt = { scene: p.scene || "", dialogue, action: p.action || "" };
  return {
    id: uid("card"),
    sceneId: null,
    sceneName: `Prompt ${i + 1}`,
    order: i + 1,
    prompt: renderReferencePrompt(i, normalized),
    clips: 1,
    takes: 1,
    hasCastWarning: cast > MAX_CAST_PER_TAKE,
    hasPacingWarning: words > MAX_DIALOGUE_WORDS_PER_CLIP,
    reference: normalized,
    generatedAt: Date.now(),
  };
}

interface ReferenceMeta {
  showTitle: string;
  genre: string | null;
  premise: string | null;
}

async function startPromptsJob(body: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/episode-prompts/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, provider: toProviderConfig() }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail || `Request failed (${res.status})`);
  }
  const { job_id } = await res.json();
  return job_id;
}

async function pollPromptsJob(jobId: string, maxMs = 15 * 60 * 1000): Promise<ReferencePrompt[]> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`/api/episode-prompts/status/${jobId}`);
    if (!res.ok) throw new Error(`Job status request failed (${res.status})`);
    const job = await res.json();
    if (job.status === "done") return (job.result?.prompts ?? []) as ReferencePrompt[];
    if (job.status === "error") throw new Error(job.error || "Prompt generation failed.");
  }
  throw new Error("Timed out waiting for prompt generation.");
}

/** Interpret the episode script into reference 15s prompts and persist the run. */
export async function generateReferenceRun(
  episode: EpisodeEntity,
  scriptText: string,
  length: EpisodeLength,
  free: boolean,
  meta: ReferenceMeta
): Promise<EpisodePromptRun> {
  const jobId = await startPromptsJob({
    script: scriptText,
    showTitle: meta.showTitle,
    genre: meta.genre,
    premise: meta.premise,
    targetPrompts: free ? 0 : LENGTH_BANDS[length].max,
    free,
  });
  const prompts = await pollPromptsJob(jobId);
  const cards = prompts.map((p, i) => referenceCard(p, i));

  const existing = await db.episodePromptRuns.where("episodeId").equals(episode.id).first();
  const now = Date.now();
  const run: EpisodePromptRun = {
    id: existing?.id ?? uid("run"),
    showId: episode.showId,
    episodeId: episode.id,
    episodeTitle: episode.title,
    format: "reference",
    aspect: "16:9",
    length,
    free,
    cards,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.episodePromptRuns.put(run);
  return run;
}

/** Re-run a single reference prompt in place, keeping it consistent with the
 *  surrounding beats (reuses the same endpoint with a focused instruction). */
export async function regenerateReferenceCard(
  run: EpisodePromptRun,
  cardId: string,
  scriptText: string,
  meta: ReferenceMeta
): Promise<EpisodePromptRun> {
  const idx = run.cards.findIndex((c) => c.id === cardId);
  const card = run.cards[idx];
  if (!card?.reference) return run;

  const focused = [
    "FULL EPISODE (context only):",
    scriptText,
    "",
    `REGENERATE ONLY THIS SINGLE 15-SECOND BEAT (beat #${idx + 1} of ${run.cards.length}). Keep it consistent with the surrounding beats. Return exactly ONE prompt.`,
    "CURRENT BEAT:",
    `Scene: ${card.reference.scene}`,
    `Action: ${card.reference.action}`,
  ].join("\n");

  const jobId = await startPromptsJob({
    script: focused,
    showTitle: meta.showTitle,
    genre: meta.genre,
    premise: meta.premise,
    targetPrompts: 1,
    free: false,
  });
  const prompts = await pollPromptsJob(jobId);
  if (!prompts.length) return run;

  const rebuilt = referenceCard(prompts[0], idx);
  const cards = run.cards.map((c) => (c.id === cardId ? { ...rebuilt, id: c.id, sceneName: c.sceneName } : c));
  const updated: EpisodePromptRun = { ...run, cards, updatedAt: Date.now() };
  await db.episodePromptRuns.put(updated);
  return updated;
}
