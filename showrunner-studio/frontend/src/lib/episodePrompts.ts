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
  EpisodePromptCard,
  EpisodePromptRun,
  PromptFormat,
  SceneEntity,
  SetEntity,
} from "../types";
import { formatSceneForShowrunner, renderShowrunnerBlocks } from "./showrunnerFormat";
import { exportSceneToSeedance, renderSeedancePayload } from "./seedanceExport";

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
  const header = `EPISODE PROMPT RUN — ${run.episodeTitle} (${run.format === "seedance" ? `Seedance · ${run.aspect}` : "Showrunner"})`;
  return [header, "", ...run.cards.map((c) => c.prompt)].join("\n\n" + "=".repeat(50) + "\n\n");
}
