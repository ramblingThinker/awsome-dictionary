#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/manifest.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required for manifest validation."
  exit 1
fi

echo "Validating manifest structure..."
jq -e '.manifest_version == 3' "$MANIFEST" >/dev/null
jq -e '.background.scripts | type == "array" and length > 0' "$MANIFEST" >/dev/null
jq -e '.action.default_popup | type == "string" and length > 0' "$MANIFEST" >/dev/null
jq -e '.icons | type == "object" and length > 0' "$MANIFEST" >/dev/null
jq -e '.options_ui.page | type == "string" and length > 0' "$MANIFEST" >/dev/null
jq -e '.browser_specific_settings.gecko.id | type == "string" and length > 0' "$MANIFEST" >/dev/null
jq -e '.browser_specific_settings.gecko.strict_min_version | type == "string" and length > 0' "$MANIFEST" >/dev/null
jq -e '.permissions | index("contextMenus")' "$MANIFEST" >/dev/null
jq -e '.permissions | index("storage")' "$MANIFEST" >/dev/null
jq -e '.host_permissions | index("https://api.dictionaryapi.dev/*")' "$MANIFEST" >/dev/null
jq -e '.content_scripts[0].matches | index("http://*/*")' "$MANIFEST" >/dev/null
jq -e '.content_scripts[0].matches | index("https://*/*")' "$MANIFEST" >/dev/null

DEFAULT_POPUP="$(jq -r '.action.default_popup' "$MANIFEST")"
OPTIONS_PAGE="$(jq -r '.options_ui.page' "$MANIFEST")"

while IFS= read -r background_js; do
  if [[ ! -f "$ROOT_DIR/$background_js" ]]; then
    echo "Error: background script file not found: $background_js"
    exit 1
  fi
done < <(jq -r '.background.scripts[]?' "$MANIFEST")

if [[ ! -f "$ROOT_DIR/$DEFAULT_POPUP" ]]; then
  echo "Error: popup file not found: $DEFAULT_POPUP"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/$OPTIONS_PAGE" ]]; then
  echo "Error: options page file not found: $OPTIONS_PAGE"
  exit 1
fi

while IFS= read -r content_js; do
  if [[ ! -f "$ROOT_DIR/$content_js" ]]; then
    echo "Error: content script file not found: $content_js"
    exit 1
  fi
done < <(jq -r '.content_scripts[]?.js[]?' "$MANIFEST")

while IFS= read -r icon_file; do
  if [[ ! -f "$ROOT_DIR/$icon_file" ]]; then
    echo "Error: icon file not found: $icon_file"
    exit 1
  fi
done < <(jq -r '.icons[]?, .action.default_icon[]?' "$MANIFEST")

echo "Manifest validation passed."
