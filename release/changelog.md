# Changelog

## 1.1.5
- Updated Firefox minimum versions for `data_collection_permissions` compatibility:
  - Desktop `gecko.strict_min_version` to `140.0`
  - Android `gecko_android.strict_min_version` to `142.0`
- Replaced unsafe `innerHTML` usage in popup definition rendering with safe DOM text rendering.
- Replaced `textarea.innerHTML` entity decoding in content script with explicit entity decoding.
- Replaced remaining static style injection from `innerHTML` to `textContent`.
- Added stricter manifest validation for Firefox desktop/android minimum version values.

## 1.1.4
- Added required Firefox data consent key: `browser_specific_settings.gecko.data_collection_permissions`.
- Added manifest validation check for Gecko `data_collection_permissions.required`.

## 1.1.3
- Added required Firefox MV3 add-on ID in `browser_specific_settings.gecko.id`.
- Added manifest validation check for required Gecko add-on ID.

## 1.1.2
- Switched release packaging output to `.xpi` to reduce AMO upload confusion.
- Updated GitHub Actions release workflow to upload/publish `.xpi` artifacts on tag builds.
- Added release tagging helper scripts and release checklist updates for consistent shipping.

## 1.1.0
- Added modernized in-page definition bubble UI with improved content separation.
- Added settings page for timeout, auto-close behavior, context menu toggle, and history size.
- Added outage fallback (retry + local cached definitions).
- Added subtle cached/offline status badge in the bubble header.
- Added extension icon set and manifest icon wiring.
- Tightened permissions and host access scope.
- Added CI workflow and unit tests for background parsing/fallback and content rendering helpers.
- Removed pronunciation audio feature for a simpler text-only experience.
