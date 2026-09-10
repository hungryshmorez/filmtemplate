// ShotLibrary.tsx — Browsable, searchable camera-move catalog. Every formula is
// copy-ready to paste into a scene's Action (Showrunner) or the Seedance
// CAMERA MOTION field.
import { useMemo, useState } from "react";
import { Camera, Search } from "lucide-react";
import { SHOT_FORMULA, SHOT_LIBRARY } from "../lib/cameraShots";
import { CopyButton, Label, Modal, TextInput } from "./ui";

export function ShotLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const categories = useMemo(
    () =>
      SHOT_LIBRARY.map((cat) => ({
        ...cat,
        shots: needle
          ? cat.shots.filter((s) => s.name.toLowerCase().includes(needle) || s.formula.toLowerCase().includes(needle))
          : cat.shots,
      })).filter((cat) => cat.shots.length > 0),
    [needle]
  );

  const total = categories.reduce((n, c) => n + c.shots.length, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shot Library"
      subtitle="Camera-move formulas — copy one into a scene's Action or the Seedance CAMERA MOTION field."
      wide
    >
      <div className="space-y-4 p-4">
        <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5">
          <Label>Professional formula</Label>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-300/90">{SHOT_FORMULA}</p>
          <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">
            Tip: keep a character consistent by injecting your Character Sheet anchor into the image-reference slot for
            every generation.
          </p>
        </div>

        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shots — e.g. dolly, orbit, whip, saccade…"
            aria-label="Search shots"
            className="pl-7"
          />
        </div>

        {total === 0 ? (
          <p className="text-[12.5px] text-neutral-400">No shots match “{query}”.</p>
        ) : (
          categories.map((cat) => (
            <section key={cat.title} className="space-y-2">
              <div className="border-b border-neutral-800 pb-1">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-200">
                  <Camera size={12} aria-hidden /> {cat.title}
                  <span className="font-mono text-[10px] font-normal text-neutral-500">({cat.shots.length})</span>
                </span>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">{cat.blurb}</p>
              </div>
              <ul className="space-y-2">
                {cat.shots.map((shot) => (
                  <li key={shot.name} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-neutral-100">{shot.name}</span>
                      <CopyButton text={shot.formula} label="Copy" size="xs" variant="ghost" className="ml-auto" />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-neutral-400">
                      {shot.formula}
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
