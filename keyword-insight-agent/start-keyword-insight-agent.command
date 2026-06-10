#!/bin/sh
cd "$(dirname "$0")/.."
NODE_EXE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ ! -x "$NODE_EXE" ]; then
  NODE_EXE="node"
fi
if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:8766/keyword-insight-agent/insight-agent.html"
fi
"$NODE_EXE" "$(pwd)/naver-keyword-server.mjs"
