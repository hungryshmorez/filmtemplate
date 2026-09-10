// ImportPanel.tsx — Bulk import: upload Show Bible / script documents (.txt,
// .md, .pdf, .docx), let the backend extract text and break it down with
// Gemini into Show / Sets / Characters / Episodes / Scenes, review the parsed
// checklist, then commit only the selected records into Dexie.
import { useMemo, useRef, useState } from "react";
import {
  AtSign,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  Clapperboard,
  FileText,
  FileUp,
  Hash,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { CharacterEntity, CharacterRole, DialogueLine, SetEntity, ShowMeta } from "../types";
import { db, uid } from "../lib/db";
import { toProviderConfig } from "../lib/providerSettings";
import { Button, Chip, Field, Label, Modal, Select, Spinner, TextArea, TextInput } from "./ui";

// --- Backend response shapes (mirrors backend/main.py) ----------------------

interface ParsedDialogue {
  character_name: string;
  text: string;
  parenthetical: string | null;
}

interface ParsedScene {
  scene_name: string;
  set_name: string | null;
  character_names: string[];
  action: string;
  dialogue: ParsedDialogue[];
  scene_notes: string;
}

interface ParsedEpisode {
  title: string;
  scenes: ParsedScene[];
}

interface ParsedSet {
  name: string;
  time_of_day: string;
  description: string;
}

interface ParsedCharacter {
  name: string;
  role: string;
  age: string;
  gender: string;
  visual_description: string;
  voice_description: string;
}

interface ParsedShow {
  title: string;
  genre: string;
  premise: string;
}

interface ParseResponse {
  show: ParsedShow;
  sets: ParsedSet[];
  characters: ParsedCharacter[];
  episodes: ParsedEpisode[];
}

// --- Editable review state ----------------------------------------------------

interface ReviewSet extends ParsedSet {
  selected: boolean;
  expanded: boolean;
}

interface ReviewCharacter extends ParsedCharacter {
  role: CharacterRole;
  selected: boolean;
  expanded: boolean;
}

interface ReviewScene extends ParsedScene {
  selected: boolean;
  expanded: boolean;
}

interface ReviewEpisode {
  title: string;
  selected: boolean;
  expanded: boolean;
  scenes: ReviewScene[];
}

interface ReviewState {
  show: ParsedShow;
  sets: ReviewSet[];
  characters: ReviewCharacter[];
  episodes: ReviewEpisode[];
}

type Phase = "upload" | "extracting" | "parsing" | "review" | "importing" | "done";

const ROLES: CharacterRole[] = ["Protagonist", "Antagonist", "Supporting"];
const ACCEPTED_FORMATS = ".txt,.md,.pdf,.docx";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const sanitizeRole = (role: string): CharacterRole =>
  (ROLES as string[]).includes(role) ? (role as CharacterRole) : "Supporting";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string" && data.detail) return data.detail;
    if (data.detail != null) return JSON.stringify(data.detail);
  } catch {
    // not JSON — fall through
  }
  return "";
}

// --- Small shared bits ----------------------------------------------------------

function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="size-3.5 shrink-0 cursor-pointer accent-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

function RadioRow({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-neutral-300">
      <input type="radio" name="import-show-mode" checked={checked} onChange={onChange} className="size-3 accent-amber-500" />
      {label}
    </label>
  );
}

