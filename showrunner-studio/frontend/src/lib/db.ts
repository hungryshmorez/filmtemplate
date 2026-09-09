// db.ts — Dexie (IndexedDB) schema, single source of local-first persistence.
import Dexie, { type EntityTable } from "dexie";
import type {
  ShowMeta,
  SetEntity,
  CharacterEntity,
  EpisodeEntity,
  SceneEntity,
  LearnedTemplate,
  EpisodePromptRun,
} from "../types";

export class StudioDB extends Dexie {
  shows!: EntityTable<ShowMeta, "id">;
  sets!: EntityTable<SetEntity, "id">;
  characters!: EntityTable<CharacterEntity, "id">;
  episodes!: EntityTable<EpisodeEntity, "id">;
  scenes!: EntityTable<SceneEntity, "id">;
  learnedTemplates!: EntityTable<LearnedTemplate, "id">;
  episodePromptRuns!: EntityTable<EpisodePromptRun, "id">;

  constructor() {
    super("showrunner-studio");
    this.version(1).stores({
      shows: "id, title, updatedAt",
      sets: "id, showId, name, updatedAt",
      characters: "id, showId, name, role, updatedAt",
      episodes: "id, showId, order, updatedAt",
      scenes: "id, episodeId, order, targetSetId, updatedAt",
    });
    this.version(2).stores({
      shows: "id, title, updatedAt",
      sets: "id, showId, name, updatedAt",
      characters: "id, showId, name, role, updatedAt",
      episodes: "id, showId, order, updatedAt",
      scenes: "id, episodeId, order, targetSetId, updatedAt",
      learnedTemplates: "id, showId, sourceEpisodeId, genre, createdAt",
    });
    // v3: persist Episode Prompt Engine runs so generated prompts survive
    // reloads and episode switches (Section 3).
    this.version(3).stores({
      shows: "id, title, updatedAt",
      sets: "id, showId, name, updatedAt",
      characters: "id, showId, name, role, updatedAt",
      episodes: "id, showId, order, updatedAt",
      scenes: "id, episodeId, order, targetSetId, updatedAt",
      learnedTemplates: "id, showId, sourceEpisodeId, genre, createdAt",
      episodePromptRuns: "id, showId, episodeId, createdAt",
    });
  }
}

export const db = new StudioDB();

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// --- Full project export/import (JSON) ---

export interface ProjectSnapshot {
  version: 1;
  exportedAt: number;
  shows: ShowMeta[];
  sets: SetEntity[];
  characters: CharacterEntity[];
  episodes: EpisodeEntity[];
  scenes: SceneEntity[];
  learnedTemplates?: LearnedTemplate[];
  episodePromptRuns?: EpisodePromptRun[];
}

export async function exportProjectSnapshot(): Promise<ProjectSnapshot> {
  const [shows, sets, characters, episodes, scenes, learnedTemplates, episodePromptRuns] = await Promise.all([
    db.shows.toArray(),
    db.sets.toArray(),
    db.characters.toArray(),
    db.episodes.toArray(),
    db.scenes.toArray(),
    db.learnedTemplates.toArray(),
    db.episodePromptRuns.toArray(),
  ]);
  return { version: 1, exportedAt: Date.now(), shows, sets, characters, episodes, scenes, learnedTemplates, episodePromptRuns };
}

export async function importProjectSnapshot(snapshot: ProjectSnapshot, mode: "merge" | "replace" = "merge") {
  await db.transaction("rw", [db.shows, db.sets, db.characters, db.episodes, db.scenes, db.learnedTemplates, db.episodePromptRuns], async () => {
    if (mode === "replace") {
      await Promise.all([
        db.shows.clear(),
        db.sets.clear(),
        db.characters.clear(),
        db.episodes.clear(),
        db.scenes.clear(),
        db.learnedTemplates.clear(),
        db.episodePromptRuns.clear(),
      ]);
    }
    await db.shows.bulkPut(snapshot.shows);
    await db.sets.bulkPut(snapshot.sets);
    await db.characters.bulkPut(snapshot.characters);
    await db.episodes.bulkPut(snapshot.episodes);
    await db.scenes.bulkPut(snapshot.scenes);
    if (snapshot.learnedTemplates?.length) await db.learnedTemplates.bulkPut(snapshot.learnedTemplates);
    if (snapshot.episodePromptRuns?.length) await db.episodePromptRuns.bulkPut(snapshot.episodePromptRuns);
  });
}
