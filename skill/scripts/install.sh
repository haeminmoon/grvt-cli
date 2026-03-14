#!/usr/bin/env bash
set -euo pipefail

echo "Installing grvt-cli..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js >= 20 is required but not found."
  echo "Install Node.js from https://nodejs.org/"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node.js >= 20 is required. Found: $(node --version)"
  exit 1
fi

npm install -g @2oolkit/grvt-cli

echo ""
echo "grvt-cli installed successfully!"
echo ""
echo "Run 'grvt-cli config init' to set up your API credentials."
