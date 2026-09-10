"""Showrunner Studio backend — LLM script generation endpoint.

Given a Show Bible, a selected Set, selected Characters, and a scene concept,
asks Gemini to draft a new scene mapped directly into the app's data schema
(action text, dialogue lines) so it can be imported straight into a Scene.
"""
import io
import json
import os
import pathlib
import threading
import time
import uuid
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="Showrunner Studio Backend")

# CORS defaults to open (local-first dev). Set CORS_ALLOW_ORIGINS to a
# comma-separated allowlist to lock it down for a real deployment.
_cors_env = os.environ.get("CORS_ALLOW_ORIGINS", "*").strip()
_cors_origins = ["*"] if _cors_env in ("", "*") else [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single place to pin the generation model instead of repeating the literal.
MODEL = "gemini-3.8-flash"


def _evict_jobs(store: dict, cap: int = 100) -> None:
    """Bound an in-memory job store so long uptime doesn't leak memory.
    Dicts preserve insertion order, so the first keys are the oldest jobs."""
    while len(store) > cap:
        store.pop(next(iter(store)), None)

# --- Legacy "Script Studio" app (old, unrelated prototype at the project
# root) — kept reachable at /legacy/public/ for reference only. Showrunner
# Studio (this app) is the primary experience; the legacy app is not linked
# from anywhere except an explicit "Old version" link in the new UI.
_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[2]
_LEGACY_PUBLIC = _PROJECT_ROOT / "public"
_LEGACY_SOURCE = _PROJECT_ROOT / "source"
if _LEGACY_SOURCE.is_dir():
    app.mount("/legacy/source", StaticFiles(directory=str(_LEGACY_SOURCE)), name="legacy-source")
if _LEGACY_PUBLIC.is_dir():
    app.mount("/legacy/public", StaticFiles(directory=str(_LEGACY_PUBLIC), html=True), name="legacy-public")

# In-memory job store for the async bulk-import breakdown (see
# /api/import/parse/start below). Fine for a single-process dev/small-deploy
# backend; jobs are ephemeral and only need to survive a few minutes.
_import_jobs: dict[str, dict] = {}

# --- Gemini client --------------------------------------------------------

_client = None


def get_client():
    global _client
    if _client is None:
        from google import genai

        # Prefer the correctly-spelled name; fall back to the historical
        # misspelling so an already-deployed secret keeps working.
        api_key = os.environ.get("PROJECT_GOOGLE_API_KEY") or os.environ.get("PROJEC_GOOGLE_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini connector not configured.")
        _client = genai.Client(api_key=api_key)
    return _client


def generate_with_retry(client, *, model: str, contents, attempts: int = 3, config=None):
    """Call Gemini, retrying transient overload/rate-limit errors with backoff.

    The free/personal API key occasionally returns 503 UNAVAILABLE (model
    overloaded) or 429 RESOURCE_EXHAUSTED (rate limited) — both are worth a
    short retry before giving up. Any other error is raised immediately.
    """
    import time

    from google.genai import errors as genai_errors

    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return client.models.generate_content(model=model, contents=contents, config=config)
        except genai_errors.ServerError as e:
            last_exc = e
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise HTTPException(
                status_code=503,
                detail="The AI model is temporarily overloaded. Please wait a few seconds and try again.",
            ) from e
        except genai_errors.ClientError as e:
            # 429 rate limit is worth a retry too; anything else (4xx) is not.
            if getattr(e, "code", None) == 429 and attempt < attempts - 1:
                last_exc = e
                time.sleep(2.0 * (attempt + 1))
                continue
            raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}") from e
    if last_exc:
        raise HTTPException(status_code=503, detail="The AI model is temporarily unavailable.") from last_exc
    raise HTTPException(status_code=500, detail="Unknown error calling Gemini.")


# --- Multi-provider LLM dispatch ------------------------------------------
#
# Every generation endpoint accepts an optional per-request ProviderConfig so
# users can bring their own key for Anthropic, OpenAI, Google (Gemini), or any
# OpenAI-compatible / local server (Ollama, LM Studio, vLLM, OpenRouter, ...).
# When no config is supplied we fall back to the Gemini env key, preserving the
# original behavior. Provider SDKs are imported lazily so the server boots even
# if a given SDK isn't installed.


class ProviderConfig(BaseModel):
    provider: str = "google"  # google | anthropic | openai | openai_compatible
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None  # required for openai_compatible / local


DEFAULT_MODELS = {
    "google": MODEL,
    "anthropic": "claude-3-5-sonnet-latest",
    "openai": "gpt-4o-mini",
    "openai_compatible": "gpt-4o-mini",
}


