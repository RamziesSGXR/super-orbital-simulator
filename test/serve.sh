#!/bin/sh
# Runs a command with the game served on port 8095 for as long as the command takes. Usage: sh test/serve.sh node test/ui.mjs http://localhost:8095
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8095 >/dev/null 2>&1 &
PID=$!
sleep 1
"$@"
CODE=$?
kill $PID 2>/dev/null
exit $CODE
