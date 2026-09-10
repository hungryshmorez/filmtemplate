#!/bin/bash
# Repo entrypoint → Showrunner Studio (FastAPI backend + Vite/React frontend).
# The launcher lives in showrunner-studio/start.sh; this just delegates to it so
# `./start.sh` from the repo root still works. The old "Script Studio" prototype
# has been removed.
set -e
exec "$(dirname "$0")/showrunner-studio/start.sh" "$@"