def llm_generate(cfg: "Optional[ProviderConfig]", system: str, user: str, max_tokens: int = 8192) -> str:
    """Route one (system, user) generation to the configured provider and return text."""
    provider = (cfg.provider if cfg and cfg.provider else "google").lower()
    model = (cfg.model if cfg and cfg.model else None) or DEFAULT_MODELS.get(provider, MODEL)

    if provider == "google":
        if cfg and cfg.api_key:
            from google import genai

            client = genai.Client(api_key=cfg.api_key)
        else:
            client = get_client()  # env key fallback
        resp = generate_with_retry(
            client, model=model, contents=[system, user], config={"max_output_tokens": max_tokens}
        )
        return resp.text or ""

    if provider == "anthropic":
        if not (cfg and cfg.api_key):
            raise HTTPException(status_code=400, detail="Anthropic requires an API key (set it in Settings).")
        try:
            from anthropic import Anthropic
        except ImportError as e:
            raise HTTPException(status_code=500, detail="Anthropic SDK is not installed on the server.") from e
        client = Anthropic(api_key=cfg.api_key)
        try:
            msg = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except Exception as e:  # noqa: BLE001 - surface provider errors uniformly
            raise HTTPException(status_code=502, detail=f"Anthropic request failed: {e}") from e
        return "".join(getattr(block, "text", "") for block in msg.content)

    if provider in ("openai", "openai_compatible"):
        base_url = cfg.base_url if cfg and cfg.base_url else None
        if provider == "openai_compatible" and not base_url:
            raise HTTPException(status_code=400, detail="Local / OpenAI-compatible provider requires a Base URL in Settings.")
        try:
            from openai import OpenAI
        except ImportError as e:
            raise HTTPException(status_code=500, detail="OpenAI SDK is not installed on the server.") from e
        # Local servers frequently ignore the key; send a placeholder so the SDK doesn't error.
        api_key = (cfg.api_key if cfg else None) or "not-needed"
        client = OpenAI(api_key=api_key, base_url=base_url)
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                max_tokens=max_tokens,
            )
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"{provider} request failed: {e}") from e
        return resp.choices[0].message.content or ""

    raise HTTPException(status_code=400, detail=f"Unknown provider '{provider}'.")


# --- Request/response models ----------------------------------------------


class CharacterBrief(BaseModel):
    id: str
    name: str
    role: str
    age: str = ""
    gender: str = ""
    visual_description: str = ""
    voice_description: str = ""


class SetBrief(BaseModel):
    id: str
    name: str
    time_of_day: str = ""
    description: str = ""


class GenerateSceneRequest(BaseModel):
    show_title: str = ""
    show_genre: str = ""
    show_premise: str = ""
    set: Optional[SetBrief] = None
    characters: list[CharacterBrief] = Field(default_factory=list)
    scene_concept: str
    episode_title: str = ""
    provider: Optional[ProviderConfig] = None


class DialogueLineOut(BaseModel):
    character_id: str
    text: str
    parenthetical: Optional[str] = None


class GenerateSceneResponse(BaseModel):
    scene_name: str
    action: str
    dialogue: list[DialogueLineOut]
    scene_notes: str


SYSTEM_INSTRUCTIONS = """You are an AI Script Supervisor and Clip Director optimized for \
Showrunner and Seedance production pipelines.

Generation constraints:
- Every action beat must translate into atomic, 5-15 second generate-ready clips.
- Separate paragraphs (blank line between them) for each distinct shot/beat grouping.
- Decouple spatial movement (subject motion) from camera perspective (framing/movement) \
by writing action prose that clearly contains both — narrative kinetic action AND explicit \
camera language (e.g. "Wide shot,", "Static low-angle close-up,", "slow dolly-in") — since a \
downstream parser splits these clauses automatically.
- Only use the exact registered character names and set name given. Do not invent new named \
characters or sets.
- Reflect the show's genre, tone, and premise in pacing and word choice.
- Return ONLY valid JSON matching the requested schema. No markdown fences, no commentary.
"""


def build_prompt(req: GenerateSceneRequest) -> str:
    chars_desc = "\n".join(
        f"- {c.name} ({c.role}, {c.age} {c.gender}): visual={c.visual_description} | voice={c.voice_description}"
        for c in req.characters
    ) or "(no characters registered — use only generic unnamed figures)"

    set_desc = (
        f"{req.set.name} — {req.set.time_of_day} — {req.set.description}"
        if req.set
        else "(no set registered — use a generic unnamed location)"
    )

    return f"""SHOW: {req.show_title}
GENRE: {req.show_genre}
PREMISE: {req.show_premise}
EPISODE: {req.episode_title}

REGISTERED SET:
{set_desc}

REGISTERED CHARACTERS:
{chars_desc}

SCENE CONCEPT / OUTLINE:
{req.scene_concept}

Generate one new scene as JSON with this exact shape:
{{
  "scene_name": "short scene title",
  "action": "action prose, paragraphs separated by a blank line, one paragraph per shot/beat",
  "dialogue": [{{"character_id": "<one of the registered character ids>", "text": "...", "parenthetical": "optional tone note"}}],
  "scene_notes": "any continuity/production notes"
}}

Use these exact character ids when referencing dialogue speakers: {[c.id for c in req.characters]}
"""


def _parse_scene(text: str) -> GenerateSceneResponse:
    data = json.loads(_strip_json_fences(text))
    return GenerateSceneResponse(
        scene_name=data.get("scene_name", "Untitled Scene"),
        action=data.get("action", ""),
        dialogue=[
            DialogueLineOut(
                character_id=d.get("character_id", ""),
                text=d.get("text", ""),
                parenthetical=d.get("parenthetical"),
            )
            for d in data.get("dialogue", [])
        ],
        scene_notes=data.get("scene_notes", ""),
    )


