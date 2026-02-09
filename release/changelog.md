# Changelog

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
