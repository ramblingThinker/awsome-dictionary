# firefox-dictionary-ext

Firefox extension for quick dictionary lookups from selected text or popup search.

## Features
- Double-click a word on any page to see a definition bubble.
- Right-click selected text and use `Define '%s'`.
- Search words from the popup.
- Stores recent lookup history locally.
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

## Scripts
- `npm run lint`: runs ESLint against all JavaScript files.
- `npm run test`: runs manifest validation and unit tests for background and content behavior.
- `npm run check`: runs lint and test in sequence.

## Load in Firefox
1. Open `about:debugging`.
2. Click `This Firefox`.
3. Click `Load Temporary Add-on...`.
4. Select `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/manifest.json`.

## Settings
- Open the popup and click `Settings`, or open extension preferences from `about:addons`.

## Privacy
- Stored locally in extension storage:
  - lookup history (recent searched words)
  - cached definitions (for outage fallback)
  - settings (timeout, auto-close, context menu, history size)
- Sent over network:
  - only queried words needed for dictionary lookup requests to `https://api.dictionaryapi.dev`
- The extension does not require user accounts and does not intentionally collect personal identity data.

## License
This project is licensed under the MIT License. See `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/LICENSE`.

## Release assets
- AMO description: `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/release/amo-description.md`
- Changelog: `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/release/changelog.md`
- Screenshots list: `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/release/screenshots.md`
- Reviewer notes: `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/release/amo-review-notes.md`
- Reviewer reply templates: `/Users/ramblingthinker/Documents/Github/firefox-dictionary-ext/release/amo-review-response-templates.md`

## Thanks
Special thanks to the creator of [Free Dictionary API](https://github.com/meetDeveloper/freeDictionaryAPI/tree/master), which powers the core dictionary lookups in this project.
