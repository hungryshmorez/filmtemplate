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
import { renderLearnedTemplateBrief } from "../lib/templateLearning";
import { toProviderConfig } from "../lib/providerSettings";
import type { LearnedTemplate } from "../types";

type LabKind = "critique" | "write" | "rewrite";

interface CritiquePanelProps {
  open: boolean;
  onClose: () => void;
  showTitle: string | null;
  showGenre: string | null;
  showBibleText: string | null;
  currentScriptText: string | null;
  learnedTemplates: LearnedTemplate[];
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
  learnedTemplates,
}: CritiquePanelProps) {
  const [kind, setKind] = useState<LabKind>("critique");
  const [critiqueText, setCritiqueText] = useState("");
  const [idea, setIdea] = useState("");
  const [bibleText, setBibleText] = useState("");
  const [rewriteScript, setRewriteScript] = useState("");
  const [rewriteNotes, setRewriteNotes] = useState("");
  const [targetLength, setTargetLength] = useState("full pilot");

  // Story template brainstorm scaffold (Write Script tab only).
  const [templateFormat, setTemplateFormat] = useState<"none" | "tv" | "film" | "learned">("none");
  const [templateGenre, setTemplateGenre] = useState<Genre>(GENRES[0]);
  const [filmTemplateName, setFilmTemplateName] = useState<string>("");
  const [learnedTemplateId, setLearnedTemplateId] = useState<string>("");
  const [learnedAllGenres, setLearnedAllGenres] = useState(false);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  // Recursive write -> critique -> rewrite loop (Write tab).
  const [loopStage, setLoopStage] = useState<"idle" | "writing" | "critiquing" | "rewriting">("idle");
  const [loopCritique, setLoopCritique] = useState<string | null>(null);
  const [passes, setPasses] = useState(1);

  // Learned templates offered as Write-Script scaffolding, filtered to the
  // selected genre alongside the standard templates (Section 4).
  const learnedForGenre = learnedAllGenres
    ? learnedTemplates
    : learnedTemplates.filter((t) => t.genre === templateGenre);
  const effectiveLearnedId = learnedForGenre.some((t) => t.id === learnedTemplateId)
    ? learnedTemplateId
    : learnedForGenre[0]?.id ?? "";

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
      if (learnedTemplates.length) setLearnedTemplateId(learnedTemplates[0].id);
    }
    if (!open) setSeeded(false);
  }, [open, seeded, showBibleText, currentScriptText, showGenre, learnedTemplates]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!open) return null;

  // Start one background job and resolve its text (used by both the single-tab
  // runs and the recursive loop).
  const startAndPoll = async (endpoint: string, body: Record<string, unknown>): Promise<string> => {
    const startRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, provider: toProviderConfig() }),
    });
    if (!startRes.ok) {
      const detail = await startRes.json().catch(() => ({}));
      throw new Error(detail?.detail || `Request failed (${startRes.status})`);
    }
    const { job_id } = await startRes.json();
    return pollJob(job_id);
  };

  const run = async (endpoint: string, body: Record<string, unknown>) => {
    setRunning(true);
    setError(null);
    setOutput(null);
    try {
      const text = await startAndPoll(endpoint, body);
      setOutput(text);
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  };

  // --- Write-Script request builders (shared by single-run and the loop) ---
  const buildTemplateBrief = (): string => {
    if (templateFormat === "tv") return renderTvEngineBrief(getTvEngine(templateGenre)!);
    if (templateFormat === "film") return renderFilmTemplateBrief(getFilmSuite(templateGenre)!, filmTemplateName || undefined);
    if (templateFormat === "learned") {
      const t = learnedTemplates.find((lt) => lt.id === effectiveLearnedId);
      return t ? renderLearnedTemplateBrief(t) : "";
    }
    return "";
  };

  const resolveWriteGenre = (): string | null =>
    (templateFormat === "learned"
      ? learnedTemplates.find((lt) => lt.id === effectiveLearnedId)?.genre
      : templateFormat !== "none"
        ? templateGenre
        : showGenre) || null;

  const buildWriteBody = () => {
    const combinedBible = [buildTemplateBrief(), bibleText.trim()].filter(Boolean).join("\n\n---\n\n");
    return {
      idea,
      showBible: combinedBible || null,
      genre: resolveWriteGenre(),
      targetLength,
    };
  };

  const submit = () => {
    if (kind === "critique") {
      if (!critiqueText.trim()) return;
      void run("/api/critique/start", { text: critiqueText, showTitle, genre: showGenre });
    } else if (kind === "write") {
      if (!idea.trim()) return;
      void run("/api/write-script/start", buildWriteBody());
    } else {
      if (!rewriteScript.trim()) return;
      void run("/api/rewrite/start", {
        script: rewriteScript,
        notes: rewriteNotes.trim() || null,
        genre: showGenre || null,
      });
    }
  };

  // --- Recursive loop: write -> (critique -> rewrite) x passes -> polished ---
  const runLoop = async () => {
    if (!idea.trim() || running) return;
    const genre = resolveWriteGenre();
    setRunning(true);
    setError(null);
    setOutput(null);
    setLoopCritique(null);
    try {
      setLoopStage("writing");
      let draft = await startAndPoll("/api/write-script/start", buildWriteBody());

      let lastCritique = "";
      for (let i = 0; i < passes; i++) {
        setLoopStage("critiquing");
        lastCritique = await startAndPoll("/api/critique/start", { text: draft, showTitle, genre });
        setLoopCritique(lastCritique);

        setLoopStage("rewriting");
        draft = await startAndPoll("/api/rewrite/start", { script: draft, notes: lastCritique, genre });
      }

      // Leave the pieces in the manual tabs too, so the writer can keep iterating.
      setRewriteScript(draft);
      setCritiqueText(draft);
      setOutput(draft);
      setKind("rewrite");
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The loop failed.");
    } finally {
      setLoopStage("idle");
      setRunning(false);
    }
  };

  const canSubmit =
    !running &&
    (kind === "critique"
      ? critiqueText.trim().length > 0
      : kind === "write"
        ? idea.trim().length > 0
        : rewriteScript.trim().length > 0);

  // --- Cross-tab chaining: write -> critique -> rewrite -> critique ... ---
  const sendOutputToCritique = () => {
    if (!output) return;
    setCritiqueText(output);
    setOutput(null);
    setError(null);
    setKind("critique");
  };

  const sendOutputToRewrite = () => {
    if (!output) return;
    // From "write": the freshly written script becomes the thing to rewrite.
    // From "critique": the ORIGINAL script (still sitting in critiqueText)
    // is what gets rewritten, with the verdict fed in as exec notes.
    if (kind === "critique") {
      setRewriteScript(critiqueText);
      setRewriteNotes(output);
    } else {
      setRewriteScript(output);
    }
    setOutput(null);
    setError(null);
    setKind("rewrite");
  };

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
                  {(["none", "tv", "film", "learned"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTemplateFormat(f)}
                      disabled={f === "learned" && learnedTemplates.length === 0}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
                      {f === "learned" && (
                        <>
                          <Sparkles size={11} aria-hidden /> Learned ({learnedTemplates.length})
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
                      disabled={templateFormat === "learned" && learnedAllGenres}
                      className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200 disabled:opacity-40"
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
                  {templateFormat === "learned" && (
                    <>
                      <select
                        value={effectiveLearnedId}
                        onChange={(e) => setLearnedTemplateId(e.target.value)}
                        disabled={learnedForGenre.length === 0}
                        className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200 disabled:opacity-40"
                      >
                        {learnedForGenre.length === 0 && <option value="">No {templateGenre} templates learned</option>}
                        {learnedForGenre.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.genre})
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-neutral-400">
                        <input
                          type="checkbox"
                          checked={learnedAllGenres}
                          onChange={(e) => setLearnedAllGenres(e.target.checked)}
                          className="size-3.5 accent-amber-500"
                        />
                        All genres
                      </label>
                    </>
                  )}
                </div>
                {templateFormat !== "none" && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-400">
                    {templateFormat === "tv"
                      ? renderTvEngineBrief(getTvEngine(templateGenre)!)
                      : templateFormat === "film"
                        ? renderFilmTemplateBrief(getFilmSuite(templateGenre)!, filmTemplateName || undefined)
                        : (() => {
                            const t = learnedTemplates.find((lt) => lt.id === effectiveLearnedId);
                            return t
                              ? renderLearnedTemplateBrief(t)
                              : `No ${learnedAllGenres ? "" : `${templateGenre} `}learned templates yet — finalize an episode in this genre first.`;
                          })()}
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

              {/* Recursive Write -> Critique -> Rewrite loop (Section 4). */}
              <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="inline-flex items-center gap-1.5">
                    <Sparkles size={11} aria-hidden /> Auto-polish loop
                  </Label>
                  <span className="text-[11.5px] text-neutral-400">Write → critique → rewrite, automatically.</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-[12px] text-neutral-300">
                    Critique/rewrite passes
                    <select
                      value={passes}
                      onChange={(e) => setPasses(Number(e.target.value))}
                      disabled={running}
                      className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200 disabled:opacity-40"
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button variant="primary" size="md" onClick={() => void runLoop()} disabled={running || idea.trim().length === 0}>
                    {loopStage !== "idle" ? <Spinner size={13} /> : <Sparkles size={13} />}
                    {loopStage === "idle"
                      ? "Run full loop"
                      : loopStage === "writing"
                        ? "Writing draft…"
                        : loopStage === "critiquing"
                          ? "Running critique…"
                          : "Applying rewrite…"}
                  </Button>
                </div>
                <p className="text-[11px] leading-snug text-neutral-500">
                  Generates a draft from your idea (with the template + bible above), runs it through the genre-aware
                  exec critique, then feeds those notes into the surgical rewrite — repeated for each pass. The polished
                  draft lands below and in the Rewrite tab.
                </p>
              </div>
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

          {loopCritique && (
            <details className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <summary className="cursor-pointer text-[12px] font-medium text-amber-300">
                Loop critique notes (fed into the rewrite)
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-neutral-400">
                {loopCritique}
              </pre>
            </details>
          )}

          {output && (
            <div ref={outputRef}>
              <div className="flex items-center justify-between">
                <Label>{kind === "critique" ? "Exec verdict" : "Script"}</Label>
                <div className="flex items-center gap-2">
                  {kind !== "critique" && (
                    <Button variant="ghost" size="sm" onClick={sendOutputToCritique}>
                      Send to Critique
                    </Button>
                  )}
                  {kind !== "rewrite" && (
                    <Button variant="ghost" size="sm" onClick={sendOutputToRewrite}>
                      {kind === "critique" ? "Send to Rewrite (with notes)" : "Send to Rewrite"}
                    </Button>
                  )}
                  <CopyButton text={output} />
                </div>
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
              <Spinner size={13} />
              {loopStage === "idle"
                ? `Working… ${elapsed}s elapsed — a full script can take a few minutes.`
                : `Loop: ${loopStage}… ${elapsed}s elapsed — each stage is a full generation.`}
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
