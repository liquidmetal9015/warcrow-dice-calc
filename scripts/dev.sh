#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root (one level up from this script)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Try to load nvm and use Node 20 if available
if [ -z "${NVM_DIR:-}" ]; then
  export NVM_DIR="$HOME/.nvm"
fi
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi
if command -v nvm >/dev/null 2>&1; then
  nvm use 20 >/dev/null 2>&1 || { nvm install 20 >/dev/null 2>&1 && nvm use 20 >/dev/null 2>&1; }
fi

echo "Using Node: $(node -v 2>/dev/null || echo 'not found')"
echo "Using npm:  $(npm -v 2>/dev/null || echo 'not found')"

npm run dev


