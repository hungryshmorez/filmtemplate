# Show-Writer Studio

A local-first studio for turning show ideas into AI-video-ready prompts. Every
clip is a fixed 15-second beat written as **Scene / Dialogue / Action** — with
camera movement and transitions folded into the Action, one prompt per clip.

- **Frontend** — `showrunner-studio/frontend`: Vite + React + TypeScript,
  Tailwind, Dexie (IndexedDB) for local-first storage.
- **Backend** — `showrunner-studio/backend`: FastAPI (uvicorn) with a
  multi-provider, bring-your-own-key LLM layer (Anthropic / OpenAI / Google /
  local OpenAI-compatible endpoints).

> **Note on the folder name.** The project directory is still
> `showrunner-studio/` and the on-disk local database is still named
> `showrunner-studio`. Those are internal identifiers kept as-is so existing
> saved projects aren't lost — only the product's branding is "Show-Writer
> Studio". "Showrunner" also survives as the name of one of the three export
> *formats* (see the encyclopedia), which is a format style, not the product.

## Running it

From the repo root:

```bash
./start.sh
```

That delegates to `showrunner-studio/start.sh`, which starts the FastAPI
backend and the Vite dev server together. You can also run that script
directly:

```bash
cd showrunner-studio
./start.sh
```

The app serves on `APP_PORT` (default `3001`); the backend runs on
`APP_PORT + 100`.

## Layout

```
showrunner-studio/
├── frontend/   # Vite + React + TS app (Dexie storage, Tailwind)
├── backend/    # FastAPI app (main:app), multi-provider LLM layer
└── start.sh    # launches backend + frontend together
```

## Highlights

- **Shows, episodes, movies** — TV series (episodes → scenes) and act-based
  movies (acts → beats) with a derived Episode Split for generation.
- **Episode Prompt Engine** — compiles an episode into per-scene, copy-ready
  15s prompt cards, persisted locally.
- **AI Script Lab** — recursive write → critique → rewrite loop, genre-aware.
- **Crossover Studio** — bridge two shows into one episode of single-prompt
  clips.
- **Shot Library & Transition Library** — searchable, copy-ready camera moves
  and transitions that drop straight into a clip's Action.

Generation invariants: 15s clips, a take = 1 regular generation + up to 3
extensions, cast locked per take (max 3 characters, 1 set), and ~25 spoken
words per clip.

## Full documentation

The complete reference — every concept, feature, format, endpoint, AI prompt,
and the reasoning behind each design decision — lives in
**[`docs/ENCYCLOPEDIA.md`](docs/ENCYCLOPEDIA.md)**.
