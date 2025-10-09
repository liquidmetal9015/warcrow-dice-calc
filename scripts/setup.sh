#!/usr/bin/env bash
set -euo pipefail

# Project root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[setup] Starting project setup in $REPO_ROOT"

# Install or load nvm, then use Node 20
if ! command -v nvm >/dev/null 2>&1; then
  echo "[setup] nvm not found; installing nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
else
  if [ -z "${NVM_DIR:-}" ]; then export NVM_DIR="$HOME/.nvm"; fi
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm install 20 >/dev/null 2>&1 || true
  nvm use 20 >/dev/null 2>&1 || true
fi

echo "[setup] Using Node: $(node -v 2>/dev/null || echo 'not found')"
echo "[setup] Using npm:  $(npm -v 2>/dev/null || echo 'not found')"

echo "[setup] Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "[setup] Running unit tests..."
npm run test

cat <<'EON'

[setup] Done.

Common next steps:
  - Start dev server:   ./scripts/dev.sh
  - Run tests anytime:  ./scripts/test.sh

If your shell doesn't auto-load nvm, run before commands:
  export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

EON


