# awsome-dictionary

Firefox extension for quick dictionary lookups from selected text or popup search.

## Features
- Double-click a word on any page to see a definition bubble.
- Right-click selected text and use `Define '%s'`.
- Search words from the popup.
- Stores recent lookup history locally.
- On macOS, can use a local native dictionary host first (with API fallback).
- Includes outage fallback: retries API calls and shows last saved definition when available.
- Includes a settings page for bubble timeout, auto-close behavior, context menu, and history size.

## Local development
1. Install Node.js 20+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run checks:
   ```bash
   npm run check
   ```
4. Create Firefox upload package:
   ```bash
   npm run package:firefox
   ```

## Scripts
- `npm run lint`: runs ESLint against all JavaScript files.
- `npm run test`: runs manifest validation and unit tests for background and content behavior.
- `npm run check`: runs lint and test in sequence.
- `npm run package:firefox`: builds the AMO upload `.xpi` in `dist/`.
- `npm run package:macos-native`: builds macOS native host installer `.dmg` in `dist/macOS_native/`.
- `npm run ship:firefox`: runs checks, then builds the AMO upload `.xpi`.
- `npm run release:tag`: creates `v<manifest version>` git tag.
- `npm run release:tag:push`: creates and pushes `v<manifest version>` git tag.
- `bash ./scripts/install-macos-native-host.sh`: installs macOS native dictionary host for Firefox.
- `bash ./scripts/uninstall-macos-native-host.sh`: removes macOS native dictionary host files.

## Load in Firefox
1. Open `about:debugging`.
2. Click `This Firefox`.
3. Click `Load Temporary Add-on...`.
4. Select `/Users/ramblingthinker/Documents/Github/awsome-dictionary/manifest.json`.

## Settings
- Open the popup and click `Settings`, or open extension preferences from `about:addons`.

## macOS native setup
- Setup guide: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/native/macos/SETUP.md`
- Host source: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/native/macos/host.py`
- Dictionary helper source: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/native/macos/dictionary_lookup.swift`

## Privacy
- Stored locally in extension storage:
  - lookup history (recent searched words)
  - cached definitions (for outage fallback)
  - settings (timeout, auto-close, context menu, history size)
- Sent over network:
  - only queried words needed for dictionary lookup requests to `https://api.dictionaryapi.dev`
- Optional local integration:
  - on macOS, if native host `com.ramblingthinker.awesome_dictionary` is installed, lookups can be resolved locally via Native Messaging before API fallback.
- The extension does not require user accounts and does not intentionally collect personal identity data.

## License
This project is licensed under the MIT License. See `/Users/ramblingthinker/Documents/Github/awsome-dictionary/LICENSE`.

## Release assets
- AMO description: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/release/amo-description.md`
- Changelog: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/release/changelog.md`
- Screenshots list: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/release/screenshots.md`
- Reviewer notes: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/release/amo-review-notes.md`
- Reviewer reply templates: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/release/amo-review-response-templates.md`
- macOS native installer DMG: `/Users/ramblingthinker/Documents/Github/awsome-dictionary/dist/macOS_native/awesome-dictionary-macos-native-installer.dmg`

## Thanks
Special thanks to the creator of [Free Dictionary API](https://github.com/meetDeveloper/freeDictionaryAPI/tree/master), which powers the core dictionary lookups in this project.
