#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/macOS_native"
STAGE_DIR="/tmp/awesome-dictionary-native-dmg"
DMG_PATH="$DIST_DIR/awesome-dictionary-macos-native-installer.dmg"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: DMG packaging is macOS-only."
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "Error: hdiutil not found."
  exit 1
fi

mkdir -p "$DIST_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

cp "$ROOT_DIR/scripts/install-macos-native-host.sh" "$STAGE_DIR/Install Native Host.command"
cp "$ROOT_DIR/scripts/uninstall-macos-native-host.sh" "$STAGE_DIR/Uninstall Native Host.command"
cp -R "$ROOT_DIR/native/macos" "$STAGE_DIR/native"
cp "$ROOT_DIR/native/macos/SETUP.md" "$STAGE_DIR/SETUP.md"

chmod +x "$STAGE_DIR/Install Native Host.command" "$STAGE_DIR/Uninstall Native Host.command"

cat > "$STAGE_DIR/README.txt" <<'TXT'
Awesome Dictionary macOS Native Host Installer

1. Double-click "Install Native Host.command"
2. Restart Firefox completely
3. Reload the extension
4. In popup, click "Check macOS Native"

See SETUP.md for details.
TXT

rm -f "$DMG_PATH"
hdiutil create \
  -volname "AwesomeDictionaryNative" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH" >/dev/null

echo "Created DMG:"
echo "$DMG_PATH"
