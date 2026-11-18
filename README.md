# Setwise Fitness Tracker

Current packaged build: **v1.3.0**

This release adds:
- Tiffany blue OLED theme
- editable / resumable sessions
- current bodyweight with dated history
- adjustable rest timer
- Working set / Warm-up / Drop set logging
- half-rep tracking
- body-part overview analytics with exercise detail

# Setwise 1.2.0 — Personal Fitness Tracker

A private, offline-first workout tracker for iPad. Pure black / light grey / pastel red theme.

**IMPORTANT:** Before updating an already installed Setwise app, export your JSON backup from Settings. **Keep the same GitHub Pages site address.** See `UPDATE-TO-V1.2.md` for steps.

## Features

- Record exercise, machine, weight and rep count, optionally set type (warm-up or working) and RIR (repetitions in reserve).
- Large, compact, sticky workout header with current time, changing 2-minute rest countdown, target range and Save & Next Set / Save & Next Exercise actions.
- View your last corresponding working set and the recent average for that working set position.
- See concise coaching for your next set; detailed Analytics is a separate tab.
- Analytics: estimated 6RM and 1RM, trends, best effort, bodyweight-relative strength ratio, next-workout recommendations, warm-up suggestions, session and per-set volume, and variable set counts.
- Customise / archive exercises, planned sets and equipment type. Retain past records.
- Export Numbers-compatible CSV and full JSON backups; import an earlier full backup.
- After the initial install and cache, the app works without internet. No account or cloud database.

## Install fresh (GitHub Pages)

1. Create a GitHub repository and upload all the files from this archive to its root (keeping the `icons/` folder).
2. Under Settings > Pages, configure Pages to deploy from the branch containing `index.html` and the repository root.
3. On iPad open the published HTTPS Pages address in Safari. Use Share > Add to Home Screen.
4. Open Setwise from the new Home Screen icon while internet is available so the service worker can cache the app. Thereafter the cached app works offline.
5. In Settings, export JSON backups regularly to iPad Files.

## Maintenance / upgrades

Keep the app files and IndexedDB data separate. Changes to the application source and offline cache do not deliberately erase your existing IndexedDB. Do not rename the website origin, database name `setwise-workouts`, store `documents`, or key `main` without an explicit migration. A v1.0/v1.1 backup remains readable by v1.2.

To update, upload replacement source files to your existing GitHub Pages repository and refresh the existing Home Screen app. Updating the web files is different from importing a JSON backup; never restore a backup unless you intend to replace current local records.

## Strength and training metrics

- Volume: sum of `weight × reps`, measured in kg-repetitions (not an absolute strength score). Warm-up sets excluded from Analytics volume.
- Average volume per working set: volume divided by the number of working sets; track alongside reps and loads.
- Epley: estimated 1RM = weight × (1 + reps/30); estimated 6RM = estimated 1RM / 1.2. Restricted to eligible 1–10-rep working sets. Technique and RIR affect accuracy.
- Bodyweight ratio: estimated 1RM divided by current bodyweight. This is descriptive; different machines cannot be compared directly to a universal bodyweight strength requirement.
- Progression: only suggests a small load increase when recent first working sets have reached 10 reps twice, with adequate RIR when recorded and the configured increment no greater than 5% of the working weight. Otherwise build reps or maintain weight.
- Warm-up plan: illustrative 50% × 8 and 75% × 4 of next working load, rounded to the configured increment, not a required strength test.

## Local privacy and limitations

Data stays in browser IndexedDB on your device (unless you explicitly export/share it). iPadOS may evict website data: back up in Files periodically. Offline support requires successfully installing/cache priming the HTTPS site. A full reload during a workout resets the temporary rest timer. This is a personal fitness log and not a medical or certified coaching device.

## Developer tests (Node.js 22+)

Run in source folder:

```bash
node --experimental-default-type=module tests/test_logic.mjs
node --experimental-default-type=module tests/test_progression.mjs
node --experimental-default-type=module tests/test_v12.mjs
```
