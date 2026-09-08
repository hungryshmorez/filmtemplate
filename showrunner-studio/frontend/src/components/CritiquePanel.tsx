// CritiquePanel.tsx — AI Script Lab: critique a script (late-night exec
// persona), write a script from just an idea (+ optional show bible), or
// surgically rewrite an existing script. Long generations run as background
// jobs — this panel starts one and polls /api/ai/status/{id}.
import { useEffect, useRef, useState } from "react";
import { FlaskConical, Gavel, PenLine, Scissors, Sparkles } from "lucide-react";
import { Button, CopyButton, Field, Label, Spinner, TextArea, TextInput } from "./ui";
import {
  GENRES,
  getTvEngine,
  getFilmSuite,
  renderTvEngineBrief,
  renderFilmTemplateBrief,
  type Genre,
} from "../lib/storyTemplates";

type LabKind = "critique" | "write" | "rewrite";

interface CritiquePanelProps {
  open: boolean;
  onClose: () => void;
  showTitle: string | null;
  showGenre: string | null;
  showBibleText: string | null;
  currentScriptText: string | null;
}

const TABS: { kind: LabKind; label: string; icon: typeof Gavel }[] = [
  { kind: "critique", label: "Critique", icon: Gavel },
  { kind: "write", label: "Write Script", icon: PenLine },
  { kind: "rewrite", label: "Rewrite", icon: Scissors },
];

const TAB_HINTS: Record<LabKind, string> = {
  critique:
    "Submit a script or series for an overall teardown. A cynical late-night network exec runs the identity test, voice check, stagnation filter and AI-sterility scrub, then rules GREENLIT, PILOT REWRITE or SHELVED.",
  write:
    "No script yet? Give an idea and the Script Creation Engine builds a proper screenplay from it — screenplay format, active verbs, 30% dialogue / 70% action, in medias res.",
  rewrite:
    "Surgical overhaul of an existing script: dialogue de-clutter, felt/saw filter removal, messy detail pass, subtext extraction. Output is the clean script, nothing else.",
};

async function pollJob(jobId: string, maxMs = 10 * 60 * 1000): Promise<string> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`/api/ai/status/${jobId}`);
    if (!res.ok) throw new Error(`Job status request failed (${res.status})`);
    const job = await res.json();
    if (job.status === "done") return job.result?.text ?? "";
    if (job.status === "error") throw new Error(job.error || "The AI job failed.");
  }
  throw new Error("Timed out waiting for the AI to finish (10 min).");
}

