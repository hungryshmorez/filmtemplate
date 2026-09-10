// crossover.ts — Bridge two shows into one generation-ready crossover episode.
// Assembles both shows' bibles (premise + characters + sets) from Dexie, sends
// them with the crossover premise to the backend, and persists the returned
// multi-scene episode (reference 15s Scene/Dialogue/Action beats).
import { db, uid } from "./db";
import { toProviderConfig } from "./providerSettings";
import { renderReferencePrompt } from "./episodePrompts";
import type { CrossoverScene, ReferencePrompt, StoredCrossover } from "../types";

async function shibleFor(showId: string) {
  const show = await db.shows.get(showId);
  if (!show) return null;
  const [characters, sets] = await Promise.all([
    db.characters.where("showId").equals(showId).toArray(),
    db.sets.where("showId").equals(showId).toArray(),
  ]);
  return {
    show,
    payload: {
      title: show.title,
      genre: show.genre,
      premise: show.premise,
      characters: characters.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        age: c.age,
        gender: c.gender,
        visual_description: c.visualDescription,
        voice_description: c.voiceDescription,
      })),
      sets: sets.map((s) => ({ id: s.id, name: s.name, time_of_day: s.timeOfDay, description: s.description })),
    },
  };
}

function normalizePrompts(arr: unknown): ReferencePrompt[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const dialogue = Array.isArray(o.dialogue) ? o.dialogue : [];
    return {
      scene: typeof o.scene === "string" ? o.scene : "",
      action: typeof o.action === "string" ? o.action : "",
      dialogue: dialogue.map((d) => {
        const dd = (d ?? {}) as Record<string, unknown>;
        return {
          character: typeof dd.character === "string" ? dd.character : "",
          delivery: typeof dd.delivery === "string" ? dd.delivery : "",
          line: typeof dd.line === "string" ? dd.line : "",
        };
      }),
    };
  });
}

async function startJob(body: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/crossover/start", {
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

async function pollJob(jobId: string, maxMs = 15 * 60 * 1000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`/api/crossover/status/${jobId}`);
    if (!res.ok) throw new Error(`Job status request failed (${res.status})`);
    const job = await res.json();
    if (job.status === "done") return (job.result ?? {}) as Record<string, unknown>;
    if (job.status === "error") throw new Error(job.error || "Crossover generation failed.");
  }
  throw new Error("Timed out waiting for the crossover to generate.");
}

export async function generateCrossover(
  show1Id: string,
  show2Id: string,
  premise: string,
  tone: string,
  sceneCount: number
): Promise<StoredCrossover> {
  if (show1Id === show2Id) throw new Error("Pick two different shows to cross over.");
  const b1 = await shibleFor(show1Id);
  const b2 = await shibleFor(show2Id);
  if (!b1 || !b2) throw new Error("One of the selected shows no longer exists.");

  const jobId = await startJob({
    show1: b1.payload,
    show2: b2.payload,
    premise,
    tone,
    scene_count: sceneCount,
  });
  const data = await pollJob(jobId);

  const scenes: CrossoverScene[] = Array.isArray(data.scenes)
    ? (data.scenes as unknown[]).map((s) => {
        const so = (s ?? {}) as Record<string, unknown>;
        return { name: typeof so.name === "string" ? so.name : "Scene", prompts: normalizePrompts(so.prompts) };
      })
    : [];

  const rec: StoredCrossover = {
    id: uid("xover"),
    title: typeof data.title === "string" && data.title ? data.title : `${b1.show.title} × ${b2.show.title}`,
    logline: typeof data.logline === "string" ? data.logline : "",
    outline: Array.isArray(data.outline) ? (data.outline as unknown[]).filter((x): x is string => typeof x === "string") : [],
    scenes,
    show1Id,
    show2Id,
    show1Title: b1.show.title,
    show2Title: b2.show.title,
    premise,
    tone,
    sceneCount,
    createdAt: Date.now(),
  };
  await db.crossovers.put(rec);
  return rec;
}

export async function deleteCrossover(id: string): Promise<void> {
  await db.crossovers.delete(id);
}

/** The whole crossover rendered as one copy-ready document. */
export function renderCrossoverDocument(x: StoredCrossover): string {
  const lines: string[] = [`CROSSOVER — ${x.title}`, ""];
  if (x.logline) lines.push(`LOGLINE: ${x.logline}`, "");
  if (x.outline.length) {
    lines.push("OUTLINE:");
    x.outline.forEach((o) => lines.push(`  - ${o}`));
    lines.push("");
  }
  x.scenes.forEach((sc, si) => {
    lines.push("=".repeat(50));
    lines.push(`SCENE ${si + 1} — ${sc.name}`);
    lines.push("=".repeat(50));
    sc.prompts.forEach((p, pi) => {
      lines.push("");
      lines.push(renderReferencePrompt(pi, p));
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function renderCrossoverScene(name: string, prompts: ReferencePrompt[], index: number): string {
  const lines: string[] = [`SCENE ${index + 1} — ${name}`, ""];
  prompts.forEach((p, pi) => {
    lines.push(renderReferencePrompt(pi, p), "");
  });
  return lines.join("\n").trim();
}
