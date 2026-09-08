// TaggedTextarea.tsx — Textarea with @Character / #Set tag autocomplete.
// Typing `@` or `#` (at a word boundary) opens a filtered dropdown of the
// registered names; picking one inserts the exact tag at the cursor.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import clsx from "clsx";
import { AtSign, Hash } from "lucide-react";
import { fieldClass } from "./ui";

export interface TagOption {
  id: string;
  name: string;
}

interface ActiveTag {
  trigger: "@" | "#";
  start: number; // index of the trigger char in `value`
  query: string; // text typed after the trigger, up to the caret
  dismissed: boolean;
}

const MAX_QUERY = 48;

function detectTag(text: string, caret: number): ActiveTag | null {
  const from = Math.max(0, caret - MAX_QUERY);
  const seg = text.slice(from, caret);
  for (let i = seg.length - 1; i >= 0; i--) {
    const ch = seg[i];
    if (ch === "\n") return null;
    if (ch === "@" || ch === "#") {
      const prev = i > 0 ? seg[i - 1] : " ";
      if (!/\s/.test(prev)) return null; // mid-word (e.g. an email) — not a tag
      return { trigger: ch, start: from + i, query: seg.slice(i + 1), dismissed: false };
    }
  }
  return null;
}

interface TaggedTextareaProps {
  value: string;
  onChange: (next: string) => void;
  characters: TagOption[];
  sets: TagOption[];
  placeholder?: string;
  rows?: number;
  className?: string;
  ariaLabel?: string;
}

export function TaggedTextarea({ value, onChange, characters, sets, placeholder, rows = 4, className, ariaLabel }: TaggedTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [tag, setTag] = useState<ActiveTag | null>(null);
  const [highlight, setHighlight] = useState(0);

  const options = tag ? (tag.trigger === "@" ? characters : sets) : [];
  const needle = tag ? tag.query.trim().toLowerCase() : "";
  const matches = options.filter((o) => o.name.toLowerCase().includes(needle)).slice(0, 8);
  const open = tag !== null && !tag.dismissed && matches.length > 0;

  const syncTag = () => {
    const el = ref.current;
    if (!el) return;
    setTag(detectTag(el.value, el.selectionStart ?? el.value.length));
    setHighlight(0);
  };

  const insert = (name: string) => {
    if (!tag) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const token = `${tag.trigger}${name} `;
    const next = value.slice(0, tag.start) + token + value.slice(caret);
    pendingCaret.current = tag.start + token.length;
    setTag(null);
    onChange(next);
  };

  // Restore the caret after inserting a tag (value prop round-trips from Dexie).
  useEffect(() => {
    if (pendingCaret.current == null) return;
    const el = ref.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [value]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insert(matches[highlight]?.name ?? matches[0].name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setTag((t) => (t ? { ...t, dismissed: true } : t));
    }
  };

  return (
    <div className={clsx("relative", className)}>
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setTag(detectTag(e.target.value, e.target.selectionStart ?? e.target.value.length));
          setHighlight(0);
        }}
        onClick={syncTag}
        onKeyDown={handleKeyDown}
        className={clsx(fieldClass, "resize-y")}
      />
      {open && tag && (
        <div className="absolute left-2 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/70">
          <div className="flex items-center gap-1.5 border-b border-neutral-800 px-2.5 py-1.5">
            {tag.trigger === "@" ? <AtSign size={11} className="text-amber-400" /> : <Hash size={11} className="text-amber-400" />}
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-500">
              {tag.trigger === "@" ? "Characters" : "Sets"} — enter to insert · esc to close
            </span>
          </div>
          <ul className="max-h-44 overflow-y-auto py-1">
            {matches.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep textarea focus
                    insert(m.name);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={clsx(
                    "flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px]",
                    i === highlight ? "bg-amber-500/15 text-amber-200" : "text-neutral-300"
                  )}
                >
                  <span className="font-mono text-amber-400">{tag.trigger}</span>
                  <span className="truncate">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
