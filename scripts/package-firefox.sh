#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/manifest.json"
DIST_DIR="$ROOT_DIR/dist"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to read manifest version."
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip is required to create Firefox upload artifact."
  exit 1
fi

NAME="$(jq -r '.name' "$MANIFEST" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
VERSION="$(jq -r '.version' "$MANIFEST")"
ARTIFACT="$DIST_DIR/${NAME}-${VERSION}-firefox.zip"

mkdir -p "$DIST_DIR"
rm -f "$ARTIFACT"

(
  cd "$ROOT_DIR"
  zip -r "$ARTIFACT" \
    manifest.json \
    background.js \
    content.js \
    popup.html \
    popup.js \
    options.html \
    options.js \
    icons \
    -x "*.DS_Store"
)

echo "Created Firefox artifact:"
echo "$ARTIFACT"
