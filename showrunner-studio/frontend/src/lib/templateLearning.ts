// templateLearning.ts — "Learn from what you ship" loop: finalize a
// completed episode, strip a genre-agnostic reusable template out of it via
// AI, and grow the persistent LearnedTemplate library in Dexie.
import { db, uid } from "./db";
import { updateEpisode } from "./actions";
import type { CharacterEntity, EpisodeEntity, LearnedTemplate, SceneEntity, SetEntity } from "../types";

// Build the full episode script text (scene action + dialogue, character and
// set names resolved) in story order — this is what gets sent to the
// extraction model.
export function buildEpisodeScriptText(
  episode: EpisodeEntity,
  scenes: SceneEntity[],
  characters: CharacterEntity[],
  sets: SetEntity[]
): string {
  const charName = (id: string) => characters.find((c) => c.id === id)?.name ?? "UNKNOWN";
  const setName = (id: string | null) => (id ? sets.find((s) => s.id === id)?.name ?? "UNSPECIFIED SET" : "UNSPECIFIED SET");

  const ordered = [...scenes].sort((a, b) => a.order - b.order);

  const body = ordered
    .map((sc, i) => {
      const lines = [
        `SCENE ${i + 1}: ${sc.sceneName || `Scene ${sc.order}`} — ${setName(sc.targetSetId)}`,
        "",
        sc.action.trim(),
        "",
        ...sc.dialogue.map((d) => `${charName(d.characterId)}: ${d.parenthetical ? `(${d.parenthetical}) ` : ""}${d.text}`),
      ];
      if (sc.sceneNotes.trim()) lines.push("", `[Notes: ${sc.sceneNotes.trim()}]`);
      return lines.join("\n").trim();
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return `EPISODE: ${episode.title}\n\n${body}`;
}

interface ExtractJobResult {
  status: "pending" | "done" | "error";
  result?: {
    name: string;
    format: string;
    concept: string;
    mechanics: string;
    beats: { label: string; description: string }[];
  } | null;
  error?: string | null;
}

async function pollExtractJob(jobId: string, maxMs = 6 * 60 * 1000): Promise<NonNullable<ExtractJobResult["result"]>> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`/api/extract-template/status/${jobId}`);
    if (!res.ok) throw new Error(`Job status request failed (${res.status})`);
    const job: ExtractJobResult = await res.json();
    if (job.status === "done" && job.result) return job.result;
    if (job.status === "error") throw new Error(job.error || "Template extraction failed.");
  }
  throw new Error("Timed out waiting for template extraction (6 min).");
}

// Full finalize flow: extract a template from the episode, save it to the
// library, and stamp the episode as finalized.
export async function finalizeEpisode(
  episode: EpisodeEntity,
  scenes: SceneEntity[],
  characters: CharacterEntity[],
  sets: SetEntity[],
  genre: string | null
): Promise<LearnedTemplate> {
  if (scenes.length === 0) {
    throw new Error("This episode has no scenes to learn from yet.");
  }
  const episodeText = buildEpisodeScriptText(episode, scenes, characters, sets);

  const startRes = await fetch("/api/extract-template/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ episodeTitle: episode.title, genre, episodeText }),
  });
  if (!startRes.ok) {
    const detail = await startRes.json().catch(() => ({}));
    throw new Error(detail?.detail || `Request failed (${startRes.status})`);
  }
  const { job_id } = await startRes.json();
  const extracted = await pollExtractJob(job_id);

  const template: LearnedTemplate = {
    id: uid("tpl"),
    showId: episode.showId,
    sourceEpisodeId: episode.id,
    sourceEpisodeTitle: episode.title,
    genre: genre || "Unknown",
    name: extracted.name,
    format: extracted.format,
    concept: extracted.concept,
    mechanics: extracted.mechanics,
    beats: extracted.beats,
    createdAt: Date.now(),
  };

  await db.learnedTemplates.put(template);
  await updateEpisode(episode.id, { finalizedAt: Date.now() });

  return template;
}

export async function deleteLearnedTemplate(id: string): Promise<void> {
  await db.learnedTemplates.delete(id);
}

// Rendered plain-text brief for a LearnedTemplate — matches the shape of
// renderTvEngineBrief/renderFilmTemplateBrief in storyTemplates.ts so it can
// slot into the same "template brief" injection point in CritiquePanel.
export function renderLearnedTemplateBrief(t: LearnedTemplate): string {
  const beats = t.beats.map((b, i) => `${i + 1}. ${b.label} — ${b.description}`).join("\n");
  return [
    `LEARNED TEMPLATE: ${t.name} (${t.format}, from "${t.sourceEpisodeTitle}")`,
    `CONCEPT: ${t.concept}`,
    `MECHANICS: ${t.mechanics}`,
    beats ? `BEATS:\n${beats}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
