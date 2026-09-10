# Show-Writer Studio — The Encyclopedia

The complete reference for what Show-Writer Studio is, what it does, how it
does it, and why it's built the way it is. If the README is the postcard, this
is the map.

> **A note on names.** The product is **Show-Writer Studio**. You will still see
> the word *Showrunner* in three places, and none of them are the old product
> name:
> - the project folder `showrunner-studio/` (an internal path),
> - the local database named `showrunner-studio` (kept so existing saved
>   projects aren't lost), and
> - the **"Showrunner" export format** — one of three output styles, a *format*
>   choice, not a brand.
>
> Everything a user sees as the app's identity — the title bar, the browser
> tab, the welcome screen, exported filenames — says "Show-Writer Studio".

---

## Table of contents

1. [What it is, in one paragraph](#1-what-it-is-in-one-paragraph)
2. [The philosophy: why it exists](#2-the-philosophy-why-it-exists)
3. [Core vocabulary](#3-core-vocabulary)
4. [The generation laws (invariants)](#4-the-generation-laws-invariants)
5. [Architecture at a glance](#5-architecture-at-a-glance)
6. [The data model & local-first storage](#6-the-data-model--local-first-storage)
7. [The three output formats](#7-the-three-output-formats)
8. [Feature reference](#8-feature-reference)
9. [The AI system prompts (personas)](#9-the-ai-system-prompts-personas)
10. [The genre system](#10-the-genre-system)
11. [Multi-provider bring-your-own-key](#11-multi-provider-bring-your-own-key)
12. [Backend API reference](#12-backend-api-reference)
13. [UX & accessibility decisions (and one famous gotcha)](#13-ux--accessibility-decisions-and-one-famous-gotcha)
14. [Running, configuring & deploying](#14-running-configuring--deploying)
15. [Glossary](#15-glossary)
16. [FAQ — the "why" behind the choices](#16-faq--the-why-behind-the-choices)

---

## 1. What it is, in one paragraph

Show-Writer Studio is a **local-first writers' room** for people making
AI-generated video. You build a show bible (premise, world rules, look),
register your recurring **sets** and **characters** as reusable tags, outline
**scenes**, and then compile everything into **copy-ready generation prompts**
that a text-to-video model can consume. It speaks three output "dialects,"
knows the hard physical limits of today's video generators (clips are short,
casts must stay consistent, dialogue has to fit real time), and enforces those
limits for you so the prompts you hand a model actually produce usable footage.
Everything lives in your browser; nothing is uploaded unless you ask the app to
call an AI provider.

## 2. The philosophy: why it exists

AI video models don't fail because a prompt is un-cinematic — they fail because
a prompt ignores the medium's constraints. A single generation is only a few
seconds long. Characters drift between generations. Ask for four people talking
for a minute and you get four strangers mumbling for six seconds. Show-Writer
Studio is built around three convictions:

1. **Constraints are content.** The 15-second clip, the locked cast, the
   ~25-word dialogue budget aren't annoyances to route around — they're the
   grammar of the medium. The app bakes them into every export so you can't
   accidentally write something un-generatable.
2. **Structure beats vibes.** A show is a machine for generating stories, not a
   mood board. The app is organized around reusable structure (sets,
   characters, story engines, act/beat templates) and around *causality* — the
   "therefore / but" rule that every beat must be caused by the last.
3. **Your work is yours.** It's local-first. Your bible and scripts sit in your
   browser's IndexedDB. AI is optional and pluggable — bring your own key, or
   point it at a model running on your own machine.

## 3. Core vocabulary

**Project types**

- **Show (series)** — the default. A TV series: **Show → Episodes → Scenes.**
- **Movie** — a top-level type whose *canonical* structure is **act-based**:
  **Movie → Acts → Beats**, not an episode list. (See
  [Movies](#movies--the-act-based-type).)

**Building blocks**

- **Show Bible** — the show's `premise`: world rules, lore, visual style,
  broadcast/glitch aesthetics. It's injected into every AI call.
- **Set** — a location in the catalog, referenced in prose as `#SetName`. Holds
  time-of-day and a physical/atmosphere/ambient-audio description.
- **Character** — a cast member in the catalog, referenced as `@CharacterName`.
  Holds role (Protagonist/Antagonist/Supporting), age, gender, a **visual
  description** and a **voice description** (timbre, dialect, processing).
- **Scene** — the atomic unit of writing inside an episode: a name, one target
  set, up to a few active characters, an **action** block (cinematic prose +
  camera language), and an ordered **dialogue** list.

**Generation units** (how a scene becomes footage)

- **Clip** — a single generation, fixed at **15 seconds**. This is the hard cap
  per call.
- **Take** — a chain of up to **4 clips**: 1 *regular* generation + up to 3
  *extensions*, for a maximum of **60 seconds** of continuous footage. The cast
  is **locked** for the whole take.
- **Segment** — a clip's position inside its take: segment 0 = the regular
  generation, segments 1–3 = extensions.
- **Transition** — the explicitly written cut between one take and the next
  (hard cut, cut to black, dissolve, whip pan, match cut, push-through).
- **Character DNA** — a stable key derived from a character (e.g.
  `DNA_CUSTARD_CURATOR`) that the Seedance format restates in every shot so the
  model keeps the character looking the same across standalone generations.

## 4. The generation laws (invariants)

These are enforced by the deterministic engines *and* asked of the AI in every
system prompt. They come straight from the constraints of real AI-video
pipelines and from the user's production rules:

| Law | Value | Why |
|---|---|---|
| **Clip length** | fixed **15 s** | The hard per-generation cap. |
| **Take size** | 1 regular + **≤ 3 extensions** = ≤ 4 clips / **60 s** | Extensions chain off the prior clip; beyond 4 they drift. |
| **Cast lock** | cast is fixed for the whole take | An extension may never add or drop a character. |
| **Cast size** | **≤ 3 characters** per take | More than three and models lose identity/blocking. |
| **Set** | exactly **1 set** per take | One coherent space per continuous take. |
| **Dialogue pacing** | **~25 spoken words** per 15 s (~2 words/sec) | More reads as rushed/garbled on screen. |
| **Every take boundary** | gets an explicit written **transition** | So stitched takes actually flow. |
| **Causality** | the **"therefore / but"** rule | Beats must be caused by the last, never "and then." |

Constants live in `frontend/src/lib/showrunnerFormat.ts`:
`CLIP_SECONDS = 15`, `MAX_EXTENSIONS_PER_TAKE = 3`,
`MAX_SEGMENTS_PER_TAKE = 4`, `MAX_TAKE_SECONDS = 60`, `MAX_CAST_PER_TAKE = 3`,
`MAX_DIALOGUE_WORDS_PER_CLIP = 25`.

### The causality law ("therefore / but")

Borrowed from Trey Parker & Matt Stone: if you can describe your story as "this
happens **and then** this happens," it's broken. Each beat must be a direct
**consequence** of the previous one (an implied *"therefore…"*) or a
**complication** that derails the expected path (an implied *"but…"*). This rule
is appended verbatim (`CAUSALITY_RULE` in `backend/main.py`) to *every*
generative system prompt — scene generation, script writing, surgical rewrite,
the reference/broadcast prompt engine, and the crossover engine — and the
critique persona has a dedicated audit step that hunts for "and then" seams and
docks the script for them.

## 5. Architecture at a glance

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  React 19 + TypeScript + Vite + Tailwind                             │
│                                                                      │
│  UI (App.tsx shell, three-pane layout)                               │
│    ├─ Sidebar (project tree + catalog + libraries)                   │
│    ├─ Center workspace (Scene editor / Episode engine / Movie)       │
│    └─ Right rail (Showrunner / Seedance / AI Scene panels)           │
│                                                                      │
│  Deterministic engines (no network):                                 │
│    showrunnerFormat.ts · seedanceExport.ts · movies.ts               │
│                                                                      │
│  Local-first storage: Dexie (IndexedDB) ── db.ts / actions.ts        │
│  Provider config: localStorage ── providerSettings.ts                │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  fetch (start + poll jobs)
                                 ▼
┌────────────────────────── FastAPI backend ──────────────────────────┐
│  main:app  (uvicorn)                                                 │
│  Multi-provider LLM dispatch: llm_generate(cfg, system, user, ...)   │
│    google (Gemini) · anthropic · openai · openai_compatible/local    │
│  Long calls run as background-thread jobs (start → poll status)      │
└──────────────────────────────────────────────────────────────────────┘
```

**Two kinds of "generation."** The **deterministic engines** (Showrunner &
Seedance formats) run entirely offline in the browser — they *parse and
restructure* what you already wrote into a strict clip/take format. The **AI
features** (scene generation, script lab, reference prompts, crossover, template
learning, bible import) call the backend, which routes to whichever LLM provider
you configured.

**Why the job pattern.** LLM calls can take a while; a reverse proxy will often
kill a request that runs longer than ~30–60 s. So every heavy endpoint is split
into `POST …/start` (returns a `job_id`, work runs on a daemon thread) and
`GET …/status/{job_id}` (poll until `done`/`error`). In-memory job dicts are
bounded (`_evict_jobs`) so uptime doesn't leak memory.

## 6. The data model & local-first storage

All persistent state is in **IndexedDB via Dexie** (`frontend/src/lib/db.ts`),
in a database named `showrunner-studio`. Every write goes through
`frontend/src/lib/actions.ts` so timestamps, ids, and cascade rules stay
consistent, and the UI reads through Dexie's `useLiveQuery` so it updates the
instant the data changes.

**Tables**

| Table | Holds |
|---|---|
| `shows` | Show/Movie metadata: title, genre, premise, `kind`, movie `acts` |
| `sets` | Locations (`#tags`) scoped to a show |
| `characters` | Cast (`@tags`) scoped to a show, with visual + voice DNA |
| `episodes` | Episodes within a series, ordered, with a `finalizedAt` flag |
| `scenes` | Scenes within an episode: action, dialogue, set + cast links |
| `learnedTemplates` | Reusable templates *stripped from finalized episodes* |
| `episodePromptRuns` | Saved Episode-Prompt-Engine outputs (per-scene cards) |
| `crossovers` | Generated crossover episodes |

**Schema versions.** Dexie migrations are additive: v1/v2 establish the base
tables + `learnedTemplates`; **v3** adds `episodePromptRuns` (so generated
prompts survive reloads); **v4** adds `crossovers`. Old rows without newer
fields (e.g. a v1 show with no `kind`) are treated as sensible defaults
(`kind` undefined ⇒ "series").

**Cascade rules** (in `actions.ts`, so nothing is ever orphaned):

- Delete a **show** → deletes its episodes, those episodes' scenes, its sets,
  characters, learned templates, and prompt runs.
- Delete an **episode** → deletes its scenes and its prompt runs.
- Delete a **set** → nulls `targetSetId` on any scene that used it.
- Delete a **character** → removes them from every scene's active cast *and*
  strips their dialogue lines.

**Export / import.** The top bar exports a full **`ProjectSnapshot`** as JSON
(`show-writer-studio-YYYY-MM-DD.json`) covering every table, and imports it back
in **merge** or **replace** mode inside one transaction. This is the backup and
device-transfer story for a local-first app. (Older exports named
`showrunner-studio-*.json` still import fine — validation is by content, not
filename.)

## 7. The three output formats

A scene or episode can be rendered three ways. The **Reference/Broadcast**
format is the primary, model-facing output; the other two are deterministic
structured breakdowns for pipelines that want them.

### 7a. Reference / "Broadcast (15s)" — the primary format

**One self-contained prompt per 15 seconds**, produced by the AI
(`REFERENCE_PROMPT_SYSTEM` in the backend). Each prompt object has exactly three
fields:

- **`scene`** — one rich sentence: mood + location/set + lighting/color palette
  + atmosphere.
- **`dialogue`** — array of `{ character, delivery, line }`; empty if silent.
- **`action`** — the cinematic staging in active verbs, **including the camera
  movement/shot type and the transition into or out of this clip.**

> **There is no separate camera field and no separate transition field.**
> Everything a video model needs — camera moves, lens, shot framing, the
> transition, and character-consistency cues — is folded **into the Action**
> (and, for mood, the Scene). One prompt per clip holds all of it. This is a
> deliberate, load-bearing decision: the whole app's copy, the Shot Library, and
> the Transition Library all point the user to paste into the Action.

The Episode Prompt Engine and the Crossover Studio both emit this format.

### 7b. Showrunner format — deterministic clip blocks

`frontend/src/lib/showrunnerFormat.ts` parses a scene's action into
**clip blocks grouped into takes**, offline. It splits the action into
paragraphs (one clip each), distributes the dialogue proportionally across
clips, locks the cast to the first 3 active characters, picks a shot framing by
keyword (`Wide shot:`, `Close-up:`, `Push-in:`…), labels each clip regular vs.
extension, writes an explicit **TRANSITION** block at every take boundary, and
emits **cast warnings** (when >3 characters had to be dropped) and **pacing
warnings** (when a clip's dialogue exceeds ~25 words). Rendered as readable
`=== TAKE n ===` text.

### 7c. Seedance format — motion-decoupled shot batches

`frontend/src/lib/seedanceExport.ts` targets Seedance-style pipelines that want
**subject motion decoupled from camera motion**. Per shot it separates camera
sentences from action sentences by keyword heuristics, restates the
**surroundings** every shot (each 15 s call is standalone), carries a
**character DNA** map so identities stay stable, splits audio into
speech/ambient/SFX/voice-profiles, tags each shot `@Char #Set`, and records
aspect ratio + fps (24). Same take/cast/transition/pacing rules as Showrunner.

## 8. Feature reference

### The shell & the three panes

`App.tsx` renders a **locked-viewport** three-pane layout: a left **Sidebar**
(project tree + catalog), a center **workspace**, and a right **rail**. The
window itself never scrolls; each pane scrolls independently. Below the `lg`
breakpoint the three panes collapse into a **Project / Editor / Output** switcher
so phones show one full-height pane at a time.

### Workspace modes (the top-bar toggle)

A single top-bar toggle drives what you see. The three scene modes keep their
panels mounted so in-progress drafts survive switching:

- **Episode** — takes over the center with the Episode Prompt Engine.
- **Showrunner** — right rail shows the deterministic Showrunner blocks.
- **Seedance** — right rail shows the deterministic Seedance batch.
- **AI Scene** — right rail is the AI scene generator.

### Scene editor

The center editor for a scene: name, target **set** picker, **cast** chips
(with **proactive 3-character enforcement** — extra chips disable with a
"Take limit reached (3/3)" badge), the **action** textarea, and the ordered
**dialogue** list. Sets and characters are inserted as `#`/`@` tags via a
tagging textarea.

### Episode Prompt Engine

Compiles a whole episode into **per-scene, copy-ready prompt cards**, persisted
as an `episodePromptRun` in Dexie so they survive reloads and episode switches.
Cards can be regenerated one at a time from their source scene's current state,
and the whole run can be copied at once. It offers all three formats; for the
Reference format it adds an **episode-length selector**:

| Band | Runtime | Target prompts |
|---|---|---|
| **Short** | 1–3 min | ~4–12 |
| **Medium** | 8–12 min | ~32–48 |
| **Large** | 20–24 min | ~80–96 |

When a script needs *more* clips than the band's cap, there's a **free
generation** escape: uncapped, "produce exactly as many 15-second prompts as the
script needs, end to end." (`LENGTH_BANDS` + the `free` flag.)

### AI Scene generator

Give it a scene concept; it drafts action + dialogue mapped straight into the
scene schema (using the bible, the chosen set, and the chosen ≤3 characters). On
apply it drops any hallucinated character ids and slices the cast to 3.

### AI Script Lab — the write → critique → rewrite loop

The lab runs three AI personas (see [§9](#9-the-ai-system-prompts-personas))
and can chain them into a **recursive auto-polish loop**: *write* a screenplay
from an idea → *critique* it like a network exec → *surgically rewrite* it → and
repeat for 1–3 passes, with per-stage progress and collapsible critique notes.
Learned templates can be browsed/selected **filtered by genre** to seed the
writing step.

### Template learning — "learn from what you ship"

When you **finalize** an episode (the ✨ on its sidebar row), the app sends the
episode's full text to the extraction model, which strips out a **genre-agnostic
reusable template** (name, format, concept, mechanics, beats) and saves it to the
`learnedTemplates` library for that show. This is distinct from the static seed
library — the template library *grows* from what you actually produce.

### Story templates (the seed library)

`frontend/src/lib/storyTemplates.ts` ships a curated library across **14
genres** — for TV, 5-beat "story engines" plus episodic/serialized templates
(TV must sustain a plot engine week to week); for film, **3-act suites**. These
seed the blank page: they scaffold the "Write Script" step per genre and
scaffold a movie's acts/beats.

### Movies — the act-based type

A Movie's canonical structure is **Acts → Beats** (a blank 3-act skeleton by
default, or scaffolded from a film template), edited in a dedicated
**MovieWorkspace** — *not* an episode list. But you can derive an **Episode
Split**: `splitIntoEpisodes()` flattens the beats in act order and partitions
them into N roughly-even, order-preserving episode-sized chunks (each beat tagged
with its source act) purely for generation planning. The split is derived and
copy-out only; it never mutates the canonical acts.

### Crossover Studio

Bridges **two shows** into a single cohesive episode. It assembles both shows'
bibles (premise + characters + sets), sends them with a crossover premise, tone,
and scene count, and gets back a titled, multi-scene episode **in the Reference
15s format** — same single-prompt-per-clip shape, same ≤3-cast / ~25-word /
camera-and-transitions-in-the-Action rules, same causality law. Results are
persisted to the `crossovers` table.

### Shot Library

A searchable, copy-ready catalog of camera moves (`cameraShots.ts`): the full
directory of pans/tilts, zoom/lens moves, dolly/track, physical moves, human
camera, drone/crane, specials, focus/lens tricks, and locked-frame
micro-motions, headed by a `[Shot size] + [Angle] + [Move] + …` formula. Every
entry copies **into a clip's Action** (camera lives in the Action, not a
separate field).

### Transition Library

A companion catalog (`transitions.ts`): the six built-in **take transitions**
(hard cut, cut to black, dissolve, whip pan, match cut, push-through) plus eight
**single-take world-swaps** (continuous in-camera transitions — a palm wipe, a
flame passage, a rain sheet, a whip, a ridge crest, a tunnel exit…). These also
copy **into the Action** — the transition into/out of a clip is part of the one
prompt. Both libraries share one generic `PromptLibrary` component.

### Import Bible & Script

Upload a raw show bible and/or script (text extracted server-side); the import
parser breaks it into the app's schema — shows, sets, characters, episodes,
scenes — so you can start from existing material instead of retyping it.

### Settings — bring your own key

Pick your LLM provider and enter a key / model / base URL (see
[§11](#11-multi-provider-bring-your-own-key)). Stored in `localStorage`, sent
with every AI request.

### Catalog modals

Sets and Characters are managed in a responsive 40/60 modal with independent
internal scroll; character chips cluster by role with a quick filter.

### Reference images (covers, portraits, set photos)

Shows get a **cover image**, characters a **portrait**, and sets a **reference
photo** — uploaded in their respective editors (Show Bible, Characters, Sets).
Because the app is local-first with no storage backend, an upload is
**downscaled in the browser** (`lib/images.ts` — ≤512px longest edge, encoded as
WebP or JPEG at ~0.82 quality) and stored as a compressed **data URL directly on
the entity** (`ShowMeta.coverImage`, `CharacterEntity.portrait`,
`SetEntity.image`). That means no schema or index change was needed and the
images **ride along in the JSON project export/import** automatically. The
reusable `ImagePicker` control handles upload/replace/remove with a live
preview, and the catalog list rows show thumbnails.

## 9. The AI system prompts (personas)

The backend's craft lives in a handful of carefully written system prompts. They
are genre-agnostic on purpose (craft fundamentals apply everywhere) and get a
short **genre-focus block** appended at call time.

- **`SYSTEM_INSTRUCTIONS`** (scene generation) — "AI Script Supervisor & Clip
  Director." Forces atomic 5–15 s clips, blank-line-separated shots, camera
  language woven into action prose, only registered names, strict JSON out.
- **`REFERENCE_PROMPT_SYSTEM`** (Broadcast/Reference) — "Broadcast Prompt
  Director." One prompt per 15 s, ≤3 cast, ~25 words, **all cinematic detail
  folded into Scene/Dialogue/Action** (no separate camera/transition field),
  causality-chained.
- **`CRITIQUE_SYSTEM_PROMPT`** — "veteran Adult Swim network executive." Runs a
  5-part framework (Identity, Voice/Dialogue, Stagnation, AI-Sterility scrub
  with a banned-word list, **Causality audit**) and ends on a verdict:
  **GREENLIT | PILOT REWRITE | SHELVED**.
- **`SCRIPT_ENGINE_SYSTEM_PROMPT`** — the "Script Creation Engine." Standard
  screenplay format, AI-tell word ban, active-verb mandate, 30% dialogue / 70%
  action, in-medias-res, subtext-or-death, characters over plot.
- **`SURGICAL_SYSTEM_PROMPT`** — the "Surgical Overhaul." Five line-by-line
  operations: dialogue de-clutter, felt/saw-filter removal, messy-detail pass,
  subtext extraction, **causality repair** — without adding new plot.
- **`TEMPLATE_EXTRACTION_SYSTEM_PROMPT`** — strips a reusable template out of a
  finished episode.
- **`IMPORT_SYSTEM_INSTRUCTIONS`** — breaks a raw bible/script into the schema.
- **`CROSSOVER_SYSTEM`** — collides two bibles into one Reference-format episode.

Every generative prompt above ends with the shared **`CAUSALITY_RULE`**.

## 10. The genre system

Fourteen genres: **Comedy, Sitcom, Drama, Reality TV, Sci-Fi, Anime, Fantasy,
Family, Western, Crime, Action & Adventure, Romance, Horror, Live Action.**

They aren't cosmetic. `GENRE_NOTES` in the backend holds a craft brief per
genre (what the genre's *engine* is, what to reward, what to flag), and
`genre_focus_block()` appends the matching brief as a **GENRE FOCUS** block to
whichever persona is running — so the same exec/writer/surgeon judges, writes,
and rewrites with the right instincts (joke density for Comedy, slow-burn
internal stakes for Drama, consistent world-rule costs for Fantasy, dread-pacing
ratios for Horror, and so on). In the UI, learned templates and the writing step
can be filtered to a genre, with an "All genres" fallback.

## 11. Multi-provider bring-your-own-key

Any AI feature can run on the provider you choose. Config
(`frontend/src/lib/providerSettings.ts`) is stored in `localStorage` under
`showrunner.provider.v1` and sent as a `provider` object with every request.

| Provider | Value | Needs |
|---|---|---|
| Google (Gemini) | `google` | key optional (falls back to a server env key) |
| Anthropic (Claude) | `anthropic` | your API key |
| OpenAI (ChatGPT) | `openai` | your API key |
| Local / OpenAI-compatible | `openai_compatible` | a **Base URL** (Ollama, LM Studio, vLLM, OpenRouter…) |

The backend's `llm_generate(cfg, system, user, max_tokens)` routes to the right
SDK (imported lazily so the server boots even if a given SDK isn't installed):
Gemini via `google-genai` with retry/backoff on 503/429; Anthropic via the
Messages API; OpenAI and any OpenAI-compatible/local server via chat
completions. If no config is sent, it falls back to the server's Gemini env key
(`PROJECT_GOOGLE_API_KEY`, or the historical misspelling `PROJEC_GOOGLE_API_KEY`
for already-deployed secrets). Default model ids are starting points and are
editable, since model names drift.

## 12. Backend API reference

Long-running endpoints follow the **start → poll** pattern; some also keep a
synchronous variant. All accept an optional per-request `provider` config.

| Endpoint | Purpose |
|---|---|
| `POST /api/generate-scene` · `…/start` · `GET …/status/{id}` | AI scene draft → scene schema |
| `POST /api/import/extract-text` | Extract raw text from an uploaded file |
| `POST /api/import/parse/start` · `GET …/status/{id}` (+ sync `…/parse`) | Break a bible/script into the schema |
| `POST /api/extract-template/start` · `GET …/status/{id}` | Strip a reusable template from an episode |
| `POST /api/critique/start` · `POST /api/write-script/start` · `POST /api/rewrite/start` | The Script Lab trio |
| `GET /api/ai/status/{id}` | Shared status for the Script Lab jobs |
| `POST /api/episode-prompts/start` · `GET …/status/{id}` | Reference 15s prompts for an episode |
| `POST /api/crossover/start` · `GET …/status/{id}` | Bridge two shows into one episode |
| `GET /api/health` | Liveness check |

CORS defaults open for local-first dev; set `CORS_ALLOW_ORIGINS` (comma-separated)
to lock it down for a real deployment.

## 13. UX & accessibility decisions (and one famous gotcha)

- **Locked viewport.** `html/body/#root` are `height:100vh; overflow:hidden`;
  each pane scrolls on its own. Fixes the old dead-space/stacking bugs and keeps
  phones to one full-height pane.
- **Visible affordances.** Delete/rename/finalize icons on tree rows and catalog
  items are always semi-visible (not hover-only).
- **WCAG AA contrast**, role-clustered character chips with quick-filter, a
  responsive 40/60 catalog modal, a 2-second "Copied!" confirmation, and an
  `ErrorBoundary` around the app.
- **Proactive limits.** The 3-character cap is enforced *as you pick cast*, not
  after the fact.

**The `window.confirm/alert/prompt` gotcha (read this before adding a dialog).**
The preview runs inside a **sandboxed iframe** where `window.confirm()`,
`alert()`, and `prompt()` are silently blocked — they no-op with no dialog. This
once made *every delete button in the app look broken* even though the Dexie
logic was correct. The fix is in place: `ConfirmDialog.tsx` exports a
`ConfirmProvider` (wrapping `<App/>`) and a `useConfirm()` hook. **Always
`await confirm(...)` for destructive actions — never call `window.confirm`.**

## 14. Running, configuring & deploying

**Run locally** (from the repo root, or the folder directly):

```bash
./start.sh                 # delegates to showrunner-studio/start.sh
# or
cd showrunner-studio && ./start.sh
```

It starts the FastAPI backend (`uv sync` + uvicorn with reload) and the Vite dev
server together. Ports: frontend on `APP_PORT` (default `3001`), backend on
`APP_PORT + 100`.

**Frontend dev commands** (in `showrunner-studio/frontend`): `npm run dev`,
`npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint),
`npm run preview`.

**Environment**

- `PROJECT_GOOGLE_API_KEY` — server-side Gemini key fallback (or the legacy
  `PROJEC_GOOGLE_API_KEY`).
- `CORS_ALLOW_ORIGINS` — comma-separated origin allowlist for production.
- `APP_PORT` — base port (backend = `APP_PORT + 100`).

**Deploy** — `.workshop/deploy.json` points the backend at
`showrunner-studio/backend` (`main:app`, uvicorn) and the frontend at
`showrunner-studio/frontend` (`npm install` / `npm run build`, `dist`).

## 15. Glossary

- **Action** — a scene's prose block of cinematic staging + camera language;
  in the Reference format it *also* carries the camera move and the transition.
- **Beat** — a story unit. In movies, the child of an Act; in causality, one
  link in the therefore/but chain.
- **Bible / premise** — the show's world rules, lore, and look.
- **Cast lock** — the rule that a take's characters can't change across its
  extensions.
- **Clip** — one 15-second generation.
- **DNA** — a stable character key restated per shot for visual consistency.
- **Extension** — an additional clip chained onto a take (segments 1–3).
- **Finalize** — the action that extracts a reusable template from an episode.
- **Regular generation** — the first clip of a take (segment 0).
- **Run** — a saved Episode-Prompt-Engine output (a set of prompt cards).
- **Set** — a location, tagged `#Name`.
- **Take** — up to 4 clips (60 s) with a locked cast and one set.
- **Transition** — the written cut between takes, or a single-take world-swap.

## 16. FAQ — the "why" behind the choices

**Why is every clip exactly 15 seconds?** Because that's the practical
per-generation ceiling for the target video models. Writing to it up front means
the prompts you export actually generate.

**Why max 3 characters and one set per take?** Identity and spatial coherence
collapse past that. The engines *enforce* it (locking to the first 3 cast and
warning about anyone dropped) rather than trusting you to remember.

**Why fold camera and transitions into the Action instead of separate fields?**
Because the model consumes one prompt per clip. A separate "camera field" is a
fiction — everything has to be in the text the model reads. So the app puts
camera moves and transitions *in the Action*, and the Shot and Transition
libraries paste there.

**Why the "therefore / but" law everywhere?** It's the single most reliable
defense against the "and then" drift that makes AI-written stories feel like an
itinerary. Applying it to write, critique, rewrite, reference prompts, and
crossovers keeps every generation causally driven.

**Why local-first?** Your bible and scripts are your IP. They live in your
browser; AI calls are opt-in and pluggable; export gives you a portable backup.

**Why is the folder/DB still called `showrunner-studio`?** Renaming the on-disk
database would orphan everyone's saved projects (a new name opens an empty DB).
The rebrand to Show-Writer Studio is a *branding* change; the internal
identifiers stay put so your data comes with you.

**Why keep a "Showrunner" format?** It names a *style* of structured breakdown
(showrunner-style clip blocks), sitting alongside "Seedance" and the primary
"Broadcast (15s)" reference format. It's a format menu item, not the product's
name.
