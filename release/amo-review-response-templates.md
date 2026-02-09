# AMO Review Response Templates

Use these snippets when AMO asks for clarification.

## 1) Why do you need remote access?
This add-on is a dictionary tool and needs remote access to retrieve definitions from `https://api.dictionaryapi.dev/*`. Requests are user-initiated only (selected word or typed search).

## 1b) Why do you need `nativeMessaging`?
`nativeMessaging` is used only on macOS, and only when an optional local native host is installed by the user. It enables local dictionary lookups from the macOS Dictionary source. If unavailable, the add-on falls back to API lookup.

## 2) Why is `storage` permission required?
`storage` is used only for local extension functionality:
- settings (bubble behavior, context menu toggle, history size)
- lookup history
- cached definitions for temporary API outage fallback

## 3) Do you collect personal data or tracking analytics?
No. The add-on does not use accounts, tracking IDs, analytics SDKs, or advertising. It only sends queried words to the dictionary API to fetch definitions.

## 4) What data leaves the browser?
Only the word entered/selected by the user for lookup requests to `https://api.dictionaryapi.dev/*`.

## 5) What happens when the API is down?
The add-on retries briefly, then uses locally cached definitions when available. Cached responses are shown with an `Offline cache` indicator.
