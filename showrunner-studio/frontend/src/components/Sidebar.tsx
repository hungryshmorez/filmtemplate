// Sidebar.tsx — Project tree (Shows → Episodes → Scenes) + catalog shortcuts.
import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { BookOpen, ChevronRight, FileUp, FlaskConical, Library, MapPin, Pencil, Plus, Sparkles, Trash, Users } from "lucide-react";
import type { EpisodeEntity, SceneEntity, ShowMeta } from "../types";
import { Button, Spinner } from "./ui";

interface SidebarProps {
  shows: ShowMeta[];
  selectedShowId: string | null;
  episodes: EpisodeEntity[];
  selectedEpisodeId: string | null;
  scenes: SceneEntity[];
  selectedSceneId: string | null;
  setCount: number;
  characterCount: number;
  onSelectShow: (id: string) => void;
  onSelectEpisode: (id: string) => void;
  onSelectScene: (id: string) => void;
  onAddShow: () => void;
  onAddEpisode: () => void;
  onAddScene: () => void;
  onDeleteShow: (show: ShowMeta) => void;
  onDeleteEpisode: (ep: EpisodeEntity) => void;
  onDeleteScene: (scene: SceneEntity) => void;
  onRenameShow: (show: ShowMeta, title: string) => void;
  onRenameEpisode: (ep: EpisodeEntity, title: string) => void;
  onOpenSets: () => void;
  onOpenCharacters: () => void;
  onOpenShowBible: () => void;
  onOpenImport: () => void;
  onOpenAiLab: () => void;
  onOpenTemplates: () => void;
  templateCount: number;
  onFinalizeEpisode: (ep: EpisodeEntity) => void;
  finalizingEpisodeId: string | null;
  className?: string;
}

function Section({ title, count, onAdd, addLabel, empty, children }: {
  title: string;
  count: number;
  onAdd?: () => void;
  addLabel?: string;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-neutral-800/70 py-2">
      <div className="flex items-center justify-between px-3 pb-1">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-neutral-500">
          {title} <span className="text-neutral-500">({count})</span>
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={addLabel ?? `Add ${title}`}
            aria-label={addLabel ?? `Add ${title}`}
            className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-amber-400"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {count === 0 && empty && <p className="px-3 pb-1 text-[11px] leading-snug text-neutral-500">{empty}</p>}
      <ul className="space-y-px px-1.5">{children}</ul>
    </section>
  );
}

function TreeRow({ active, label, sub, onSelect, onDelete, deleteTitle, onRename, onFinalize, finalized, finalizing }: {
  active: boolean;
  label: string;
  sub?: string;
  onSelect: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
  onRename?: (next: string) => void;
  onFinalize?: () => void;
  finalized?: boolean;
  finalizing?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) onRename?.(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <li>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="Rename"
          className="h-6 w-full rounded border border-amber-500/50 bg-neutral-950 px-2 text-[12px] text-neutral-100 focus:outline-none"
        />
      </li>
    );
  }

  return (
    <li
      className={clsx(
        "group flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[12px] transition-colors",
        active ? "bg-amber-500/10 text-amber-200" : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-200"
      )}
      onClick={onSelect}
    >
      <ChevronRight
        size={11}
        aria-hidden
        className={clsx("shrink-0 transition-colors", active ? "text-amber-400" : "text-neutral-500")}
      />
      <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left" onClick={onSelect}>
        {label}
      </button>
      {sub && <span className="shrink-0 font-mono text-[9px] text-neutral-400">{sub}</span>}
      {onFinalize && (
        <button
          type="button"
          title={
            finalizing
              ? "Extracting a reusable template…"
              : finalized
                ? "Re-finalize: extract a fresh template from this episode"
                : "Finalize: strip a reusable template out of this episode into the library"
          }
          aria-label={`Finalize ${label}`}
          disabled={finalizing}
          onClick={(e) => {
            e.stopPropagation();
            onFinalize();
          }}
          className={clsx(
            "shrink-0 rounded p-1 transition-colors",
            finalized ? "text-amber-500/70 hover:bg-amber-950/40 hover:text-amber-300" : "text-neutral-500 hover:bg-neutral-800 hover:text-amber-300",
            finalizing && "opacity-60"
          )}
        >
          {finalizing ? <Spinner size={11} /> : <Sparkles size={12} />}
        </button>
      )}
      {onRename && (
        <button
          type="button"
          title="Rename"
          aria-label={`Rename ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            setDraft(label);
            setEditing(true);
          }}
          className="shrink-0 rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Pencil size={12} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          title={deleteTitle ?? "Delete"}
          aria-label={`Delete ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded p-1 text-neutral-500 transition-colors hover:bg-red-950/70 hover:text-red-400"
        >
          <Trash size={12} />
        </button>
      )}
    </li>
  );
}

