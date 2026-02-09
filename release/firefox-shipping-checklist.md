# Firefox Shipping Checklist

Use this checklist before each AMO submission.

## 1) Preflight
1. Bump `manifest.json` version.
2. Update `release/changelog.md`.
3. Install dependencies (if needed): `npm install`.

## 2) Quality gate
1. Run `npm run ship:firefox`.
2. Confirm zip artifact exists in `dist/` and includes only extension runtime files.

## 3) AMO listing assets
1. Summary + long description: `release/amo-description.md`.
2. Reviewer notes: `release/amo-review-notes.md`.
3. Reviewer response templates: `release/amo-review-response-templates.md`.
4. Screenshots list: `release/screenshots.md`.

## 4) AMO submit
1. Go to [addons.mozilla.org](https://addons.mozilla.org/) developer hub.
2. Upload `dist/awesome-dictionary-<version>-firefox.zip`.
3. Paste store description and reviewer notes from `release/`.
4. Submit for review.

## 5) Post-submit
1. Track reviewer feedback and respond using templates in `release/amo-review-response-templates.md`.
2. Tag release in git after approval.
