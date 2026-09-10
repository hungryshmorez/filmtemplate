// movies.ts — Movie (act-based) canonical model helpers. A movie's canonical
// structure is Acts -> Beats (standard 3-act or custom). The "Episode Split"
// is a DERIVED, temporary partition of the flat beat list into episode-sized
// chunks purely for generation planning — it never mutates the canonical acts.
import { uid } from "./db";
import type { MovieAct, MovieBeat } from "../types";
import type { FilmTemplate } from "./storyTemplates";

export const newBeat = (title = "", description = ""): MovieBeat => ({ id: uid("beat"), title, description });
export const newAct = (title: string, beats: MovieBeat[] = []): MovieAct => ({ id: uid("act"), title, beats });

/** A blank standard 3-act skeleton for a fresh movie. */
export function defaultMovieActs(): MovieAct[] {
  return [
    newAct("Act I — Setup & Catalyst"),
    newAct("Act II — Confrontation & Escalation"),
    newAct("Act III — Resolution & Climax"),
  ];
}

// A film-template beat string is "Label: description" — split on the first
// colon so the label becomes the beat title.
function beatFromString(s: string): MovieBeat {
  const idx = s.indexOf(":");
  if (idx === -1) return newBeat("", s.trim());
  return newBeat(s.slice(0, idx).trim(), s.slice(idx + 1).trim());
}

/** Scaffold a movie's acts/beats from one of the 3-act film templates. */
export function actsFromFilmTemplate(t: FilmTemplate): MovieAct[] {
  return [
    newAct("Act I — Setup & Catalyst", t.acts.actI.map(beatFromString)),
    newAct("Act II — Confrontation & Escalation", t.acts.actII.map(beatFromString)),
    newAct("Act III — Resolution & Climax", t.acts.actIII.map(beatFromString)),
  ];
}

// --- Derived Episode Split ---------------------------------------------------

export interface SplitBeat {
  actTitle: string;
  beat: MovieBeat;
}

export interface DerivedEpisode {
  title: string;
  beats: SplitBeat[];
}

/** Flatten every beat in act order, tagged with its source act title. */
export function flattenBeats(acts: MovieAct[]): SplitBeat[] {
  return acts.flatMap((a) => a.beats.map((beat) => ({ actTitle: a.title, beat })));
}

/**
 * Partition the flat beat list into `episodeCount` roughly-even, order-preserving
 * episode-sized chunks. Derived only — the canonical acts/beats are untouched.
 */
export function splitIntoEpisodes(acts: MovieAct[], episodeCount: number): DerivedEpisode[] {
  const flat = flattenBeats(acts);
  const n = Math.max(1, Math.min(episodeCount, flat.length || 1));
  const episodes: DerivedEpisode[] = Array.from({ length: n }, (_, i) => ({ title: `Episode ${i + 1}`, beats: [] }));
  flat.forEach((sb, i) => {
    const bucket = flat.length ? Math.min(n - 1, Math.floor((i / flat.length) * n)) : 0;
    episodes[bucket].beats.push(sb);
  });
  return episodes;
}

/** Copy-ready plain-text render of a derived episode split. */
export function renderEpisodeSplit(movieTitle: string, episodes: DerivedEpisode[]): string {
  const lines: string[] = [`EPISODE SPLIT (derived) — ${movieTitle}`, ""];
  episodes.forEach((ep) => {
    lines.push(`### ${ep.title} — ${ep.beats.length} beat${ep.beats.length === 1 ? "" : "s"} ###`);
    ep.beats.forEach((sb, i) => {
      lines.push(`  ${i + 1}. [${sb.actTitle}] ${sb.beat.title}${sb.beat.title && sb.beat.description ? " — " : ""}${sb.beat.description}`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}
