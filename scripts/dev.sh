#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  trap - INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM

echo "Starting backend on http://localhost:3001"
echo "Starting frontend on http://localhost:3000"
echo "Press Ctrl+C to stop both."

(cd "$ROOT/backend" && bun run dev) &
(cd "$ROOT/frontend" && bun run dev) &

wait
