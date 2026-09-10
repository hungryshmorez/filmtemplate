imon# Showrunner Studio — Project Context

## Stack
- `showrunner-studio/frontend`: Vite + React + TS, Dexie (IndexedDB) storage, Tailwind.
- `showrunner-studio/backend`: FastAPI (uvicorn), Gemini via user's own key connector (`PROJEC_GOOGLE_API_KEY`), model `gemini-3.8-flash` (gemini-3.1-pro has zero free-tier quota).

## Hard rules of the generation engines (user-mandated)
- Every clip = fixed 15s. A "take" = 1 regular generation + up to 3 extensions (max 4 segments / 60s).
- Cast is LOCKED per take; max 3 characters, exactly 1 set. Extensions must not change cast.
- Every clip prompt must state who is in the scene, the set, and regular-vs-extended labeling.
- Every take boundary gets an explicit written TRANSITION block (hard_cut | cut_to_black | dissolve | whip_pan | match_cut | push_through), user-selectable per boundary in Showrunner/Seedance panels.
- Dialogue pacing: max ~25 spoken words per 15s clip (~2 words/sec); over-budget clips emit pacing warnings in both engines.

## CRITICAL gotcha: never use window.confirm/alert/prompt
- The preview runs inside a sandboxed iframe where `window.confirm()`/`alert()`/`prompt()` are silently blocked (no dialog shown, call is effectively a no-op) — this made every delete button in the app appear completely broken for weeks even though the underlying Dexie delete logic was correct.
- Fix pattern now in place: `frontend/src/components/ConfirmDialog.tsx` exports `ConfirmProvider` (wraps `<App/>` in `main.tsx`) + `useConfirm()` hook returning `(opts: {message, title?, confirmLabel?, cancelLabel?, danger?} | string) => Promise<boolean>`. ALWAYS use `await confirm(...)` instead of `window.confirm(...)` for any destructive action, anywhere in this app.

## Patterns
- Long AI calls run as background jobs (start + poll) to avoid Cloudflare 524: `/api/import/parse/start`, `/api/critique/start`, `/api/write-script/start`, `/api/rewrite/start`, shared status at `/api/ai/status/{id}` (import has its own status endpoint). In-memory dict job stores + daemon threads.
- `generate_with_retry()` in backend/main.py retries 503/429 with backoff; raises clean HTTPException after 3 attempts; accepts optional `config` param passed to `generate_content`.
- AI Script Lab (`CritiquePanel.tsx`, sidebar button "AI Script Lab"): 3 master prompts in `backend/main.py` — `CRITIQUE_SYSTEM_PROMPT` (Adult Swim Executive Critique, verdict GREENLIT|PILOT REWRITE|SHELVED), `SCRIPT_ENGINE_SYSTEM_PROMPT` (idea → screenplay, AI-tell word ban, 30/70 dialogue-action, in medias res), `SURGICAL_SYSTEM_PROMPT` (de-clutter, felt/saw filter, messy details, subtext). Currently genre-agnostic — pending work to parameterize per-genre (see Pending below).
- Sidebar tree rows + catalog (Sets/Characters) delete icons are always semi-visible (not hover-only) — user needs visible affordances.
- Node builds must route binaries through package.json scripts/npx (deploy image has no node_modules/.bin on PATH).
- Type-check with `npx tsc --noEmit`; build with `npm run build` in frontend dir.
- The launcher is `showrunner-studio/start.sh` (backend + frontend together). The repo-root `start.sh` now just delegates to it, so `./start.sh` from the root works too. The old "Script Studio" prototype (root `public/`, `source/`, `filmtemplate.txt`) has been removed.

## Pending / roadmap (user-confirmed direction, not yet built)
- Image uploads for show covers, characters, and sets (no storage backend yet — likely Dexie blob storage since no DB connector exists).
- Genre-aware critique/write/rewrite prompts across 14 genres: Comedy, Sitcom, Drama, Reality TV, Sci-Fi, Anime, Fantasy, Family, Western, Crime, Action & Adventure, Romance, Horror, Live Action.
- Recursive write→critique→rewrite loop in AI Script Lab.
- **Story template library**: user wants a `templates.ts`-style library that (a) is offered as brainstorm scaffolding when writing an episode, and (b) grows organically — when the user finishes/finalizes an episode, the app should strip a general reusable template out of it and save it back to the library. This is a distinct "learn from what you ship" loop, not just a static seed list. TV templates should feed the "Write Script" step per-genre.
- **Movies as a new top-level entity** (user-confirmed design):
  - Separate top-level type from TV Shows. Source-of-truth structure is **act-based** (e.g. 3-act, or custom acts/beats), NOT an episode list.
  - BUT: user explicitly wants the option to take a movie/season written in act structure and **split it into episodes at the end, purely for generation** (i.e. an "episode split" action/view that partitions the acts/beats into episode-sized chunks feeding the Showrunner/Seedance export engines) — this is a derived/generation-time view, not a second parallel data model. The acts remain the canonical structure.
  - Needs its own movie-genre templates (2 per genre × 14, broken into full three-act structure per user's earlier request) distinct from the TV 5-beat "story engine" templates (which exist because TV must sustain a plot engine week-to-week; movies are single self-contained stories).

## Publishing
- `.workshop/deploy.json`: backend root `showrunner-studio/backend` entry `main:app`; frontend root `showrunner-studio/frontend` npm build.