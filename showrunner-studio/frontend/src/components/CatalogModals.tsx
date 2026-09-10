// CatalogModals.tsx — Modal dialogs for the show-level catalog: Sets,
// Characters, and the Show Bible (ShowMeta) editor.
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Hash, AtSign, Library, Plus, Trash } from "lucide-react";
import type { CharacterEntity, CharacterRole, LearnedTemplate, SetEntity, ShowMeta } from "../types";
import { createCharacter, createSet, deleteCharacter, deleteSet, updateCharacter, updateSet, updateShow } from "../lib/actions";
import { deleteLearnedTemplate } from "../lib/templateLearning";
import { Button, Chip, Field, Label, Modal, Select, TextArea, TextInput } from "./ui";
import { ImagePicker } from "./ImagePicker";
import { useConfirm } from "./ConfirmDialog";

// Small square/wide thumbnail for a catalog list row.
function RowThumb({ src, alt, shape = "square" }: { src?: string; alt: string; shape?: "square" | "wide" }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={clsx("shrink-0 rounded border border-neutral-800 object-cover", shape === "wide" ? "h-8 w-12" : "h-8 w-8")}
    />
  );
}

// --- Shared bits --------------------------------------------------------------

// Responsive 40% list / 60% detail split. On desktop the row is a fixed
// height so the list and the form each scroll independently and smoothly.
function CatalogLayout({ list, form }: { list: ReactNode; form: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col sm:h-[70vh] sm:flex-row">
      <div className="flex min-h-0 shrink-0 flex-col border-b border-neutral-800 sm:w-2/5 sm:border-b-0 sm:border-r">
        {list}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:w-3/5">{form}</div>
    </div>
  );
}

function CatalogList({ count, noun, children }: { count: number; noun: string; children: ReactNode }) {
  return (
    <div className="flex h-full max-h-56 min-h-0 flex-col sm:max-h-none">
      <div className="flex items-center justify-between px-3 py-2.5">
        <Label>
          {count} {noun}
        </Label>
      </div>
      <ul className="min-h-0 flex-1 space-y-px overflow-y-auto px-1.5 pb-2">{children}</ul>
    </div>
  );
}

// --- Sets manager ----------------------------------------------------------------

const TIME_OF_DAY_IDEAS = ["Interior", "Exterior", "Night", "Day", "Dusk", "Liminal", "Void"];

interface SetsManagerProps {
  open: boolean;
  onClose: () => void;
  showId: string;
  sets: SetEntity[];
}

