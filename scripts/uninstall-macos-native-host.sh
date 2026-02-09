#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/.local/share/awesome-dictionary-native"
MANIFEST_PATH="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/com.ramblingthinker.awesome_dictionary.json"

rm -f "$MANIFEST_PATH"
rm -rf "$INSTALL_DIR"

echo "Removed native host files and manifest."
echo "Restart Firefox to clear native host process state."
