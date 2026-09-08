#!/bin/bash
# Start Showrunner Studio: FastAPI backend + Vite/React frontend.
set -e

cd "$(dirname "$0")"

export APP_PORT="${APP_PORT:-3001}"
export BACKEND_PORT="$((APP_PORT + 100))"

if [ -f /usr/local/lib/workshop-devguard.sh ]; then
    source /usr/local/lib/workshop-devguard.sh
    devguard_acquire "$APP_PORT" "$BACKEND_PORT"
fi

# Backend
(
  cd backend
  uv sync --quiet
  uv run uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
) &
BACKEND_PID=$!

# Frontend
(
  cd frontend
  if [ ! -d node_modules ]; then npm install; fi
  npm run dev -- --strictPort
) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