@app.post("/api/generate-scene", response_model=GenerateSceneResponse)
async def generate_scene(req: GenerateSceneRequest):
    """Synchronous scene generation (kept for direct use / small models)."""
    text = llm_generate(req.provider, SYSTEM_INSTRUCTIONS, build_prompt(req), max_tokens=8192)
    try:
        return _parse_scene(text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Model did not return valid JSON: {e}. Raw: {text[:500]}")


_scene_jobs: dict[str, dict] = {}


@app.post("/api/generate-scene/start")
async def generate_scene_start(req: GenerateSceneRequest):
    """Async scene generation — matches the start/poll pattern of the other
    long generations so slow models don't trip a reverse-proxy timeout."""
    job_id = uuid.uuid4().hex
    _evict_jobs(_scene_jobs)
    _scene_jobs[job_id] = {"status": "pending", "result": None, "error": None, "created": time.time()}

    def run_job():
        try:
            text = llm_generate(req.provider, SYSTEM_INSTRUCTIONS, build_prompt(req), max_tokens=8192)
            try:
                parsed = _parse_scene(text)
            except json.JSONDecodeError as e:
                _scene_jobs[job_id] = {"status": "error", "result": None, "error": f"Model did not return valid JSON: {e}. Raw: {text[:500]}"}
                return
            _scene_jobs[job_id] = {"status": "done", "result": parsed.model_dump(), "error": None}
        except HTTPException as e:
            _scene_jobs[job_id] = {"status": "error", "result": None, "error": str(e.detail)}
        except Exception as e:
            _scene_jobs[job_id] = {"status": "error", "result": None, "error": f"Unexpected error: {e}"}

    threading.Thread(target=run_job, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/generate-scene/status/{job_id}")
async def generate_scene_status(job_id: str):
    job = _scene_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id.")
    return job


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# --- Document text extraction ---------------------------------------------


def extract_text_from_bytes(filename: str, data: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    if lower.endswith(".docx"):
        from docx import Document

        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    # .txt, .md, .fountain, or anything else: treat as plain text
    return data.decode("utf-8", errors="ignore")


@app.post("/api/import/extract-text")
async def extract_text(file: UploadFile = File(...)):
    data = await file.read()
    try:
        text = extract_text_from_bytes(file.filename or "upload.txt", data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text from {file.filename}: {e}")
    return {"filename": file.filename, "text": text}


# --- Bulk Show Bible / Script breakdown ------------------------------------


class ExistingCatalog(BaseModel):
    set_names: list[str] = Field(default_factory=list)
    character_names: list[str] = Field(default_factory=list)


class ImportParseRequest(BaseModel):
    combined_text: str
    existing: ExistingCatalog = Field(default_factory=ExistingCatalog)
    provider: Optional[ProviderConfig] = None


class ParsedSet(BaseModel):
    name: str
    time_of_day: str = ""
    description: str = ""


class ParsedCharacter(BaseModel):
    name: str
    role: str = "Supporting"
    age: str = ""
    gender: str = ""
    visual_description: str = ""
    voice_description: str = ""


class ParsedDialogue(BaseModel):
    character_name: str
    text: str
    parenthetical: Optional[str] = None


class ParsedScene(BaseModel):
    scene_name: str
    set_name: Optional[str] = None
    character_names: list[str] = Field(default_factory=list)
    action: str = ""
    dialogue: list[ParsedDialogue] = Field(default_factory=list)
    scene_notes: str = ""


class ParsedEpisode(BaseModel):
    title: str
    scenes: list[ParsedScene] = Field(default_factory=list)


class ParsedShow(BaseModel):
    title: str = ""
    genre: str = ""
    premise: str = ""


class ImportParseResponse(BaseModel):
    show: ParsedShow
    sets: list[ParsedSet]
    characters: list[ParsedCharacter]
    episodes: list[ParsedEpisode]


IMPORT_SYSTEM_INSTRUCTIONS = """You are a Script Supervisor breaking down raw show-bible and \
script documents into a structured production database.

Rules:
- Extract EVERY distinct location mentioned as a Set (name, time_of_day like Interior/Exterior/ \
Day/Night/Liminal, and a rich description covering physical traits, props, textures, ambient audio).
- Extract EVERY named character as a Character (name, role: Protagonist/Antagonist/Supporting, age, \
gender, visual_description covering physical form/materials/clothing/quirks, voice_description \
covering timbre/dialect/cadence/distortion traits). Infer reasonable details from context if the \
source doesn't spell them out explicitly, but do not invent named characters that don't appear.
- If the source text already lists some sets/characters that match the "existing catalog" names \
given to you, reuse the EXACT existing name verbatim (do not create a near-duplicate with slightly \
different spelling/casing).
- Break the script into Episodes (if unspecified, put everything under one episode titled after the \
show or "Episode 1"), each containing Scenes in story order.
- Each Scene must have: scene_name, set_name (must exactly match one of the extracted/existing Set \
names, or null if no location is identifiable), character_names (exact match to extracted/existing \
Character names), action (prose broken into blank-line-separated paragraphs, one paragraph per \
distinct shot/beat — each paragraph should read naturally with both narrative action AND camera \
language woven in, e.g. shot type / camera movement words), dialogue (character_name + text + \
optional parenthetical), and scene_notes for any continuity/production notes.
- Return ONLY valid JSON matching the exact schema given. No markdown fences, no commentary, no \
trailing text.
"""


def build_import_prompt(req: ImportParseRequest) -> str:
    existing_sets = ", ".join(req.existing.set_names) or "(none yet)"
    existing_chars = ", ".join(req.existing.character_names) or "(none yet)"
    return f"""EXISTING SET NAMES (reuse verbatim if the same location reappears): {existing_sets}
EXISTING CHARACTER NAMES (reuse verbatim if the same character reappears): {existing_chars}

SOURCE DOCUMENTS (show bible and/or script, possibly concatenated from multiple files):
---
{req.combined_text}
---

Return JSON with this exact shape:
{{
  "show": {{"title": "...", "genre": "...", "premise": "..."}},
  "sets": [{{"name": "...", "time_of_day": "...", "description": "..."}}],
  "characters": [{{"name": "...", "role": "Protagonist|Antagonist|Supporting", "age": "...", "gender": "...", "visual_description": "...", "voice_description": "..."}}],
  "episodes": [
    {{
      "title": "...",
      "scenes": [
        {{
          "scene_name": "...",
          "set_name": "..." ,
          "character_names": ["..."],
          "action": "...",
          "dialogue": [{{"character_name": "...", "text": "...", "parenthetical": null}}],
          "scene_notes": "..."
        }}
      ]
    }}
  ]
}}
"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    return text.strip()


@app.post("/api/import/parse/start")
async def import_parse_start(req: ImportParseRequest):
    """Kick off the AI breakdown as a background job and return immediately.

    Large show bibles / scripts can take longer than the reverse proxy's
    request timeout (Cloudflare returns 524 on long-held connections), so
    the client starts a job here and polls /api/import/parse/status/{id}
    instead of waiting on one long HTTP request.
    """
    if not req.combined_text.strip():
        raise HTTPException(status_code=400, detail="No text provided to parse.")

    job_id = uuid.uuid4().hex
    _evict_jobs(_import_jobs)
    _import_jobs[job_id] = {"status": "pending", "result": None, "error": None, "created": time.time()}

    def run_job():
        try:
            prompt = build_import_prompt(req)
            text = _strip_json_fences(llm_generate(req.provider, IMPORT_SYSTEM_INSTRUCTIONS, prompt, max_tokens=16384))
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                _import_jobs[job_id] = {
                    "status": "error",
                    "result": None,
                    "error": f"Model did not return valid JSON: {e}. Raw (first 800 chars): {text[:800]}",
                }
                return
            try:
                parsed = ImportParseResponse(**data)
            except Exception as e:
                _import_jobs[job_id] = {
                    "status": "error",
                    "result": None,
                    "error": f"Model JSON did not match schema: {e}",
                }
                return
            _import_jobs[job_id] = {"status": "done", "result": parsed.model_dump(), "error": None}
        except HTTPException as e:
            _import_jobs[job_id] = {"status": "error", "result": None, "error": str(e.detail)}
        except Exception as e:
            _import_jobs[job_id] = {"status": "error", "result": None, "error": f"Unexpected error: {e}"}

    threading.Thread(target=run_job, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/import/parse/status/{job_id}")
async def import_parse_status(job_id: str):
    job = _import_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id.")
    return job


@app.post("/api/import/parse", response_model=ImportParseResponse)
async def import_parse(req: ImportParseRequest):
    """Legacy synchronous endpoint — kept for smaller documents / direct use."""
    if not req.combined_text.strip():
        raise HTTPException(status_code=400, detail="No text provided to parse.")

    prompt = build_import_prompt(req)
    text = _strip_json_fences(llm_generate(req.provider, IMPORT_SYSTEM_INSTRUCTIONS, prompt, max_tokens=16384))
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Model did not return valid JSON: {e}. Raw (first 800 chars): {text[:800]}",
        )

    try:
        return ImportParseResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Model JSON did not match schema: {e}")


# --- AI critique / script writing (master prompts) -------------------------
#
# Three AI workbenches usable straight from the main page, with or without an
# existing script:
#   1. CRITIQUE  — cynical late-night network exec rips the script apart.
#   2. WRITE     — build a script from just an idea (optionally + show bible).
#   3. REWRITE   — surgical overhaul of an existing script using the notes.
#
# All three run as background jobs (same start/status pattern as the import
# breakdown) because scripts are long generations that would otherwise trip
# the reverse proxy's request timeout.

CRITIQUE_SYSTEM_PROMPT = """\
You are a veteran Adult Swim network executive. You have survived every writers-room war, \
every latenight ratings slump, and a thousand pitch meetings where someone had a "funny idea" \
and no idea what a show actually is. You are brilliant, cynical, hyper-critical, impatient with \
mediocrity, and impossible to impress. You have seen every trick. You are judging a pilot script \
for your late-night programming block.

Run the submission through this evaluation framework before writing your breakdown:

1. IDENTITY TEST — What is this show about in one brutal sentence? Does the comedic engine \
generate infinite stories, or does it die after one gag? Would YOU personally watch this at \
2 AM? Could this survive 30+ episodes?

2. VOICE & DIALOGUE CHECK — Read every line aloud in your head. Does each character have a \
distinct, identifiable voice? Could you cover the names and still know who's talking? Flag \
every line that is pure plot delivery. Flag every generic parenthetical like "(sarcastically)" \
or "(wryly)". Dialogue must distinguish character, not just convey information.

3. STAGNATION FILTER — Does the pilot move from Story State A to Story State B? Or do the \
characters experience the same emotional state for 22 pages while things merely "happen"? \
A pilot MUST change its world or its protagonist. Identify the exact moment the state flips \
— or call out that it never does.

4. AI-STERILITY SCRUB — Hunt for the dead, focus-grouped, algorithmic quality. Ban list: \
"testament", "beacon", "symphony", "labyrinthine", "tapestry", "delve", "navigate", "palpable". \
Flag every scene where characters say what they feel instead of demonstrating it. The characters \
must feel like messy, erratic humans, not like no-skin-in-the-game algorithmic mannequins. \
Cross out any line a network notes-processor could have written and say what a real person \
would say instead.

OUTPUT FORMAT (this exact structure, markdown):

## COLD OPEN JUDGMENT
One to three sentences. The visceral first reaction a real exec would have before the notes begin. \
No niceties. No "this shows promise." Speak like a person who has read 10,000 scripts.

## EXECUTIVE BREAKDOWN
The full teardown, section by section, using the four-point framework above. Quote the script's \
actual lines and fix them in place. Sarcasm is fine; vagueness is not. Every note must be actionable.

## SUBTEXT AUDIT
Name the subtext engine of the show. What is every scene really about beneath the plot? If a scene \
has no subtext — two people exchanging information — that scene dies on the page. Flag the exact \
lines and propose replacements with subtext baked in.

## LATE-NIGHT VERDICT
One of: GREENLIT | PILOT REWRITE | SHELVED — followed by a one-paragraph explanation of the \
decision, and if not greenlit, the three specific changes that would change your mind.

Never soften the verdict. Never suggest changes and then reassure them it's already great. \
You are not their friend. You are the gate."""

SCRIPT_ENGINE_SYSTEM_PROMPT = """\
You are the Script Creation Engine — a raw, uncompromising screenwriting machine built from the \
coldest section of the writers room. You write scripts that DO NOT READ LIKE AI WROTE THEM.

WRITE IN STANDARD SCREENPLAY FORMAT: sluglines in caps (INT. LOCATION - NIGHT), action lines, \
character names in caps centered before dialogue, parentheticals only when they shape HOW a \
line is delivered and are never generic. Prose, not markdown tables.

HARD RULES:

- THE AI-TELL WORD BAN. These words are forbidden in your output: testament, beacon, symphony, \
labyrinthine, tapestry, delve, navigate, palpable. If you catch one, delete it and rewrite the line.

- THE ACTIVE VERB MANDATE. Action lines use active, cinematic verbs. Nobody "walks over to" \
anything. They stride, they loom, they shuffle, they skid. The camera always has something to film.

- 30% DIALOGUE / 70% ACTION. Dialogue is punctuation, not the engine. Action lines and visual \
storytelling dominate the page. When a character speaks, it should cost something.

- PACING VELOCITY. No scene loiters. Enter late, leave early. If a scene can be cut without \
breaking story logic, it should not exist.

- START IN MEDIAS RES. Page one opens mid-situation. No waking up, no establishing shots of \
weather, no "introduce our hero" exposition. The world is already in motion.

- SUBTEXT OR DEATH. Characters never say what they want. The dialogue circles the want. \
The want leaks out through action.

- CHARACTERS OVER PLOT. The plot is a machine for squeezing characters until they do \
something revealing.

Output ONLY the script itself in screenplay format. No preamble, no explanation of what you did, \
no closing notes."""

SURGICAL_SYSTEM_PROMPT = """\
You are the SURGICAL SCRIPT OVERHAUL unit. You take an existing script and perform a precise, \
uncompromising rewrite. You do not add new plot. You do not change the story. You execute \
exactly the four operations below, line by line, and output the clean script.

THE FOUR OPERATIONS:

1. DIALOGUE DE-CLUTTER. Strip every line down to minimum effective words. Delete filler, \
hedging, over-explaining, and any line that merely repeats information the audience already has. \
If a character can say it in three words instead of ten, they will.

2. FELT/SAW FILTER REMOVAL. Delete every construction where the author TELLS the reader \
something was felt or seen instead of SHOWING the thing itself: "he felt the cold air", \
"she saw the figure move", "they watched as", "he noticed that". Replace with the direct \
image: the cold air bites his neck. The figure moves. Cut the camera and stage the event.

3. MESSY DETAIL PASS. Real rooms have specific junk in them. Real people have asymmetric, \
unflattering, hyper-specific behaviors. Add texture to action lines: awkward physical business, \
wrong-shaped props, non-sequitur background events. Life is messy; the page should feel \
invaded by it.

4. SUBTEXT EXTRACTION. Wherever a character directly states an emotion or a want, remove the \
statement and rebuild the beat so the want leaks out sideways — through what they do with \
their hands, what they refuse to say, the joke they hide behind. Never announce subtext.

OUTPUT: the fully rewritten script in clean screenplay format, prose only. Do NOT summarize \
changes. Do NOT add commentary before or after. Output the script and nothing else."""


_ai_jobs: dict[str, dict] = {}

# --- Genre-aware prompt addenda ---------------------------------------------
#
# The three master prompts above are genre-agnostic on purpose (they encode
# craft fundamentals that apply everywhere). GENRE_NOTES supplies a short,
# genre-specific craft brief that gets appended as a "GENRE FOCUS" block to
# whichever prompt is running, so the same exec/writer/surgeon persona still
# judges/writes/rewrites with the right structural and tonal instincts for
# the 14 genres the app supports.

GENRE_NOTES: dict[str, str] = {
    "Comedy": "Joke density and misdirection are the engine — every beat should set up a joke, subvert it, or both. Reward efficient, escalating bits over one-off gags. Flag any scene that could lose its funniest line and still work; that line is dead weight if it isn't load-bearing.",
    "Sitcom": "Multi-camera rhythm: scenes play in a small number of contained sets, built around a cold open, A/B plot collision, and a button/tag. Dialogue should land in laugh-beat chunks an audience could applaud. Watch for stakes that are too high for the format — sitcom conflict resolves and resets by the credits.",
    "Drama": "Slow-burn escalation and internal stakes matter more than plot mechanics. Every scene should shift a relationship or a character's self-knowledge, even quietly. Distrust dialogue that states emotion outright — dramatic weight lives in restraint and what's withheld.",
    "Reality TV": "Manufactured spontaneity: confessional-style asides, producer-engineered conflict, and edit-friendly beats (setup / reaction / consequence) matter more than traditional scene craft. Judge whether the 'characters' (real people, heightened) have distinct edit personas and whether the conflict is structured to escalate across an episode arc.",
    "Sci-Fi": "The speculative conceit must generate story, not just decorate it — ask what changes about human behavior because of the tech/world rule, and hold that rule consistent. World-building exposition should be smuggled through action and consequence, never delivered as a lecture.",
    "Anime": "Heightened emotional register and escalating power/stakes are the format's native language — earn big swings with clear internal logic and character conviction rather than dismissing them as excessive. Watch pacing for the genre's signature rhythm: extended beats of tension/buildup punctuated by sudden, decisive turns.",
    "Fantasy": "World rules (magic systems, factions, mythology) must have consistent costs and limits — track them like physics. Judge whether the fantastical elements are load-bearing to the plot/theme or just set dressing. Exposition about the world should ride on character need, not travelogue narration.",
    "Family": "Story must work on two registers at once — a surface-level plot legible to kids and a subtext layer that rewards adult viewers. Conflict resolves with an earned, non-preachy emotional beat. Flag anything that talks down to its audience or moralizes directly instead of dramatizing the lesson.",
    "Western": "Terrain and silence are characters — pacing should breathe, with sparse, weighted dialogue and physical stakes (land, water, law vs. no law) driving the plot. Judge whether the moral code of the world (honor, vengeance, survival) is clear and consistently tested, not just aesthetic dressing.",
    "Crime": "The plan/execution/complication engine must escalate logically — every twist should re-contextualize earlier information rather than come from nowhere. Track procedural or criminal detail for internal consistency; sloppy logic breaks genre trust faster than anything else.",
    "Action & Adventure": "Physical stakes and momentum are the spine — every set piece should advance character or plot, not just spectacle. Judge geography and stakes clarity: can the audience track where everyone is and what they lose if this goes wrong? Cut any lull that isn't earning a breather beat before the next escalation.",
    "Romance": "The relationship's obstacle (internal or external) must feel specific and earned, not manufactured misunderstanding. Track the push-pull rhythm scene to scene — attraction, friction, vulnerability — and judge whether the eventual turn is earned by specific beats rather than a genre-mandated timer running out.",
    "Horror": "Dread is a pacing discipline — judge the ratio of unease-building beats to release/scare beats, and whether the scare is earned by everything preceding it. The threat's rules (what it can/can't do, why now) must stay consistent; random rule-breaks for shock value kill audience trust.",
    "Live Action": "Judge groundedness: physical staging, blocking and practical logistics should read as filmable in the real world, not just conceptually cool. Flag anything that only works as an idea and falls apart when you imagine an actual crew and cast executing it on a real set.",
}


def genre_focus_block(genre: str | None) -> str:
    note = GENRE_NOTES.get((genre or "").strip())
    if not note:
        return ""
    return f"\nGENRE FOCUS ({genre}): {note}\n"


# --- Organic template learning: strip a reusable template out of a --------
# finished episode and hand it back to the frontend to save into the
# growing "learned templates" library (Dexie table, distinct from the
# static seed library in storyTemplates.ts).

class TemplateBeat(BaseModel):
    label: str
    description: str


class ExtractedTemplate(BaseModel):
    name: str
    format: str = "Episodic"
    concept: str
    mechanics: str
    beats: list[TemplateBeat] = Field(default_factory=list)


class ExtractTemplateRequest(BaseModel):
    episodeTitle: str
    genre: Optional[str] = None
    episodeText: str = Field(..., description="Concatenated scene action + dialogue for the whole episode")
    provider: Optional[ProviderConfig] = None


TEMPLATE_EXTRACTION_SYSTEM_PROMPT = """\
You are a Story Engine Archivist. Given a finished episode script, strip out everything specific \
to THIS episode — character names, this episode's exact plot particulars, this show's proper \
nouns and world-specific details — and abstract it into a general, REUSABLE story template that \
could seed a completely different episode with different characters and a different specific \
plot, while preserving the underlying structural mechanic that made this episode work.

RULES:
- name: a short, punchy label for the reusable mechanic/structure (e.g. "The A/B Plot Collision", \
"The Escalating Lie").
- format: one of Episodic | Serialized | Anthology | Case-of-the-Week | Bottle Episode (pick the \
closest fit, or coin a short label if none fit).
- concept: 1-3 sentences describing the abstracted structural idea, with every specific name or \
detail replaced by a generic role (e.g. "the protagonist", "the antagonist", "the secondary set", \
"the ensemble").
- mechanics: 2-4 sentences on HOW the structure actually operates scene to scene — the mechanism \
that generates story — described generically enough to be replayed with a totally different \
specific plot.
- beats: a 5-beat abstracted timeline (choose your own beat labels, e.g. Setup/Complication/ \
Struggle/Turn/Resolution) with a one-sentence generic description of what structurally happens at \
each beat.

Output ONLY valid JSON matching the exact schema given. No markdown fences, no commentary, no \
trailing text."""


def build_template_extraction_prompt(req: ExtractTemplateRequest) -> str:
    return f"""EPISODE: {req.episodeTitle}
GENRE: {req.genre or "unknown"}

FULL EPISODE (scene action + dialogue, in story order):
---
{req.episodeText.strip()}
---

Return JSON with this exact shape:
{{
  "name": "...",
  "format": "...",
  "concept": "...",
  "mechanics": "...",
  "beats": [{{"label": "...", "description": "..."}}]
}}
"""


_template_jobs: dict[str, dict] = {}


@app.post("/api/extract-template/start")
async def extract_template_start(req: ExtractTemplateRequest):
    if not req.episodeText.strip():
        raise HTTPException(status_code=400, detail="No episode text to extract a template from.")

    job_id = uuid.uuid4().hex
    _evict_jobs(_template_jobs)
    _template_jobs[job_id] = {"status": "pending", "result": None, "error": None, "created": time.time()}

    def run_job():
        try:
            prompt = build_template_extraction_prompt(req)
            text = _strip_json_fences(llm_generate(req.provider, TEMPLATE_EXTRACTION_SYSTEM_PROMPT, prompt, max_tokens=8192))
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                _template_jobs[job_id] = {
                    "status": "error",
                    "result": None,
                    "error": f"Model did not return valid JSON: {e}. Raw (first 800 chars): {text[:800]}",
                }
                return
            try:
                parsed = ExtractedTemplate(**data)
            except Exception as e:
                _template_jobs[job_id] = {
                    "status": "error",
                    "result": None,
                    "error": f"Model JSON did not match schema: {e}",
                }
                return
            _template_jobs[job_id] = {"status": "done", "result": parsed.model_dump(), "error": None}
        except HTTPException as e:
            _template_jobs[job_id] = {"status": "error", "result": None, "error": str(e.detail)}
        except Exception as e:
            _template_jobs[job_id] = {"status": "error", "result": None, "error": f"Unexpected error: {e}"}

    threading.Thread(target=run_job, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/extract-template/status/{job_id}")
async def extract_template_status(job_id: str):
    job = _template_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id.")
    return job




class CritiqueRequest(BaseModel):
    text: str = Field(..., description="The script / series text to critique")
    showTitle: Optional[str] = None
    genre: Optional[str] = None
    provider: Optional[ProviderConfig] = None


class WriteScriptRequest(BaseModel):
    idea: str = Field(..., description="The idea to expand into a script")
    showBible: Optional[str] = None
    genre: Optional[str] = None
    targetLength: Optional[str] = Field(
        None, description='e.g. "cold open + 1 scene", "full pilot", "11-minute episode"'
    )
    provider: Optional[ProviderConfig] = None


class RewriteScriptRequest(BaseModel):
    script: str = Field(..., description="The existing script to overhaul")
    notes: Optional[str] = Field(None, description="Optional exec notes / focus areas to apply")
    genre: Optional[str] = None
    provider: Optional[ProviderConfig] = None


def _start_ai_job(cfg: "Optional[ProviderConfig]", system: str, user: str, max_tokens: int = 16384):
    """Shared job runner for long text generations (critique/write/rewrite)."""
    job_id = uuid.uuid4().hex
    _evict_jobs(_ai_jobs)
    _ai_jobs[job_id] = {"status": "pending", "result": None, "error": None, "created": time.time()}

    def run_job():
        try:
            text = llm_generate(cfg, system, user, max_tokens)
            _ai_jobs[job_id] = {"status": "done", "result": {"text": text}, "error": None}
        except HTTPException as e:
            _ai_jobs[job_id] = {"status": "error", "result": None, "error": str(e.detail)}
        except Exception as e:
            _ai_jobs[job_id] = {"status": "error", "result": None, "error": f"Unexpected error: {e}"}

    threading.Thread(target=run_job, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/ai/status/{job_id}")
async def ai_job_status(job_id: str):
    job = _ai_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id.")
    return job


@app.post("/api/critique/start")
async def critique_start(req: CritiqueRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No script text provided to critique.")

    header = ""
    if req.showTitle or req.genre:
        header = f"SHOW: {req.showTitle or 'Untitled'}\nGENRE: {req.genre or 'unknown'}\n\n"
    prompt = f"{header}THE SUBMISSION:\n\n{req.text.strip()}"
    return _start_ai_job(req.provider, CRITIQUE_SYSTEM_PROMPT + genre_focus_block(req.genre), prompt)


@app.post("/api/write-script/start")
async def write_script_start(req: WriteScriptRequest):
    if not req.idea.strip():
        raise HTTPException(status_code=400, detail="No idea provided.")

    length = (req.targetLength or "full pilot").strip()
    parts = [f"ASSIGNMENT: Write {length} based on the idea below."]
    if req.showBible and req.showBible.strip():
        parts.append(f"\nSHOW BIBLE (canon — characters, world and rules must match this):\n\n{req.showBible.strip()}")
    parts.append(f"\nTHE IDEA:\n\n{req.idea.strip()}")
    prompt = "\n".join(parts)
    return _start_ai_job(req.provider, SCRIPT_ENGINE_SYSTEM_PROMPT + genre_focus_block(req.genre), prompt)


@app.post("/api/rewrite/start")
async def rewrite_start(req: RewriteScriptRequest):
    if not req.script.strip():
        raise HTTPException(status_code=400, detail="No script provided to rewrite.")

    parts = [f"THE SCRIPT TO OVERHAUL:\n\n{req.script.strip()}"]
    if req.notes and req.notes.strip():
        parts.append(f"\nADDITIONAL EXEC NOTES (apply alongside the four operations):\n\n{req.notes.strip()}")
    prompt = "\n".join(parts)
    return _start_ai_job(req.provider, SURGICAL_SYSTEM_PROMPT + genre_focus_block(req.genre), prompt)


# --- Reference-format 15-second broadcast prompts --------------------------
#
# Interpret an episode's script/outline and emit self-contained generation
# prompts, ONE PER 15 SECONDS, in the reference Scene / Dialogue / Action shape.
# Seedance/Showrunner detail (camera movement, shot framing, transitions,
# character-consistency cues) is folded INTO those three fields — everything the
# downstream video generator needs lives in the prompt itself.

REFERENCE_PROMPT_SYSTEM = """\
You are a Broadcast Prompt Director. You convert a script, outline, or scene text into a sequence \
of self-contained AI-video generation prompts — EXACTLY ONE PROMPT PER 15 SECONDS of runtime. \
Each prompt is a standalone 15-second clip a video model can generate on its own.

HARD RULES:
- Each prompt covers ~15 seconds. Interpret the source and break it into 15s beats in story order.
- At most 3 speaking/among characters per prompt (a take locks its cast).
- Keep spoken dialogue to what a person can naturally say in 15 seconds — roughly 25 words total \
across the whole prompt. Push overflow into the next prompt.
- Fold ALL cinematic detail into the three fields below — camera movement, shot framing, lens, \
transitions in/out of the clip, and any character-consistency / visual-DNA cues. Do not omit them; \
there is no separate camera or transition field.

EACH PROMPT OBJECT:
- "scene": one rich sentence — mood + location/set + lighting and color palette + atmosphere. You \
may weave in framing and transition context here too.
- "dialogue": array of { "character": name, "delivery": short parenthetical delivery note, \
"line": the spoken words }. Empty array if the clip has no dialogue.
- "action": cinematic staging in active verbs, INCLUDING explicit camera movement / shot type and \
the transition into or out of this 15s clip. This is the meat of the generation prompt.

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly:
{ "prompts": [ { "scene": "...", "dialogue": [ { "character": "...", "delivery": "...", "line": "..." } ], "action": "..." } ] }
"""


class EpisodePromptsRequest(BaseModel):
    script: str = Field(..., description="Episode script / outline / scene text to interpret")
    showTitle: str = ""
    genre: Optional[str] = None
    premise: Optional[str] = None
    targetPrompts: int = 8  # aim for this many 15s prompts (ignored when free)
    free: bool = False  # produce as many 15s prompts as the script needs, uncapped
    provider: Optional[ProviderConfig] = None


_eprompt_jobs: dict[str, dict] = {}


def build_episode_prompts_prompt(req: EpisodePromptsRequest) -> str:
    length_rule = (
        "Produce exactly as many 15-second prompts as the script naturally needs to cover ALL of its "
        "content end to end — do not truncate, do not summarize; however many 15-second beats that is."
        if req.free
        else f"Produce about {max(1, req.targetPrompts)} prompts total (target {max(1, req.targetPrompts)}). "
        "Select and condense the most important beats so the whole story reads coherently within that count."
    )
    header_bits = [f"SHOW: {req.showTitle or 'Untitled'}", f"GENRE: {req.genre or 'unknown'}"]
    if req.premise and req.premise.strip():
        header_bits.append(f"PREMISE: {req.premise.strip()}")
    header = "\n".join(header_bits)
    return f"""{header}

LENGTH: {length_rule}

SOURCE SCRIPT / OUTLINE TO INTERPRET:
---
{req.script.strip()}
---

Return the JSON object of 15-second prompts now."""


@app.post("/api/episode-prompts/start")
async def episode_prompts_start(req: EpisodePromptsRequest):
    if not req.script.strip():
        raise HTTPException(status_code=400, detail="No script provided to interpret into prompts.")

    job_id = uuid.uuid4().hex
    _evict_jobs(_eprompt_jobs)
    _eprompt_jobs[job_id] = {"status": "pending", "result": None, "error": None, "created": time.time()}

    def run_job():
        try:
            prompt = build_episode_prompts_prompt(req)
            # Large / free runs can be long — give the model plenty of room.
            text = _strip_json_fences(llm_generate(req.provider, REFERENCE_PROMPT_SYSTEM, prompt, max_tokens=32768))
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                _eprompt_jobs[job_id] = {
                    "status": "error",
                    "result": None,
                    "error": f"Model did not return valid JSON: {e}. Raw (first 800 chars): {text[:800]}",
                }
                return
            prompts = data.get("prompts", data if isinstance(data, list) else [])
            _eprompt_jobs[job_id] = {"status": "done", "result": {"prompts": prompts}, "error": None}
        except HTTPException as e:
            _eprompt_jobs[job_id] = {"status": "error", "result": None, "error": str(e.detail)}
        except Exception as e:
            _eprompt_jobs[job_id] = {"status": "error", "result": None, "error": f"Unexpected error: {e}"}

    threading.Thread(target=run_job, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/episode-prompts/status/{job_id}")
async def episode_prompts_status(job_id: str):
    job = _eprompt_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id.")
    return job
