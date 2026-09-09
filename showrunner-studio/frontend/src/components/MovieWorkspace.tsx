// MovieWorkspace.tsx — Movie (act-based) canonical editor + derived Episode
// Split. Movies are a distinct top-level type: their canonical structure is
// Acts -> Beats (not an episode list). The Episode Split tab is a derived,
// temporary partition for generation planning and never mutates the acts.
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Clapperboard, Film, Plus, Sparkles, SplitSquareHorizontal, Trash } from "lucide-react";
import type { MovieAct, MovieBeat, ShowMeta } from "../types";
import { updateMovieActs } from "../lib/actions";
import { actsFromFilmTemplate, newAct, newBeat, renderEpisodeSplit, splitIntoEpisodes } from "../lib/movies";
import { GENRES, getFilmSuite, type Genre } from "../lib/storyTemplates";
import { Button, Chip, CopyButton, Field, Label, Select, TextArea, TextInput } from "./ui";
import { useConfirm } from "./ConfirmDialog";

interface Props {
  className?: string;
  show: ShowMeta;
}

type Tab = "structure" | "split";

export function MovieWorkspace({ className, show }: Props) {
  const [tab, setTab] = useState<Tab>("structure");
  const acts = useMemo(() => show.acts ?? [], [show.acts]);

  return (
    <main className={clsx("min-h-0 min-w-0 flex-1 overflow-y-auto lg:block", className)}>
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="amber">
            <Film size={10} aria-hidden /> MOVIE
          </Chip>
          <span className="text-sm font-semibold text-neutral-100">{show.title}</span>
          {show.genre && <Chip tone="dim">{show.genre}</Chip>}
          <span className="ml-auto font-mono text-[10px] text-neutral-500">act-based · not an episode list</span>
        </div>

        <div role="tablist" aria-label="Movie views" className="flex gap-1 border-b border-neutral-800">
          {([
            ["structure", "Structure", Clapperboard],
            ["split", "Episode Split", SplitSquareHorizontal],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors",
                tab === id ? "border-amber-400 text-amber-200" : "border-transparent text-neutral-400 hover:text-neutral-200"
              )}
            >
              <Icon size={12} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {tab === "structure" ? (
          <StructureEditor show={show} acts={acts} />
        ) : (
          <EpisodeSplitView show={show} acts={acts} />
        )}
      </div>
    </main>
  );
}

// --- Structure (canonical acts/beats) ---------------------------------------

function StructureEditor({ show, acts }: { show: ShowMeta; acts: MovieAct[] }) {
  const confirm = useConfirm();
  const [templateGenre, setTemplateGenre] = useState<Genre>(
    (GENRES as string[]).includes(show.genre) ? (show.genre as Genre) : GENRES[0]
  );
  const [arc, setArc] = useState<string>("");

  const save = (next: MovieAct[]) => void updateMovieActs(show.id, next);

  const patchAct = (actId: string, patch: Partial<MovieAct>) =>
    save(acts.map((a) => (a.id === actId ? { ...a, ...patch } : a)));
  const removeAct = (actId: string) => save(acts.filter((a) => a.id !== actId));
  const addAct = () => save([...acts, newAct(`Act ${acts.length + 1}`)]);
  const moveAct = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= acts.length) return;
    const next = [...acts];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  const patchBeat = (actId: string, beatId: string, patch: Partial<MovieBeat>) =>
    save(acts.map((a) => (a.id === actId ? { ...a, beats: a.beats.map((b) => (b.id === beatId ? { ...b, ...patch } : b)) } : a)));
  const addBeat = (actId: string) =>
    save(acts.map((a) => (a.id === actId ? { ...a, beats: [...a.beats, newBeat()] } : a)));
  const removeBeat = (actId: string, beatId: string) =>
    save(acts.map((a) => (a.id === actId ? { ...a, beats: a.beats.filter((b) => b.id !== beatId) } : a)));
  const moveBeat = (actId: string, i: number, dir: -1 | 1) =>
    save(
      acts.map((a) => {
        if (a.id !== actId) return a;
        const j = i + dir;
        if (j < 0 || j >= a.beats.length) return a;
        const beats = [...a.beats];
        [beats[i], beats[j]] = [beats[j], beats[i]];
        return { ...a, beats };
      })
    );

  const suite = getFilmSuite(templateGenre);
  const applyTemplate = async () => {
    if (!suite) return;
    const template = arc ? suite.templates.find((t) => t.name === arc) ?? suite.templates[0] : suite.templates[0];
    const hasContent = acts.some((a) => a.beats.length > 0);
    if (hasContent) {
      const ok = await confirm({
        message: `Replace the current act/beat structure with the "${template.name}" template? This overwrites your beats.`,
        confirmLabel: "Replace structure",
        danger: false,
      });
      if (!ok) return;
    }
    save(actsFromFilmTemplate(template));
  };

  return (
    <div className="space-y-4">
      {/* Film template scaffolding (2 per genre x 14, 3-act, distinct from TV). */}
      <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
        <Label className="inline-flex items-center gap-1.5">
          <Sparkles size={11} aria-hidden /> Scaffold from a film template
        </Label>
        <p className="text-[11.5px] leading-snug text-neutral-400">
          Feature-film 3-act suites — two arcs per genre, distinct from the TV 5-beat engines.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Genre</Label>
            <Select
              value={templateGenre}
              onChange={(e) => {
                setTemplateGenre(e.target.value as Genre);
                setArc("");
              }}
              className="w-40"
              aria-label="Template genre"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Arc</Label>
            <Select value={arc} onChange={(e) => setArc(e.target.value)} className="w-56" aria-label="Template arc">
              {suite?.templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.arc})
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" size="md" onClick={applyTemplate}>
            <Sparkles size={13} /> Apply template
          </Button>
        </div>
      </div>

      {acts.length === 0 && (
        <p className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[12.5px] text-neutral-400">
          No acts yet. Add one, or scaffold from a film template above.
        </p>
      )}

      <ul className="space-y-3">
        {acts.map((act, ai) => (
          <li key={act.id} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <div className="flex items-center gap-2">
              <Chip tone="amber">ACT {ai + 1}</Chip>
              <TextInput
                value={act.title}
                onChange={(e) => patchAct(act.id, { title: e.target.value })}
                aria-label={`Act ${ai + 1} title`}
                className="min-w-0 flex-1 font-semibold"
              />
              <div className="flex shrink-0 items-center">
                <IconBtn label="Move act up" onClick={() => moveAct(ai, -1)} disabled={ai === 0}>
                  <ChevronUp size={13} />
                </IconBtn>
                <IconBtn label="Move act down" onClick={() => moveAct(ai, 1)} disabled={ai === acts.length - 1}>
                  <ChevronDown size={13} />
                </IconBtn>
                <IconBtn label="Delete act" danger onClick={() => removeAct(act.id)}>
                  <Trash size={12} />
                </IconBtn>
              </div>
            </div>

            <ul className="space-y-2 pl-1">
              {act.beats.map((beat, bi) => (
                <li key={beat.id} className="rounded-md border border-neutral-800/70 bg-neutral-950/50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-neutral-500">{bi + 1}</span>
                    <TextInput
                      value={beat.title}
                      onChange={(e) => patchBeat(act.id, beat.id, { title: e.target.value })}
                      placeholder="Beat label (e.g. Inciting Incident)"
                      aria-label="Beat title"
                      className="min-w-0 flex-1"
                    />
                    <div className="flex shrink-0 items-center">
                      <IconBtn label="Move beat up" onClick={() => moveBeat(act.id, bi, -1)} disabled={bi === 0}>
                        <ChevronUp size={12} />
                      </IconBtn>
                      <IconBtn label="Move beat down" onClick={() => moveBeat(act.id, bi, 1)} disabled={bi === act.beats.length - 1}>
                        <ChevronDown size={12} />
                      </IconBtn>
                      <IconBtn label="Delete beat" danger onClick={() => removeBeat(act.id, beat.id)}>
                        <Trash size={11} />
                      </IconBtn>
                    </div>
                  </div>
                  <TextArea
                    value={beat.description}
                    onChange={(e) => patchBeat(act.id, beat.id, { description: e.target.value })}
                    rows={2}
                    placeholder="What happens in this beat…"
                    aria-label="Beat description"
                    className="mt-1.5"
                  />
                </li>
              ))}
            </ul>
            <Button variant="subtle" size="xs" onClick={() => addBeat(act.id)}>
              <Plus size={11} /> Add beat
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" size="md" onClick={addAct}>
        <Plus size={13} /> Add act
      </Button>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded p-1 text-neutral-500 transition-colors disabled:opacity-30",
        danger ? "hover:bg-red-950/70 hover:text-red-400" : "hover:bg-neutral-800 hover:text-neutral-100"
      )}
    >
      {children}
    </button>
  );
}