export function SetsManager({ open, onClose, showId, sets }: SetsManagerProps) {
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setName("");
      setTimeOfDay("");
      setDescription("");
      setImage(undefined);
    }
  }, [open]);

  const loadForEdit = (s: SetEntity) => {
    setEditingId(s.id);
    setName(s.name);
    setTimeOfDay(s.timeOfDay);
    setDescription(s.description);
    setImage(s.image);
  };

  const reset = () => {
    setEditingId(null);
    setName("");
    setTimeOfDay("");
    setDescription("");
    setImage(undefined);
  };

  const saveImage = (next: string | undefined) => {
    setImage(next);
    if (editingId) void updateSet(editingId, { image: next });
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editingId) {
      await updateSet(editingId, { name: trimmed, timeOfDay: timeOfDay.trim(), description, image });
    } else {
      await createSet(showId, { name: trimmed, timeOfDay: timeOfDay.trim(), description, image });
    }
    reset();
  };

  const validName = name.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Sets" subtitle="Physical locations referenced by #TagName in scene actions." wide>
      <CatalogLayout
        list={
          <CatalogList count={sets.length} noun={sets.length === 1 ? "set" : "sets"}>
            {sets.map((s) => (
              <li key={s.id}>
                <div
                  className={clsx(
                    "group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px]",
                    s.id === editingId ? "bg-amber-500/10 text-amber-200" : "text-neutral-300 hover:bg-neutral-800/70"
                  )}
                  onClick={() => loadForEdit(s)}
                >
                  <RowThumb src={s.image} alt={`${s.name} reference`} shape="wide" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="truncate text-[10px] text-neutral-400">{s.timeOfDay || "—"}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete set ${s.name}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirm({ message: `Delete set "${s.name}"? Scenes pointing at it will be unlinked.`, confirmLabel: "Delete set" })) {
                        if (s.id === editingId) reset();
                        void deleteSet(s.id);
                      }
                    }}
                    className="shrink-0 rounded p-1 text-neutral-500 opacity-70 transition-colors hover:bg-red-950/70 hover:text-red-400 hover:opacity-100"
                  >
                    <Trash size={11} />
                  </button>
                </div>
              </li>
            ))}
          </CatalogList>
        }
        form={
          <div className="space-y-3">
            <Field label={editingId ? "Edit set" : "New set"}>
              <div className="flex items-center gap-2">
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abandoned Broadcast Booth"
                  aria-label="Set name"
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
                <Chip tone={validName ? "amber" : "dim"} className="h-7 shrink-0">
                  <Hash size={10} aria-hidden />
                  {validName ? name.trim() : "TagName"}
                </Chip>
              </div>
            </Field>
            <Field label="Time of day / quality">
              <TextInput
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                placeholder="Interior, Night, Liminal…"
                aria-label="Time of day"
                list="timeofday-ideas"
              />
              <datalist id="timeofday-ideas">
                {TIME_OF_DAY_IDEAS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Description" hint="Physical traits, props, textures, ambient audio — feeds Seedance ambience.">
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Peeling varnish, a dead CRT glowing faint blue, tape-hiss ambience…"
                aria-label="Set description"
              />
            </Field>
            <ImagePicker
              label="Reference photo"
              shape="wide"
              value={image}
              onChange={saveImage}
              hint="A visual reference for this location. Downscaled and stored in this browser."
            />
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={save} disabled={!validName}>
                <Plus size={13} strokeWidth={2.5} />
                {editingId ? "Save changes" : "Add set"}
              </Button>
              {editingId && (
                <Button variant="subtle" size="md" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        }
      />
    </Modal>
  );
}

// --- Characters manager -------------------------------------------------------------

const ROLES: CharacterRole[] = ["Protagonist", "Antagonist", "Supporting"];

interface CharactersManagerProps {
  open: boolean;
  onClose: () => void;
  showId: string;
  characters: CharacterEntity[];
}

export function CharactersManager({ open, onClose, showId, characters }: CharactersManagerProps) {
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<CharacterRole>("Supporting");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [visualDescription, setVisualDescription] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [portrait, setPortrait] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setEditingId(null);
    setName("");
    setRole("Supporting");
    setAge("");
    setGender("");
    setVisualDescription("");
    setVoiceDescription("");
    setPortrait(undefined);
  };

  const loadForEdit = (c: CharacterEntity) => {
    setEditingId(c.id);
    setName(c.name);
    setRole(c.role);
    setAge(c.age);
    setGender(c.gender);
    setVisualDescription(c.visualDescription);
    setVoiceDescription(c.voiceDescription);
    setPortrait(c.portrait);
  };

  const savePortrait = (next: string | undefined) => {
    setPortrait(next);
    if (editingId) void updateCharacter(editingId, { portrait: next });
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      role,
      age: age.trim(),
      gender: gender.trim(),
      visualDescription,
      voiceDescription,
      portrait,
    };
    if (editingId) {
      await updateCharacter(editingId, payload);
    } else {
      await createCharacter(showId, payload);
    }
    reset();
  };

  const validName = name.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Characters"
      subtitle="Cast referenced by @TagName in actions and dialogue."
      wide
    >
      <CatalogLayout
        list={
          <CatalogList count={characters.length} noun={characters.length === 1 ? "character" : "characters"}>
            {characters.map((c) => (
              <li key={c.id}>
                <div
                  className={clsx(
                    "group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px]",
                    c.id === editingId ? "bg-amber-500/10 text-amber-200" : "text-neutral-300 hover:bg-neutral-800/70"
                  )}
                  onClick={() => loadForEdit(c)}
                >
                  <RowThumb src={c.portrait} alt={`${c.name} portrait`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-[10px] text-neutral-400">{c.role}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete character ${c.name}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirm({ message: `Delete character "${c.name}"? Their dialogue lines will be removed from scenes.`, confirmLabel: "Delete character" })) {
                        if (c.id === editingId) reset();
                        void deleteCharacter(c.id);
                      }
                    }}
                    className="shrink-0 rounded p-1 text-neutral-500 opacity-70 transition-colors hover:bg-red-950/70 hover:text-red-400 hover:opacity-100"
                  >
                    <Trash size={11} />
                  </button>
                </div>
              </li>
            ))}
          </CatalogList>
        }
        form={
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <Field label={editingId ? "Edit character" : "New character"} className="flex-1">
                <div className="flex items-center gap-2">
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CUSTARD"
                    aria-label="Character name"
                    onKeyDown={(e) => e.key === "Enter" && save()}
                  />
                  <Chip tone={validName ? "amber" : "dim"} className="h-7 shrink-0">
                    <AtSign size={10} aria-hidden />
                    {validName ? name.trim() : "Name"}
                  </Chip>
                </div>
              </Field>
              <Field label="Role" className="w-36">
                <Select value={role} onChange={(e) => setRole(e.target.value as CharacterRole)} aria-label="Role">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <TextInput value={age} onChange={(e) => setAge(e.target.value)} placeholder='62yo, "ageless"' aria-label="Age" />
              </Field>
              <Field label="Gender">
                <TextInput value={gender} onChange={(e) => setGender(e.target.value)} placeholder="—" aria-label="Gender" />
              </Field>
            </div>
            <Field label="Visual description" hint="Physical form, material, clothing, visual quirks → Character DNA persistence block.">
              <TextArea
                value={visualDescription}
                onChange={(e) => setVisualDescription(e.target.value)}
                rows={4}
                placeholder="A custard-yellow puppet of indeterminate species; frayed velvet seams, oversized bow tie…"
                aria-label="Visual description"
              />
            </Field>
            <Field label="Voice description" hint="Timbre, dialect, cadence, audio processing / distortion traits.">
              <TextArea
                value={voiceDescription}
                onChange={(e) => setVoiceDescription(e.target.value)}
                rows={3}
                placeholder="Warm baritone warped through a 1970s tape delay; slight clip at phrase ends…"
                aria-label="Voice description"
              />
            </Field>
            <ImagePicker
              label="Portrait"
              shape="square"
              value={portrait}
              onChange={savePortrait}
              hint="A reference portrait for this character. Downscaled and stored in this browser."
            />
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={save} disabled={!validName}>
                <Plus size={13} strokeWidth={2.5} />
                {editingId ? "Save changes" : "Add character"}
              </Button>
              {editingId && (
                <Button variant="subtle" size="md" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        }
      />
    </Modal>
  );
}

