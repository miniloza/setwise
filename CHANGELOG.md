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
