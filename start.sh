#!/bin/bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
cd packages/web && bun src/server.ts
