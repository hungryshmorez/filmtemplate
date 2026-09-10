// PromptLibrary.tsx — Generic searchable, copy-ready prompt catalog. Used for
// the Shot Library and the Transition Library. Every entry copies straight into
// your single clip prompt (there is no separate camera/transition field — one
// prompt per 15s clip holds everything).
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CopyButton, Label, Modal, TextInput } from "./ui";

export interface LibraryEntry {
  name: string;
  prompt: string;
}

export interface LibraryCategory {
  title: string;
  blurb: string;
  entries: LibraryEntry[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  categories: LibraryCategory[];
  headerNote?: { label: string; mono?: string; tip?: string };
  searchPlaceholder?: string;
}

export function PromptLibrary({ open, onClose, title, subtitle, categories, headerNote, searchPlaceholder }: Props) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          entries: needle
            ? cat.entries.filter((e) => e.name.toLowerCase().includes(needle) || e.prompt.toLowerCase().includes(needle))
            : cat.entries,
        }))
        .filter((cat) => cat.entries.length > 0),
    [categories, needle]
  );
  const total = filtered.reduce((n, c) => n + c.entries.length, 0);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} wide>
      <div className="space-y-4 p-4">
        {headerNote && (
          <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5">
            <Label>{headerNote.label}</Label>
            {headerNote.mono && <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-300/90">{headerNote.mono}</p>}
            {headerNote.tip && <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">{headerNote.tip}</p>}
          </div>
        )}

        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? "Search…"}
            aria-label={`Search ${title}`}
            className="pl-7"
          />
        </div>

        {total === 0 ? (
          <p className="text-[12.5px] text-neutral-400">No matches for “{query}”.</p>
        ) : (
          filtered.map((cat) => (
            <section key={cat.title} className="space-y-2">
              <div className="border-b border-neutral-800 pb-1">
                <span className="text-[12px] font-semibold text-amber-200">
                  {cat.title} <span className="font-mono text-[10px] font-normal text-neutral-500">({cat.entries.length})</span>
                </span>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">{cat.blurb}</p>
              </div>
              <ul className="space-y-2">
                {cat.entries.map((entry) => (
                  <li key={entry.name} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-neutral-100">{entry.name}</span>
                      <CopyButton text={entry.prompt} label="Copy" size="xs" variant="ghost" className="ml-auto" />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-neutral-400">
                      {entry.prompt}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
