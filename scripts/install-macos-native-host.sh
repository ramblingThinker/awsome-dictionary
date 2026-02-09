#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NATIVE_DIR="$ROOT_DIR/native/macos"
INSTALL_DIR="$HOME/.local/share/awesome-dictionary-native"
HOST_NAME="com.ramblingthinker.awesome_dictionary"
MANIFEST_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/${HOST_NAME}.json"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: this installer is macOS-only."
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Error: xcrun is required. Install Xcode Command Line Tools first."
  exit 1
fi

mkdir -p "$INSTALL_DIR"
cp "$NATIVE_DIR/host.py" "$INSTALL_DIR/host.py"
cp "$NATIVE_DIR/dictionary_lookup.swift" "$INSTALL_DIR/dictionary_lookup.swift"

xcrun swiftc "$INSTALL_DIR/dictionary_lookup.swift" -o "$INSTALL_DIR/dictionary_lookup"
chmod +x "$INSTALL_DIR/host.py" "$INSTALL_DIR/dictionary_lookup"

mkdir -p "$MANIFEST_DIR"
cat > "$MANIFEST_PATH" <<JSON
{
  "name": "${HOST_NAME}",
  "description": "Awesome Dictionary macOS native host",
  "path": "${INSTALL_DIR}/host.py",
  "type": "stdio",
  "allowed_extensions": ["awesome-dictionary@ramblingthinker.github"]
}
JSON

echo "Installed native host:"
echo "  host files: $INSTALL_DIR"
echo "  manifest:   $MANIFEST_PATH"
echo
echo "Next: fully restart Firefox, reload the extension, then click 'Check macOS Native' in popup."
