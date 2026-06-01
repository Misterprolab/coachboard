#!/bin/bash
set -e

# Install bun without sudo
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun &> /dev/null; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
fi

echo "Bun version: $(bun --version)"
bun install --frozen-lockfile