export function CritiquePanel({
  open,
  onClose,
  showTitle,
  showGenre,
  showBibleText,
  currentScriptText,
}: CritiquePanelProps) {
  const [kind, setKind] = useState<LabKind>("critique");
  const [critiqueText, setCritiqueText] = useState("");
  const [idea, setIdea] = useState("");
  const [bibleText, setBibleText] = useState("");
  const [rewriteScript, setRewriteScript] = useState("");
  const [rewriteNotes, setRewriteNotes] = useState("");
  const [targetLength, setTargetLength] = useState("full pilot");

  // Story template brainstorm scaffold (Write Script tab only).
  const [templateFormat, setTemplateFormat] = useState<"none" | "tv" | "film">("none");
  const [templateGenre, setTemplateGenre] = useState<Genre>(GENRES[0]);
  const [filmTemplateName, setFilmTemplateName] = useState<string>("");

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  // Pre-fill text areas from the project the first time the panel opens.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (open && !seeded) {
      setSeeded(true);
      if (showBibleText) setBibleText(showBibleText);
      if (currentScriptText) {
        setCritiqueText(currentScriptText);
        setRewriteScript(currentScriptText);
      }
      if (showGenre && (GENRES as string[]).includes(showGenre)) {
        setTemplateGenre(showGenre as Genre);
      }
    }
    if (!open) setSeeded(false);
  }, [open, seeded, showBibleText, currentScriptText, showGenre]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!open) return null;

  const run = async (endpoint: string, body: Record<string, unknown>) => {
    setRunning(true);
    setError(null);
    setOutput(null);
    try {
      const startRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!startRes.ok) {
        const detail = await startRes.json().catch(() => ({}));
        throw new Error(detail?.detail || `Request failed (${startRes.status})`);
      }
      const { job_id } = await startRes.json();
      const text = await pollJob(job_id);
      setOutput(text);
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  };

  const submit = () => {
    if (kind === "critique") {
      if (!critiqueText.trim()) return;
      void run("/api/critique/start", { text: critiqueText, showTitle, genre: showGenre });
    } else if (kind === "write") {
      if (!idea.trim()) return;
      const templateBrief =
        templateFormat === "tv"
          ? renderTvEngineBrief(getTvEngine(templateGenre)!)
          : templateFormat === "film"
            ? renderFilmTemplateBrief(getFilmSuite(templateGenre)!, filmTemplateName || undefined)
            : "";
      const combinedBible = [templateBrief, bibleText.trim()].filter(Boolean).join("\n\n---\n\n");
      void run("/api/write-script/start", {
        idea,
        showBible: combinedBible || null,
        genre: (templateFormat !== "none" ? templateGenre : showGenre) || null,
        targetLength,
      });
    } else {
      if (!rewriteScript.trim()) return;
      void run("/api/rewrite/start", {
        script: rewriteScript,
        notes: rewriteNotes.trim() || null,
        genre: showGenre || null,
      });
    }
  };

  const canSubmit =
    !running &&
    (kind === "critique"
      ? critiqueText.trim().length > 0
      : kind === "write"
        ? idea.trim().length > 0
        : rewriteScript.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-neutral-950 sm:h-[min(92vh,900px)] sm:rounded-xl sm:border sm:border-neutral-800">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <FlaskConical size={16} className="text-amber-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-neutral-100">AI Script Lab</h2>
            {showTitle && <p className="truncate text-[11px] text-neutral-500">{showTitle}</p>}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose} disabled={running}>
            Close
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-800 px-3 py-2">
          {TABS.map(({ kind: k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              disabled={running}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                kind === k
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              }`}
            >
              <Icon size={12} aria-hidden /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-[12px] leading-relaxed text-neutral-500">{TAB_HINTS[kind]}</p>

          {kind === "critique" && (
            <Field label="Script / series text to critique">
              <TextArea
                rows={10}
                value={critiqueText}
                onChange={(e) => setCritiqueText(e.target.value)}
                placeholder="Paste a pilot script or a whole series treatment…"
              />
            </Field>
          )}

          {kind === "write" && (
            <>
              <Field
                label="Story template (optional brainstorm scaffold)"
                hint="Pulled from the Beta Tester Guide's genre engines/act suites. Injected into the show bible sent to the writer — doesn't touch your notes below."
              >
                <div className="flex flex-wrap items-center gap-2">
                  {(["none", "tv", "film"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTemplateFormat(f)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                        templateFormat === f
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {f === "none" && "No template"}
                      {f === "tv" && (
                        <>
                          <Sparkles size={11} aria-hidden /> TV 5-Beat Engine
                        </>
                      )}
                      {f === "film" && (
                        <>
                          <Sparkles size={11} aria-hidden /> Film 3-Act Suite
                        </>
                      )}
                    </button>
                  ))}
                  {templateFormat !== "none" && (
                    <select
                      value={templateGenre}
                      onChange={(e) => {
                        setTemplateGenre(e.target.value as Genre);
                        setFilmTemplateName("");
                      }}
                      className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200"
                    >
                      {GENRES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  )}
                  {templateFormat === "film" && (
                    <select
                      value={filmTemplateName}
                      onChange={(e) => setFilmTemplateName(e.target.value)}
                      className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200"
                    >
                      <option value="">Both templates</option>
                      {getFilmSuite(templateGenre)?.templates.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.arc})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {templateFormat !== "none" && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-400">
                    {templateFormat === "tv"
                      ? renderTvEngineBrief(getTvEngine(templateGenre)!)
                      : renderFilmTemplateBrief(getFilmSuite(templateGenre)!, filmTemplateName || undefined)}
                  </pre>
                )}
              </Field>
              <Field label="Your idea" hint="One line or ten — the engine expands it into a screenplay.">
                <TextArea
                  rows={4}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g. A nostalgia-peddling game show host realizes the contestants are his own memories…"
                />
              </Field>
              <Field
                label="Show Bible (optional)"
                hint="Characters, world and rules the script must stay consistent with."
              >
                <TextArea rows={6} value={bibleText} onChange={(e) => setBibleText(e.target.value)} />
              </Field>
              <Field label="Target length">
                <TextInput value={targetLength} onChange={(e) => setTargetLength(e.target.value)} />
              </Field>
            </>
          )}

          {kind === "rewrite" && (
            <>
              <Field label="Script to overhaul">
                <TextArea
                  rows={10}
                  value={rewriteScript}
                  onChange={(e) => setRewriteScript(e.target.value)}
                  placeholder="Paste the script to be rewritten…"
                />
              </Field>
              <Field label="Extra notes (optional)" hint="e.g. exec critique notes from the Critique tab.">
                <TextArea rows={4} value={rewriteNotes} onChange={(e) => setRewriteNotes(e.target.value)} />
              </Field>
            </>
          )}

          {error && (
            <div className="rounded-md border border-red-800/50 bg-red-950/40 p-2.5 text-[12px] leading-snug text-red-300">
              {error}
            </div>
          )}

          {output && (
            <div ref={outputRef}>
              <div className="flex items-center justify-between">
                <Label>{kind === "critique" ? "Exec verdict" : "Script"}</Label>
                <CopyButton text={output} />
              </div>
              <pre className="mt-1.5 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 font-mono text-[12px] leading-relaxed text-neutral-200">
                {output}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-3">
          {running && (
            <span className="inline-flex items-center gap-2 text-[12px] text-neutral-400">
              <Spinner size={13} /> Working… {elapsed}s elapsed — a full script can take a few minutes.
            </span>
          )}
          <Button variant="primary" size="md" className="ml-auto" onClick={submit} disabled={!canSubmit}>
            {kind === "critique" ? "Submit for critique" : kind === "write" ? "Write script" : "Rewrite script"}
          </Button>
        </div>
      </div>
    </div>
  );
}