// --- Show Bible -----------------------------------------------------------------------

interface ShowBibleModalProps {
  open: boolean;
  onClose: () => void;
  show: ShowMeta | null;
}

export function ShowBibleModal({ open, onClose, show }: ShowBibleModalProps) {
  // Local draft synced from the store; saved on every change (partial patch).
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [premise, setPremise] = useState("");

  useEffect(() => {
    setTitle(show?.title ?? "");
    setGenre(show?.genre ?? "");
    setPremise(show?.premise ?? "");
  }, [show?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  return (
    <Modal open={open} onClose={onClose} title="Show Bible" subtitle="Top-level context fed to the AI scene generator." wide>
      <div className="space-y-3 p-4">
        <ImagePicker
          label="Cover image"
          shape="wide"
          value={show.coverImage}
          onChange={(next) => void updateShow(show.id, { coverImage: next })}
          hint="A cover for this project. Downscaled and stored in this browser."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Title">
            <TextInput
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                void updateShow(show.id, { title: e.target.value.trim() || "Untitled Show" });
              }}
              placeholder="Show title"
              aria-label="Show title"
            />
          </Field>
          <Field label="Genre">
            <TextInput
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                void updateShow(show.id, { genre: e.target.value });
              }}
              placeholder="e.g. Analog-horror sitcom"
              aria-label="Show genre"
            />
          </Field>
        </div>
        <Field
          label="Premise"
          hint="World rules, lore, visual style, glitch / broadcast aesthetics. Included as context when generating scenes with AI."
        >
          <TextArea
            value={premise}
            onChange={(e) => {
              setPremise(e.target.value);
              void updateShow(show.id, { premise: e.target.value });
            }}
            rows={8}
            placeholder="A lost children's program broadcast from a station that shouldn't exist…"
            aria-label="Show premise"
          />
        </Field>
        <p className="font-mono text-[10px] text-neutral-400">Changes save automatically to this browser.</p>
      </div>
    </Modal>
  );
}

