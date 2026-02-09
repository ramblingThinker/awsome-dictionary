# AMO Reviewer Notes

## Add-on purpose
Awesome Dictionary provides quick dictionary definitions for user-selected words on webpages and from the toolbar popup.

## Remote requests
- The add-on performs dictionary lookups against:
  - `https://api.dictionaryapi.dev/*`
- Requests are only made when the user explicitly searches a word or selects text for lookup.
- No background analytics or tracking requests are performed.

## Permission justification
- `contextMenus`
  - Required to show the `Define '%s'` context menu item on selected text.
- `storage`
  - Required for local persistence of:
    - user settings
    - lookup history
    - cached definitions used for outage fallback
- `host_permissions: https://api.dictionaryapi.dev/*`
  - Required to fetch dictionary definitions from the selected API provider.

## Data handling and privacy
- Stored locally in browser extension storage:
  - recent lookup history
  - cached definitions
  - user settings
- Sent over network:
  - only the queried word string needed to retrieve a definition
- Not collected:
  - account data
  - personal identity/profile data
  - analytics/tracking identifiers
- No account/login is required to use this add-on.

## Outage behavior
- If the dictionary API is unavailable, the add-on may show a previously cached local definition for that word.
- Cached results are marked in the UI with an `Offline cache` badge.