export function Sidebar(props: SidebarProps) {
  const {
    shows, selectedShowId, episodes, selectedEpisodeId, scenes, selectedSceneId,
    setCount, characterCount,
    onSelectShow, onSelectEpisode, onSelectScene,
    onAddShow, onAddEpisode, onAddScene,
    onDeleteShow, onDeleteEpisode, onDeleteScene,
    onRenameShow, onRenameEpisode,
    onOpenSets, onOpenCharacters, onOpenShowBible, onOpenImport, onOpenAiLab,
    onOpenTemplates, templateCount, onFinalizeEpisode, finalizingEpisodeId,
    className,
  } = props;

  return (
    <nav
      aria-label="Project tree"
      className={clsx(
        "h-full w-full flex-col overflow-y-auto border-neutral-800 bg-neutral-900/40 lg:w-72 lg:shrink-0 lg:border-r",
        className
      )}
    >
      <Section title="Shows" count={shows.length} onAdd={onAddShow} addLabel="New show" empty="No shows yet.">
        {shows.map((s) => (
          <TreeRow
            key={s.id}
            active={s.id === selectedShowId}
            label={s.title}
            onSelect={() => onSelectShow(s.id)}
            onRename={(t) => onRenameShow(s, t)}
            onDelete={() => onDeleteShow(s)}
            deleteTitle="Delete show and everything in it"
          />
        ))}
      </Section>

      <Section
        title="Episodes"
        count={episodes.length}
        onAdd={selectedShowId ? onAddEpisode : undefined}
        addLabel="New episode"
        empty={selectedShowId ? "No episodes in this show." : "Select a show first."}
      >
        {episodes.map((ep) => (
          <TreeRow
            key={ep.id}
            active={ep.id === selectedEpisodeId}
            label={ep.title}
            sub={`E${ep.order}`}
            onSelect={() => onSelectEpisode(ep.id)}
            onRename={(t) => onRenameEpisode(ep, t)}
            onDelete={() => onDeleteEpisode(ep)}
            deleteTitle="Delete episode and its scenes"
            onFinalize={() => onFinalizeEpisode(ep)}
            finalized={!!ep.finalizedAt}
            finalizing={finalizingEpisodeId === ep.id}
          />
        ))}
      </Section>

      <Section
        title="Scenes"
        count={scenes.length}
        onAdd={selectedEpisodeId ? onAddScene : undefined}
        addLabel="New scene"
        empty={selectedEpisodeId ? "No scenes in this episode." : "Select an episode first."}
      >
        {scenes.map((sc) => (
          <TreeRow
            key={sc.id}
            active={sc.id === selectedSceneId}
            label={sc.sceneName || `Scene ${sc.order}`}
            sub={`S${sc.order}`}
            onSelect={() => onSelectScene(sc.id)}
            onDelete={() => onDeleteScene(sc)}
            deleteTitle="Delete scene"
          />
        ))}
      </Section>

      <div className="mt-auto space-y-1 border-t border-neutral-800/70 p-2">
        <span className="block px-1 pb-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">
          Catalog
        </span>
        <Button variant="subtle" size="md" className="w-full justify-start" onClick={onOpenSets}>
          <MapPin size={13} />
          Sets
          <span className="ml-auto font-mono text-[10px] text-neutral-500">{setCount}</span>
        </Button>
        <Button variant="subtle" size="md" className="w-full justify-start" onClick={onOpenCharacters}>
          <Users size={13} />
          Characters
          <span className="ml-auto font-mono text-[10px] text-neutral-500">{characterCount}</span>
        </Button>
        <Button variant="subtle" size="md" className="w-full justify-start" onClick={onOpenTemplates}>
          <Library size={13} />
          Learned Templates
          <span className="ml-auto font-mono text-[10px] text-neutral-500">{templateCount}</span>
        </Button>
        <Button variant="subtle" size="md" className="w-full justify-start" onClick={onOpenShowBible} disabled={!selectedShowId}>
          <BookOpen size={13} />
          Show Bible
        </Button>
        <Button variant="subtle" size="md" className="w-full justify-start" onClick={onOpenAiLab}>
          <FlaskConical size={13} />
          AI Script Lab
        </Button>
        <Button variant="subtle" size="md" className="w-full justify-start" onClick={onOpenImport}>
          <FileUp size={13} />
          Import Bible &amp; Script
        </Button>
      </div>
    </nav>
  );
}
