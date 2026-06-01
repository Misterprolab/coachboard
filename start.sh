#!/bin/bash
# Find bun wherever it is
export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:$PATH"

if command -v bun &> /dev/null; then
  echo "Using bun at: $(which bun)"
  cd packages/web && bun src/server.ts
else
  echo "bun not found, falling back to node..."
  # Install bun on start if not present
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  cd packages/web && bun src/server.ts
fi