function ExistsBadge({ exists, noun }: { exists: boolean; noun: "set" | "character" }) {
  return (
    <span
      title={
        exists
          ? `Matches an existing ${noun} — its fields will be updated in place`
          : `New ${noun} — will be created`
      }
    >
      <Chip tone={exists ? "amber" : "default"}>{exists ? "merge" : "new"}</Chip>
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  onAll,
  onNone,
}: {
  icon: typeof MapPin;
  title: string;
  count: number;
  onAll?: () => void;
  onNone?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pb-1.5">
      <Icon size={12} className="shrink-0 text-amber-400/80" aria-hidden />
      <Label>
        {title} <span className="text-neutral-500">({count})</span>
      </Label>
      <div className="ml-auto flex gap-2">
        {onAll && (
          <button
            type="button"
            onClick={onAll}
            className="font-mono text-[10px] text-neutral-400 transition-colors hover:text-amber-300"
          >
            all
          </button>
        )}
        {onNone && (
          <button
            type="button"
            onClick={onNone}
            className="font-mono text-[10px] text-neutral-400 transition-colors hover:text-amber-300"
          >
            none
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-dashed border-neutral-800 px-2.5 py-2 text-[11.5px] leading-snug text-neutral-400">
      {children}
    </p>
  );
}

// --- Set row ----------------------------------------------------------------------

function SetRow({
  row,
  index,
  exists,
  disabled,
  onToggle,
  onPatch,
}: {
  row: ReviewSet;
  index: number;
  exists: boolean;
  disabled?: boolean;
  onToggle: (index: number, value: boolean) => void;
  onPatch: (index: number, patch: Partial<ReviewSet>) => void;
}) {
  return (
    <li className="overflow-hidden rounded-md border border-neutral-800/70 bg-neutral-950/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Checkbox checked={row.selected} onChange={(v) => onToggle(index, v)} label={`Import set ${row.name || "unnamed"}`} disabled={disabled} />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onPatch(index, { expanded: !row.expanded })}
          aria-expanded={row.expanded}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-neutral-200">
            <Hash size={11} className="shrink-0 text-amber-400/70" aria-hidden />
            <span className={clsx("truncate", !row.name.trim() && "italic text-neutral-400")}>
              {row.name.trim() || "unnamed set"}
            </span>
          </span>
        </button>
        <ExistsBadge exists={exists} noun="set" />
        {row.time_of_day.trim() && (
          <span className="hidden shrink-0 font-mono text-[10px] text-neutral-400 sm:inline">{row.time_of_day}</span>
        )}
        <button
          type="button"
          aria-label={row.expanded ? `Collapse set ${row.name}` : `Edit set ${row.name}`}
          onClick={() => onPatch(index, { expanded: !row.expanded })}
          className="shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:text-amber-300"
        >
          {row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>
      {row.expanded && (
        <div className="space-y-2 border-t border-neutral-800/70 bg-neutral-900/40 px-2.5 py-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Name">
              <TextInput value={row.name} onChange={(e) => onPatch(index, { name: e.target.value })} aria-label="Set name" />
            </Field>
            <Field label="Time of day">
              <TextInput
                value={row.time_of_day}
                onChange={(e) => onPatch(index, { time_of_day: e.target.value })}
                aria-label="Set time of day"
              />
            </Field>
          </div>
          <Field label="Description">
            <TextArea
              rows={3}
              value={row.description}
              onChange={(e) => onPatch(index, { description: e.target.value })}
              aria-label="Set description"
            />
          </Field>
        </div>
      )}
    </li>
  );
}

// --- Character row ------------------------------------------------------------------

function CharacterRow({
  row,
  index,
  exists,
  disabled,
  onToggle,
  onPatch,
}: {
  row: ReviewCharacter;
  index: number;
  exists: boolean;
  disabled?: boolean;
  onToggle: (index: number, value: boolean) => void;
  onPatch: (index: number, patch: Partial<ReviewCharacter>) => void;
}) {
  return (
    <li className="overflow-hidden rounded-md border border-neutral-800/70 bg-neutral-950/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Checkbox
          checked={row.selected}
          onChange={(v) => onToggle(index, v)}
          label={`Import character ${row.name || "unnamed"}`}
          disabled={disabled}
        />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onPatch(index, { expanded: !row.expanded })}
          aria-expanded={row.expanded}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-neutral-200">
            <AtSign size={11} className="shrink-0 text-amber-400/70" aria-hidden />
            <span className={clsx("truncate", !row.name.trim() && "italic text-neutral-400")}>
              {row.name.trim() || "unnamed character"}
            </span>
          </span>
        </button>
        <ExistsBadge exists={exists} noun="character" />
        <span className="hidden shrink-0 font-mono text-[10px] text-neutral-400 sm:inline">{row.role}</span>
        <button
          type="button"
          aria-label={row.expanded ? `Collapse character ${row.name}` : `Edit character ${row.name}`}
          onClick={() => onPatch(index, { expanded: !row.expanded })}
          className="shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:text-amber-300"
        >
          {row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>
      {row.expanded && (
        <div className="space-y-2 border-t border-neutral-800/70 bg-neutral-900/40 px-2.5 py-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem]">
            <Field label="Name">
              <TextInput value={row.name} onChange={(e) => onPatch(index, { name: e.target.value })} aria-label="Character name" />
            </Field>
            <Field label="Role">
              <Select value={row.role} onChange={(e) => onPatch(index, { role: e.target.value as CharacterRole })} aria-label="Character role">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Age">
              <TextInput value={row.age} onChange={(e) => onPatch(index, { age: e.target.value })} aria-label="Character age" />
            </Field>
            <Field label="Gender">
              <TextInput value={row.gender} onChange={(e) => onPatch(index, { gender: e.target.value })} aria-label="Character gender" />
            </Field>
          </div>
          <Field label="Visual description">
            <TextArea
              rows={3}
              value={row.visual_description}
              onChange={(e) => onPatch(index, { visual_description: e.target.value })}
              aria-label="Character visual description"
            />
          </Field>
          <Field label="Voice description">
            <TextArea
              rows={2}
              value={row.voice_description}
              onChange={(e) => onPatch(index, { voice_description: e.target.value })}
              aria-label="Character voice description"
            />
          </Field>
        </div>
      )}
    </li>
  );
}

// --- Scene row ------------------------------------------------------------------------

function SceneRow({
  scene,
  sceneIndex,
  episodeIndex,
  resolvableSets,
  resolvableCharacters,
  disabled,
  onToggle,
  onPatch,
}: {
  scene: ReviewScene;
  sceneIndex: number;
  episodeIndex: number;
  resolvableSets: Set<string>;
  resolvableCharacters: Set<string>;
  disabled?: boolean;
  onToggle: (episodeIndex: number, sceneIndex: number, value: boolean) => void;
  onPatch: (episodeIndex: number, sceneIndex: number, patch: Partial<ReviewScene>) => void;
}) {
  const [actionExpanded, setActionExpanded] = useState(false);

  const unresolvedSets = scene.set_name && scene.set_name.trim() && !resolvableSets.has(norm(scene.set_name)) ? [scene.set_name] : [];
  const mentionedCharacters = [...new Set([...scene.character_names, ...scene.dialogue.map((d) => d.character_name)])];
  const unresolvedCharacters = mentionedCharacters.filter((n) => n.trim() && !resolvableCharacters.has(norm(n)));
  const hasWarning = unresolvedSets.length > 0 || unresolvedCharacters.length > 0;
  const longAction = scene.action.length > 180;

  return (
    <li>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Checkbox
          checked={scene.selected}
          onChange={(v) => onToggle(episodeIndex, sceneIndex, v)}
          label={`Import scene ${scene.scene_name || sceneIndex + 1}`}
          disabled={disabled}
        />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onPatch(episodeIndex, sceneIndex, { expanded: !scene.expanded })}
          aria-expanded={scene.expanded}
        >
          <span className={clsx("truncate text-[12px] text-neutral-300", !scene.scene_name.trim() && "italic text-neutral-400")}>
            {scene.scene_name.trim() || `Scene ${sceneIndex + 1}`}
          </span>
        </button>
        {scene.set_name && scene.set_name.trim() ? (
          <Chip tone="amber">
            <Hash size={9} aria-hidden />
            {scene.set_name}
          </Chip>
        ) : (
          <Chip tone="dim">no set</Chip>
        )}
        <Chip tone="default">{scene.dialogue.length} lines</Chip>
        {hasWarning && (
          <span title="References something that is neither being imported nor already in your catalog">
            <CircleAlert size={13} className="shrink-0 text-red-400" aria-label="Scene has unresolved references" />
          </span>
        )}
        <button
          type="button"
          aria-label={scene.expanded ? `Collapse scene ${scene.scene_name}` : `Inspect scene ${scene.scene_name}`}
          onClick={() => onPatch(episodeIndex, sceneIndex, { expanded: !scene.expanded })}
          className="shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:text-amber-300"
        >
          {scene.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>
      {scene.expanded && (
        <div className="space-y-2 border-t border-neutral-800/60 bg-neutral-900/30 px-2.5 py-2.5">
          {hasWarning && (
            <div className="flex items-start gap-1.5 rounded border border-red-900/50 bg-red-950/30 px-2 py-1.5 text-[11px] leading-snug text-red-300">
              <CircleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Unresolved references — they will import without a link:
                {unresolvedSets.map((n) => (
                  <Chip key={n} tone="danger" className="ml-1">
                    <Hash size={9} aria-hidden />
                    {n}
                  </Chip>
                ))}
                {unresolvedCharacters.map((n) => (
                  <Chip key={n} tone="danger" className="ml-1">
                    <AtSign size={9} aria-hidden />
                    {n}
                  </Chip>
                ))}
              </span>
            </div>
          )}
          <div>
            <Label className="text-[9px]">Action</Label>
            <p className={clsx("mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-400", !actionExpanded && "line-clamp-3")}>
              {scene.action || "—"}
            </p>
            {longAction && (
              <button
                type="button"
                onClick={() => setActionExpanded((v) => !v)}
                className="mt-0.5 font-mono text-[10px] text-amber-400/80 transition-colors hover:text-amber-300"
              >
                {actionExpanded ? "show less" : "show more"}
              </button>
            )}
          </div>
          {scene.dialogue.length > 0 && (
            <div>
              <Label className="text-[9px]">Dialogue ({scene.dialogue.length})</Label>
              <ul className="mt-1 space-y-0.5">
                {scene.dialogue.slice(0, 6).map((d, i) => (
                  <li key={i} className="text-[11.5px] leading-snug text-neutral-400">
                    <span className="font-mono text-amber-300/90">@{d.character_name}</span>
                    {d.parenthetical ? <span className="italic text-neutral-400"> ({d.parenthetical})</span> : null}
                    <span>: “{d.text.length > 90 ? `${d.text.slice(0, 90)}…` : d.text}”</span>
                  </li>
                ))}
                {scene.dialogue.length > 6 && (
                  <li className="text-[11px] text-neutral-400">+{scene.dialogue.length - 6} more lines…</li>
                )}
              </ul>
            </div>
          )}
          {scene.scene_notes && (
            <div>
              <Label className="text-[9px]">Notes</Label>
              <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-neutral-500">{scene.scene_notes}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// --- Episode block ---------------------------------------------------------------------

function EpisodeBlock({
  episode,
  episodeIndex,
  resolvableSets,
  resolvableCharacters,
  disabled,
  onToggle,
  onPatchEpisode,
  onPatchScene,
  onToggleScene,
}: {
  episode: ReviewEpisode;
  episodeIndex: number;
  resolvableSets: Set<string>;
  resolvableCharacters: Set<string>;
  disabled?: boolean;
  onToggle: (episodeIndex: number, value: boolean) => void;
  onPatchEpisode: (episodeIndex: number, patch: Partial<Pick<ReviewEpisode, "title" | "expanded">>) => void;
  onPatchScene: (episodeIndex: number, sceneIndex: number, patch: Partial<ReviewScene>) => void;
  onToggleScene: (episodeIndex: number, sceneIndex: number, value: boolean) => void;
}) {
  const checked = episode.selected || episode.scenes.some((s) => s.selected);
  return (
    <li className="overflow-hidden rounded-md border border-neutral-800/70 bg-neutral-950/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Checkbox checked={checked} onChange={(v) => onToggle(episodeIndex, v)} label={`Import episode ${episode.title || "untitled"}`} disabled={disabled} />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onPatchEpisode(episodeIndex, { expanded: !episode.expanded })}
          aria-expanded={episode.expanded}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-neutral-200">
            <span className={clsx("truncate", !episode.title.trim() && "italic text-neutral-400")}>
              {episode.title.trim() || "Untitled episode"}
            </span>
            <Chip tone={episode.scenes.length > 0 ? "default" : "dim"}>
              {episode.scenes.length} {episode.scenes.length === 1 ? "scene" : "scenes"}
            </Chip>
          </span>
        </button>
        <button
          type="button"
          aria-label={episode.expanded ? `Collapse episode ${episode.title}` : `Expand episode ${episode.title}`}
          onClick={() => onPatchEpisode(episodeIndex, { expanded: !episode.expanded })}
          className="shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:text-amber-300"
        >
          {episode.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>
      {episode.expanded && (
        <div className="border-t border-neutral-800/70 bg-neutral-900/20">
          {episode.scenes.length === 0 ? (
            <p className="px-3 py-2 text-[11.5px] text-neutral-400">No scenes were detected in this episode.</p>
          ) : (
            <ul className="divide-y divide-neutral-800/60">
              {episode.scenes.map((sc, sIdx) => (
                <SceneRow
                  key={sIdx}
                  scene={sc}
                  sceneIndex={sIdx}
                  episodeIndex={episodeIndex}
                  resolvableSets={resolvableSets}
                  resolvableCharacters={resolvableCharacters}
                  disabled={disabled}
                  onToggle={onToggleScene}
                  onPatch={onPatchScene}
                />
              ))}
            </ul>
          )}
          <div className="border-t border-neutral-800/60 px-2.5 py-2">
            <Field label="Episode title">
              <TextInput
                value={episode.title}
                onChange={(e) => onPatchEpisode(episodeIndex, { title: e.target.value })}
                aria-label="Episode title"
              />
            </Field>
          </div>
        </div>
      )}
    </li>
  );
}

// --- Main panel --------------------------------------------------------------------------

interface ImportPanelProps {
  open: boolean;
  onClose: () => void;
  show: ShowMeta | null;
  sets: SetEntity[];
  characters: CharacterEntity[];
  onImported: (showId: string, episodeId: string | null, sceneId: string | null) => void;
}

export function ImportPanel({ open, onClose, show, sets, characters, onImported }: ImportPanelProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [showChecked, setShowChecked] = useState(true);
  const [showMode, setShowMode] = useState<"update" | "create">(show ? "update" : "create");
  const [doneSummary, setDoneSummary] = useState<{ showLabel: string; sets: number; characters: number; episodes: number; scenes: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingSetNames = useMemo(() => new Set(sets.map((s) => norm(s.name))), [sets]);
  const existingCharNames = useMemo(() => new Set(characters.map((c) => norm(c.name))), [characters]);

  // Names that a scene reference can resolve to at import time: checked rows + existing catalog.
  const resolvableSets = useMemo(() => {
    const all = new Set(existingSetNames);
    for (const row of review?.sets ?? []) {
      if (row.selected && row.name.trim()) all.add(norm(row.name));
    }
    return all;
  }, [existingSetNames, review]);

  const resolvableCharacters = useMemo(() => {
    const all = new Set(existingCharNames);
    for (const row of review?.characters ?? []) {
      if (row.selected && row.name.trim()) all.add(norm(row.name));
    }
    return all;
  }, [existingCharNames, review]);

  const busy = phase === "extracting" || phase === "parsing";
  const importBusy = phase === "importing";

  // --- Review state mutations ------------------------------------------------------------

  const patchShow = (patch: Partial<ParsedShow>) =>
    setReview((r) => (r ? { ...r, show: { ...r.show, ...patch } } : r));

  const patchSet = (index: number, patch: Partial<ReviewSet>) =>
    setReview((r) => (r ? { ...r, sets: r.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : r));

  const toggleSet = (index: number, value: boolean) => patchSet(index, { selected: value });

  const patchCharacter = (index: number, patch: Partial<ReviewCharacter>) =>
    setReview((r) => (r ? { ...r, characters: r.characters.map((c, i) => (i === index ? { ...c, ...patch } : c)) } : r));

  const toggleCharacter = (index: number, value: boolean) => patchCharacter(index, { selected: value });

  const patchEpisode = (index: number, patch: Partial<Pick<ReviewEpisode, "title" | "expanded">>) =>
    setReview((r) => (r ? { ...r, episodes: r.episodes.map((e, i) => (i === index ? { ...e, ...patch } : e)) } : r));

  // Episode checkbox cascades to all of its scenes.
  const toggleEpisode = (index: number, value: boolean) =>
    setReview((r) =>
      r
        ? {
            ...r,
            episodes: r.episodes.map((e, i) =>
              i === index ? { ...e, selected: value, scenes: e.scenes.map((s) => ({ ...s, selected: value })) } : e
            ),
          }
        : r
    );

  const toggleScene = (episodeIndex: number, sceneIndex: number, value: boolean) =>
    setReview((r) =>
      r
        ? {
            ...r,
            episodes: r.episodes.map((e, i) =>
              i === episodeIndex
                ? { ...e, scenes: e.scenes.map((s, si) => (si === sceneIndex ? { ...s, selected: value } : s)) }
                : e
            ),
          }
        : r
    );

  const patchScene = (episodeIndex: number, sceneIndex: number, patch: Partial<ReviewScene>) =>
    setReview((r) =>
      r
        ? {
            ...r,
            episodes: r.episodes.map((e, i) =>
              i === episodeIndex
                ? { ...e, scenes: e.scenes.map((s, si) => (si === sceneIndex ? { ...s, ...patch } : s)) }
                : e
            ),
          }
        : r
    );

  // --- File handling & analysis pipeline ---------------------------------------------------

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const runAnalysis = async () => {
    if (files.length === 0 && !pastedText.trim()) return;
    if (busy) return;
    setError(null);
    setPhase("extracting");
    try {
      const chunks: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length, filename: file.name });
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/import/extract-text", { method: "POST", body });
        if (!res.ok) {
          const detail = await errorDetail(res);
          throw new Error(detail || `Could not read “${file.name}” (API ${res.status}).`);
        }
        const data = (await res.json()) as { filename: string; text: string };
        chunks.push(`=== FILE: ${data.filename} ===\n${data.text}`);
      }
      if (pastedText.trim()) {
        chunks.push(`=== PASTED TEXT ===\n${pastedText.trim()}`);
      }

      const combinedText = chunks.join("\n\n");
      if (!combinedText.trim()) {
        throw new Error("No readable text could be extracted from the selected files.");
      }

      setProgress(null);
      setPhase("parsing");
      const startRes = await fetch("/api/import/parse/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combined_text: combinedText,
          existing: {
            set_names: sets.map((s) => s.name),
            character_names: characters.map((c) => c.name),
          },
          provider: toProviderConfig(),
        }),
      });
      if (!startRes.ok) {
        const detail = await errorDetail(startRes);
        throw new Error(detail || `The AI breakdown failed to start (API ${startRes.status}).`);
      }
      const { job_id } = (await startRes.json()) as { job_id: string };

      // Poll for completion — large documents can take well over a minute,
      // longer than the reverse proxy allows for a single held request.
      let data: ParseResponse | null = null;
      const pollStart = Date.now();
      const maxWaitMs = 5 * 60 * 1000;
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const statusRes = await fetch(`/api/import/parse/status/${job_id}`);
        if (!statusRes.ok) {
          const detail = await errorDetail(statusRes);
          throw new Error(detail || `Lost track of the AI breakdown job (API ${statusRes.status}).`);
        }
        const job = (await statusRes.json()) as { status: "pending" | "done" | "error"; result: ParseResponse | null; error: string | null };
        if (job.status === "done") {
          data = job.result;
          break;
        }
        if (job.status === "error") {
          throw new Error(job.error || "The AI breakdown failed.");
        }
        if (Date.now() - pollStart > maxWaitMs) {
          throw new Error("The AI breakdown is taking too long. Please try again with a smaller document.");
        }
      }
      if (!data) {
        throw new Error("The AI breakdown returned no data.");
      }
      setReview({
        show: {
          title: data.show?.title ?? "",
          genre: data.show?.genre ?? "",
          premise: data.show?.premise ?? "",
        },
        sets: (data.sets ?? []).map((s) => ({
          name: s.name ?? "",
          time_of_day: s.time_of_day ?? "",
          description: s.description ?? "",
          selected: true,
          expanded: false,
        })),
        characters: (data.characters ?? []).map((c) => ({
          name: c.name ?? "",
          role: sanitizeRole(c.role ?? ""),
          age: c.age ?? "",
          gender: c.gender ?? "",
          visual_description: c.visual_description ?? "",
          voice_description: c.voice_description ?? "",
          selected: true,
          expanded: false,
        })),
        episodes: (data.episodes ?? []).map((e) => ({
          title: e.title ?? "",
          selected: true,
          expanded: true,
          scenes: (e.scenes ?? []).map((s) => ({
            scene_name: s.scene_name ?? "",
            set_name: s.set_name ?? null,
            character_names: s.character_names ?? [],
            action: s.action ?? "",
            dialogue: (s.dialogue ?? []).map((d) => ({
              character_name: d.character_name ?? "",
              text: d.text ?? "",
              parenthetical: d.parenthetical ?? null,
            })),
            scene_notes: s.scene_notes ?? "",
            selected: true,
            expanded: false,
          })),
        })),
      });
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
      setPhase("upload");
    }
  };

  // --- Commit -------------------------------------------------------------------------------

  const commit = async () => {
    if (!review) return;
    setPhase("importing");
    setError(null);
    try {
      const result = await db.transaction("rw", db.shows, db.sets, db.characters, db.episodes, db.scenes, async () => {
        const ts = Date.now();
        const creating = !show || showMode === "create";

        // 1. Resolve the target show.
        let targetShowId: string;
        if (creating) {
          targetShowId = uid("show");
          await db.shows.put({
            id: targetShowId,
            title: showChecked ? review.show.title.trim() || "Untitled Show" : show?.title.trim() || "Imported Show",
            genre: showChecked ? review.show.genre.trim() : "",
            premise: showChecked ? review.show.premise : "",
            createdAt: ts,
            updatedAt: ts,
          });
        } else {
          targetShowId = show!.id;
          if (showChecked) {
            await db.shows.update(targetShowId, {
              title: review.show.title.trim() || "Untitled Show",
              genre: review.show.genre.trim(),
              premise: review.show.premise,
              updatedAt: ts,
            });
          }
        }

        // 2. Seed name -> id maps from the target show's current catalog.
        const [catalogSets, catalogChars, catalogEps] = await Promise.all([
          db.sets.where("showId").equals(targetShowId).toArray(),
          db.characters.where("showId").equals(targetShowId).toArray(),
          db.episodes.where("showId").equals(targetShowId).toArray(),
        ]);
        const setMap = new Map(catalogSets.map((s) => [norm(s.name), s.id]));
        const charMap = new Map(catalogChars.map((c) => [norm(c.name), c.id]));

        // 3. Sets — reuse existing ids on name match (merge/update), otherwise create.
        let importedSets = 0;
        for (const row of review.sets) {
          if (!row.selected) continue;
          const name = row.name.trim();
          if (!name) continue;
          const key = norm(name);
          const existingId = setMap.get(key);
          if (existingId) {
            await db.sets.update(existingId, {
              timeOfDay: row.time_of_day.trim(),
              description: row.description,
              updatedAt: ts,
            });
          } else {
            const id = uid("set");
            await db.sets.put({
              id,
              showId: targetShowId,
              name,
              timeOfDay: row.time_of_day.trim(),
              description: row.description,
              createdAt: ts,
              updatedAt: ts,
            });
            setMap.set(key, id);
          }
          importedSets++;
        }

        // 4. Characters — same merge-or-create rule.
        let importedCharacters = 0;
        for (const row of review.characters) {
          if (!row.selected) continue;
          const name = row.name.trim();
          if (!name) continue;
          const key = norm(name);
          const existingId = charMap.get(key);
          if (existingId) {
            await db.characters.update(existingId, {
              role: row.role,
              age: row.age.trim(),
              gender: row.gender.trim(),
              visualDescription: row.visual_description,
              voiceDescription: row.voice_description,
              updatedAt: ts,
            });
          } else {
            const id = uid("chr");
            await db.characters.put({
              id,
              showId: targetShowId,
              name,
              role: row.role,
              age: row.age.trim(),
              gender: row.gender.trim(),
              visualDescription: row.visual_description,
              voiceDescription: row.voice_description,
              createdAt: ts,
              updatedAt: ts,
            });
            charMap.set(key, id);
          }
          importedCharacters++;
        }

        // 5. Episodes + scenes — resolve references through the maps.
        let order = catalogEps.length ? Math.max(...catalogEps.map((e) => e.order)) : 0;
        let importedEpisodes = 0;
        let importedScenes = 0;
        let firstEpisodeId: string | null = null;
        let firstSceneId: string | null = null;
        for (const ep of review.episodes) {
          const selectedScenes = ep.scenes.filter((s) => s.selected);
          if (!ep.selected && selectedScenes.length === 0) continue;
          order += 1;
          const episodeId = uid("ep");
          await db.episodes.put({
            id: episodeId,
            showId: targetShowId,
            title: ep.title.trim() || `Episode ${order}`,
            order,
            createdAt: ts,
            updatedAt: ts,
          });
          importedEpisodes++;
          if (!firstEpisodeId) firstEpisodeId = episodeId;
          for (let i = 0; i < selectedScenes.length; i++) {
            const sc = selectedScenes[i];
            const targetSetId = (sc.set_name && setMap.get(norm(sc.set_name))) || null;
            const activeCharacterIds = [
              ...new Set(
                sc.character_names
                  .map((n) => charMap.get(norm(n)))
                  .filter((id): id is string => Boolean(id))
              ),
            ];
            const dialogue: DialogueLine[] = [];
            for (const d of sc.dialogue) {
              const characterId = charMap.get(norm(d.character_name));
              if (characterId) {
                dialogue.push({
                  id: uid("dl"),
                  characterId,
                  text: d.text,
                  parenthetical: d.parenthetical ?? "",
                });
              }
            }
            const sceneId = uid("scn");
            await db.scenes.put({
              id: sceneId,
              episodeId,
              sceneName: sc.scene_name.trim() || `Scene ${i + 1}`,
              order: i + 1,
              targetSetId,
              activeCharacterIds,
              action: sc.action,
              dialogue,
              sceneNotes: sc.scene_notes ?? "",
              createdAt: ts,
              updatedAt: ts,
            });
            importedScenes++;
            if (!firstSceneId) firstSceneId = sceneId;
          }
        }

        return {
          showId: targetShowId,
          showLabel: creating ? "1 new show" : "1 show update",
          sets: importedSets,
          characters: importedCharacters,
          episodes: importedEpisodes,
          scenes: importedScenes,
          firstEpisodeId,
          firstSceneId,
        };
      });

      setDoneSummary({
        showLabel: result.showLabel,
        sets: result.sets,
        characters: result.characters,
        episodes: result.episodes,
        scenes: result.scenes,
      });
      setPhase("done");
      onImported(result.showId, result.firstEpisodeId, result.firstSceneId);
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("review");
    }
  };

  // --- Derived counts for the sticky footer ---------------------------------------------------

  const checkedSets = review?.sets.filter((s) => s.selected && s.name.trim()).length ?? 0;
  const checkedCharacters = review?.characters.filter((c) => c.selected && c.name.trim()).length ?? 0;
  const checkedEpisodes = review?.episodes.filter((e) => e.selected || e.scenes.some((s) => s.selected)).length ?? 0;
  const checkedScenes = review?.episodes.flatMap((e) => e.scenes).filter((s) => s.selected).length ?? 0;
  const includeShow = showChecked && (show !== null || review !== null);

  const summaryParts: string[] = [];
  if (includeShow && review) summaryParts.push(!show || showMode === "create" ? "1 new show" : "1 show update");
  if (checkedSets) summaryParts.push(`${checkedSets} ${checkedSets === 1 ? "set" : "sets"}`);
  if (checkedCharacters) summaryParts.push(`${checkedCharacters} ${checkedCharacters === 1 ? "character" : "characters"}`);
  if (checkedEpisodes) summaryParts.push(`${checkedEpisodes} ${checkedEpisodes === 1 ? "episode" : "episodes"}`);
  if (checkedScenes) summaryParts.push(`${checkedScenes} ${checkedScenes === 1 ? "scene" : "scenes"}`);
  const summaryText = summaryParts.length
    ? `Importing: ${summaryParts.join(", ")}`
    : "Nothing selected — tick the items you want to bring in.";

  const startOver = () => {
    setPhase("upload");
    setReview(null);
    setError(null);
    setProgress(null);
  };

  const requestClose = () => {
    if (!importBusy) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title="Import Bible & Script"
      subtitle="Upload documents → review the AI breakdown → import into your library."
      wide
    >
      {/* Step 1 — Upload & analyze */}
      {(phase === "upload" || busy) && (
        <div className="space-y-3 p-3 sm:p-4">
          <div
            className={clsx(
              "rounded-lg border border-dashed p-6 text-center transition-colors",
              dragOver ? "border-amber-500/70 bg-amber-500/10" : "border-neutral-700 bg-neutral-950/40 hover:border-neutral-600"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) addFiles(e.dataTransfer.files);
            }}
          >
            <FileUp size={28} className={clsx("mx-auto", dragOver ? "text-amber-300" : "text-neutral-400")} aria-hidden />
            <p className="mt-2 text-[13px] font-medium text-neutral-200">Drop Show Bible / script files here</p>
            <p className="mt-1 text-[11.5px] text-neutral-500">.txt, .md, .pdf or .docx — multiple files welcome</p>
            <Button variant="ghost" size="md" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              Browse files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              aria-hidden
            />
          </div>

          {files.length > 0 && (
            <div>
              <Label>
                {files.length} {files.length === 1 ? "file" : "files"} queued
              </Label>
              <ul className="mt-1.5 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-neutral-800/70 bg-neutral-950/40 px-2 py-1.5"
                  >
                    <FileText size={13} className="shrink-0 text-amber-400/70" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-200">{f.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-neutral-400">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => removeFile(i)}
                      disabled={busy}
                      className="shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:text-red-400 disabled:opacity-40"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-400">
            <div className="h-px flex-1 bg-neutral-800" />
            <span>or paste text</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          <Field label="Paste Show Bible / script text">
            <TextArea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your show bible, outline, or script here…"
              rows={6}
              disabled={busy}
            />
          </Field>

          {busy && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-500/25 bg-amber-500/5 p-3" role="status">
              <Spinner size={15} className="mt-0.5" />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-amber-200">
                  {phase === "extracting"
                    ? `Reading file ${progress?.current ?? 1} of ${progress?.total ?? files.length} — ${progress?.filename ?? ""}`
                    : "Analyzing documents with Gemini…"}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  {phase === "extracting"
                    ? "Extracting text from the document."
                    : "Breaking everything down into sets, characters, episodes and scenes. Large documents can take a minute or two."}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 p-2.5 text-[12px] leading-snug text-red-300"
              role="alert"
            >
              <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={runAnalysis}
              disabled={(files.length === 0 && !pastedText.trim()) || busy}
            >
              <Sparkles size={13} /> Extract &amp; Analyze
            </Button>
            {(files.length > 0 || pastedText.trim()) && !busy && (
              <Button
                variant="subtle"
                size="md"
                onClick={() => {
                  setFiles([]);
                  setPastedText("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <p className="text-center text-[11px] leading-snug text-neutral-400">
            Documents are sent to the local API for text extraction, then broken down by AI. You review everything before it
            touches your library.
          </p>
        </div>
      )}

      {/* Step 2 — Review */}
      {(phase === "review" || phase === "importing") && review && (
        <div>
          <div className="space-y-4 p-3 sm:p-4">
            {/* Show meta */}
            <section>
              <SectionHeader icon={BookOpen} title="Show" count={includeShow && review ? 1 : 0} />
              <div className="space-y-2.5 rounded-md border border-neutral-800/70 bg-neutral-950/40 p-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Checkbox
                    checked={show ? showChecked : true}
                    onChange={setShowChecked}
                    disabled={!show}
                    label="Include show details"
                  />
                  <span className="text-[12px] text-neutral-300">Show details</span>
                  {!show && <Chip tone="amber">creates first show</Chip>}
                  {show && showChecked && (
                    <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
                      <RadioRow checked={showMode === "update"} onChange={() => setShowMode("update")} label={`Update “${show.title}”`} />
                      <RadioRow checked={showMode === "create"} onChange={() => setShowMode("create")} label="Create a new show" />
                    </div>
                  )}
                </div>
                {showChecked && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field label="Title">
                        <TextInput
                          value={review.show.title}
                          onChange={(e) => patchShow({ title: e.target.value })}
                          placeholder="Show title"
                          aria-label="Show title"
                        />
                      </Field>
                      <Field label="Genre">
                        <TextInput
                          value={review.show.genre}
                          onChange={(e) => patchShow({ genre: e.target.value })}
                          placeholder="e.g. Analog-horror sitcom"
                          aria-label="Show genre"
                        />
                      </Field>
                    </div>
                    <Field label="Premise">
                      <TextArea
                        rows={3}
                        value={review.show.premise}
                        onChange={(e) => patchShow({ premise: e.target.value })}
                        placeholder="World rules, lore, visual style…"
                        aria-label="Show premise"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </section>

            {/* Sets */}
            <section>
              <SectionHeader
                icon={MapPin}
                title="Sets"
                count={review.sets.length}
                onAll={review.sets.length > 0 ? () => setReview((r) => (r ? { ...r, sets: r.sets.map((s) => ({ ...s, selected: true })) } : r)) : undefined}
                onNone={review.sets.length > 0 ? () => setReview((r) => (r ? { ...r, sets: r.sets.map((s) => ({ ...s, selected: false })) } : r)) : undefined}
              />
              {review.sets.length === 0 ? (
                <EmptyHint>No sets were detected in the documents.</EmptyHint>
              ) : (
                <ul className="space-y-1">
                  {review.sets.map((row, i) => (
                    <SetRow
                      key={i}
                      row={row}
                      index={i}
                      exists={Boolean(row.name.trim()) && existingSetNames.has(norm(row.name))}
                      disabled={importBusy}
                      onToggle={toggleSet}
                      onPatch={patchSet}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Characters */}
            <section>
              <SectionHeader
                icon={AtSign}
                title="Characters"
                count={review.characters.length}
                onAll={
                  review.characters.length > 0
                    ? () => setReview((r) => (r ? { ...r, characters: r.characters.map((c) => ({ ...c, selected: true })) } : r))
                    : undefined
                }
                onNone={
                  review.characters.length > 0
                    ? () => setReview((r) => (r ? { ...r, characters: r.characters.map((c) => ({ ...c, selected: false })) } : r))
                    : undefined
                }
              />
              {review.characters.length === 0 ? (
                <EmptyHint>No characters were detected in the documents.</EmptyHint>
              ) : (
                <ul className="space-y-1">
                  {review.characters.map((row, i) => (
                    <CharacterRow
                      key={i}
                      row={row}
                      index={i}
                      exists={Boolean(row.name.trim()) && existingCharNames.has(norm(row.name))}
                      disabled={importBusy}
                      onToggle={toggleCharacter}
                      onPatch={patchCharacter}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Episodes & scenes */}
            <section>
              <SectionHeader
                icon={Clapperboard}
                title="Episodes & scenes"
                count={review.episodes.length}
                onAll={
                  review.episodes.length > 0
                    ? () =>
                        setReview((r) =>
                          r
                            ? {
                                ...r,
                                episodes: r.episodes.map((e) => ({
                                  ...e,
                                  selected: true,
                                  scenes: e.scenes.map((s) => ({ ...s, selected: true })),
                                })),
                              }
                            : r
                        )
                    : undefined
                }
                onNone={
                  review.episodes.length > 0
                    ? () =>
                        setReview((r) =>
                          r
                            ? {
                                ...r,
                                episodes: r.episodes.map((e) => ({
                                  ...e,
                                  selected: false,
                                  scenes: e.scenes.map((s) => ({ ...s, selected: false })),
                                })),
                              }
                            : r
                        )
                    : undefined
                }
              />
              {review.episodes.length === 0 ? (
                <EmptyHint>No episodes were detected in the documents.</EmptyHint>
              ) : (
                <ul className="space-y-1.5">
                  {review.episodes.map((ep, i) => (
                    <EpisodeBlock
                      key={i}
                      episode={ep}
                      episodeIndex={i}
                      resolvableSets={resolvableSets}
                      resolvableCharacters={resolvableCharacters}
                      disabled={importBusy}
                      onToggle={toggleEpisode}
                      onPatchEpisode={patchEpisode}
                      onToggleScene={toggleScene}
                      onPatchScene={patchScene}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>

          {error && (
            <div
              className="mx-3 flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 p-2.5 text-[12px] leading-snug text-red-300 sm:mx-4"
              role="alert"
            >
              <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {/* Sticky footer with live selection summary */}
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-neutral-800 bg-neutral-900/95 px-3 py-3 backdrop-blur sm:px-4">
            <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-neutral-400" aria-live="polite">
              {summaryText}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="subtle" size="md" onClick={startOver} disabled={importBusy}>
                <RotateCcw size={13} /> Start over
              </Button>
              <Button variant="primary" size="md" onClick={commit} disabled={importBusy || summaryParts.length === 0}>
                {importBusy ? <Spinner size={13} /> : <Check size={13} strokeWidth={2.5} />}
                {importBusy ? "Importing…" : "Import selected"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {phase === "done" && doneSummary && (
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <CircleCheckBig size={30} className="mx-auto text-emerald-400" aria-hidden />
            <h3 className="mt-2 text-sm font-semibold text-neutral-100">Import complete</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
              {doneSummary.showLabel}, {doneSummary.sets} {doneSummary.sets === 1 ? "set" : "sets"},{" "}
              {doneSummary.characters} {doneSummary.characters === 1 ? "character" : "characters"},{" "}
              {doneSummary.episodes} {doneSummary.episodes === 1 ? "episode" : "episodes"} and {doneSummary.scenes}{" "}
              {doneSummary.scenes === 1 ? "scene" : "scenes"} were written to your library.
            </p>
          </div>
          <Button variant="primary" size="md" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
