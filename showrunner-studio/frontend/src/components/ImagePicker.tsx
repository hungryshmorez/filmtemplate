// ImagePicker.tsx — Reusable upload control for a single image stored as a
// compressed data URL on an entity (show cover, character portrait, set photo).
// Downscales in-browser via lib/images.ts; no upload/storage backend involved.
import { useRef, useState } from "react";
import clsx from "clsx";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { fileToStoredImage, ImageError } from "../lib/images";
import { Button, Label } from "./ui";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label: string;
  /** "square" for portraits, "wide" (16:9) for covers/set photos. */
  shape?: "square" | "wide";
  hint?: string;
  className?: string;
}

export function ImagePicker({ value, onChange, label, shape = "square", hint, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await fileToStoredImage(file));
    } catch (err) {
      setError(err instanceof ImageError ? err.message : "Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={clsx("space-y-1.5", className)}>
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={pick}
          aria-label={value ? `Replace ${label}` : `Upload ${label}`}
          className={clsx(
            "group relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 transition-colors hover:border-amber-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
            shape === "square" ? "h-20 w-20" : "h-[4.5rem] w-32"
          )}
        >
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-neutral-500 transition-colors group-hover:text-amber-400" aria-hidden />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-neutral-950/70">
              <Loader2 size={18} className="animate-spin text-amber-400" aria-hidden />
            </span>
          )}
        </button>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Button variant="ghost" size="xs" onClick={pick} disabled={busy}>
              <ImagePlus size={12} />
              {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button variant="subtle" size="xs" onClick={() => { setError(null); onChange(undefined); }} disabled={busy}>
                <Trash2 size={12} />
                Remove
              </Button>
            )}
          </div>
          {error ? (
            <p className="text-[11px] leading-snug text-red-400">{error}</p>
          ) : (
            hint && <p className="text-[11px] leading-snug text-neutral-400">{hint}</p>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-hidden tabIndex={-1} />
    </div>
  );
}
