# Setwise changelog

## v1.1.0 — 2026-11-15

- Added repeating 2-minute live rest timer after first set, stopping at workout finish; never stored in workout records.
- Increased +/- touch targets and font sizes on iPad/mobile.
- Added rolling historical average exercise volume and today's average working weight in the exercise panel.
- Added estimated six-rep load using Epley from recent eligible sets with cautious interpretation.
- Added conservative next-set encouragement and next-workout targets, including a two-session progression readiness signal.
- No database/schema changes; existing v1.0 workout records remain valid.
- Upgraded offline cache revision, and added `progression.js` to offline shell.

# Setwise changelog

## 1.0.0 — Initial release · 15 November 2026

- Offline-first PWA with installation manifest and service worker.
- Local, versioned IndexedDB workout database.
- Seven training groups and editable machine/exercise library.
- Set-level logging with previous-session and rolling five-session comparisons.
- Completed session history and correctable recorded sets.
- Strength trends and average weights/reps by set number.
- Manual JSON recovery backup and restore.
- Numbers-compatible CSV export.
- Automated regression coverage for the primary training flow.

**Safe-update policy:** Keep the same site origin and database name; back up before major updates; increment service worker cache version when shipping new code.
