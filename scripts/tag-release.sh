#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required."
  exit 1
fi

VERSION="$(jq -r '.version' manifest.json)"
TAG="v${VERSION}"
PUSH="${1:-}"

if [[ "$VERSION" == "null" || -z "$VERSION" ]]; then
  echo "Error: Could not read version from manifest.json."
  exit 1
fi

if ! jq -e --arg version "$VERSION" '.version == $version' package.json >/dev/null 2>&1; then
  echo "Error: package.json version must match manifest.json version ($VERSION)."
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag already exists locally: $TAG"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  if REMOTE_TAGS="$(git ls-remote --tags origin "refs/tags/$TAG" 2>/dev/null || true)"; then
    if [[ -n "$REMOTE_TAGS" ]]; then
      echo "Error: Tag already exists on origin: $TAG"
      exit 1
    fi
  fi
fi

git tag -a "$TAG" -m "Release $TAG"
echo "Created tag: $TAG"

if [[ "$PUSH" == "--push" ]]; then
  git push origin "$TAG"
  echo "Pushed tag to origin: $TAG"
fi