// --- Learned Templates manager --------------------------------------------------
// Read-only viewer for the templates the AI has stripped out of finalized
// episodes (see lib/templateLearning.ts). Delete-only — these aren't hand-edited.

interface LearnedTemplatesManagerProps {
  open: boolean;
  onClose: () => void;
  templates: LearnedTemplate[];
}

export function LearnedTemplatesManager({ open, onClose, templates }: LearnedTemplatesManagerProps) {
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelectedId(null);
    else if (!selectedId && templates.length) setSelectedId(templates[0].id);
  }, [open, templates, selectedId]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Learned Templates"
      subtitle="Reusable story engines the AI stripped out of episodes you've finalized. Feed them back in from the Write Script tab in AI Script Lab."
      wide
    >
      <CatalogLayout
        list={
          <CatalogList count={templates.length} noun={templates.length === 1 ? "template" : "templates"}>
            {templates.length === 0 && (
              <li className="px-2 py-3 text-[11px] leading-relaxed text-neutral-400">
                Nothing learned yet — finalize an episode (the <Library size={10} className="inline" aria-hidden /> icon
                on an episode row) to grow this library.
              </li>
            )}
            {templates.map((t) => (
              <li key={t.id}>
                <div
                  className={clsx(
                    "group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px]",
                    t.id === selectedId ? "bg-amber-500/10 text-amber-200" : "text-neutral-300 hover:bg-neutral-800/70"
                  )}
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.name}</div>
                    <div className="truncate text-[10px] text-neutral-400">
                      {t.genre} · from "{t.sourceEpisodeTitle}"
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete template ${t.name}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirm({ message: `Delete learned template "${t.name}"? This doesn't affect the source episode.`, confirmLabel: "Delete template" })) {
                        if (t.id === selectedId) setSelectedId(null);
                        void deleteLearnedTemplate(t.id);
                      }
                    }}
                    className="shrink-0 rounded p-1 text-neutral-500 opacity-70 transition-colors hover:bg-red-950/70 hover:text-red-400 hover:opacity-100"
                  >
                    <Trash size={11} />
                  </button>
                </div>
              </li>
            ))}
          </CatalogList>
        }
        form={
          selected ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                  {selected.format} · {selected.genre}
                </p>
                <h3 className="text-sm font-semibold text-amber-300">{selected.name}</h3>
              </div>
              <div>
                <p className="text-[11px] font-medium text-neutral-400">Concept</p>
                <p className="text-[13px] leading-relaxed text-neutral-300">{selected.concept}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-neutral-400">Mechanics</p>
                <p className="text-[13px] leading-relaxed text-neutral-300">{selected.mechanics}</p>
              </div>
              {selected.beats.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-400">Beats</p>
                  <ol className="mt-1 space-y-1.5">
                    {selected.beats.map((b, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-neutral-300">
                        <span className="font-medium text-neutral-100">{b.label}.</span> {b.description}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-neutral-400">
              Select a template on the left to see its full brief.
            </p>
          )
        }
      />
    </Modal>
  );
}
