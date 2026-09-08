#!/bin/bash
# Serve the Script Studio static app (vanilla HTML/CSS/JS, ES modules).
set -e

cd "$(dirname "$0")"

APP_PORT="${APP_PORT:-3001}"

if [ -f /usr/local/lib/workshop-devguard.sh ]; then
    source /usr/local/lib/workshop-devguard.sh
    devguard_acquire "$APP_PORT"
fi

echo "Serving Script Studio on port $APP_PORT ..."
python3 -m http.server "$APP_PORT" --bind 0.0.0.0