// --- Derived Episode Split ---------------------------------------------------

function EpisodeSplitView({ show, acts }: { show: ShowMeta; acts: MovieAct[] }) {
  const totalBeats = acts.reduce((n, a) => n + a.beats.length, 0);
  const [episodeCount, setEpisodeCount] = useState(3);

  const episodes = useMemo(() => splitIntoEpisodes(acts, episodeCount), [acts, episodeCount]);
  const rendered = useMemo(() => renderEpisodeSplit(show.title, episodes), [show.title, episodes]);

  if (totalBeats === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-800 px-3 py-6 text-center text-[12.5px] text-neutral-400">
        Add some beats in the Structure tab first — the Episode Split partitions them into episode-sized chunks.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
        <Field label="Split into" className="w-40">
          <Select
            value={episodeCount}
            onChange={(e) => setEpisodeCount(Number(e.target.value))}
            aria-label="Number of episodes"
          >
            {Array.from({ length: Math.min(totalBeats, 12) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} episode{n === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </Field>
        <p className="flex-1 text-[11.5px] leading-snug text-neutral-400">
          A derived, temporary partition of the movie&apos;s {totalBeats} beats for generation planning. The canonical
          act structure is unchanged.
        </p>
        <CopyButton text={rendered} label="Copy split" size="md" variant="ghost" />
      </div>

      <ul className="space-y-3">
        {episodes.map((ep, i) => (
          <li key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Chip tone="amber">{ep.title}</Chip>
              <Chip tone="dim">{ep.beats.length} beat{ep.beats.length === 1 ? "" : "s"}</Chip>
            </div>
            <ol className="space-y-1.5">
              {ep.beats.map((sb, bi) => (
                <li key={bi} className="text-[12.5px] leading-relaxed text-neutral-300">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-neutral-500">{sb.actTitle}</span>
                  <br />
                  <span className="font-medium text-neutral-100">{sb.beat.title || `Beat ${bi + 1}`}</span>
                  {sb.beat.description ? <span className="text-neutral-400"> — {sb.beat.description}</span> : null}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  );
}
