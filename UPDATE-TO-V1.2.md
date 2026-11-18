# Setwise v1.2.0 — update existing iPad installation

**Back up your workouts before making any change.** Open Setwise > Settings > Export full backup and save the JSON file to **On My iPad** in the Files app. Do not delete the installed app or clear website data.

## Update the app files

1. Download `Setwise-Fitness-Tracker-v1.2.0.zip` and unzip it in Files.
2. Open your existing GitHub repository that hosts Setwise on GitHub Pages. Do **not** create a new repository or move the site URL: a new website origin would have different local storage.
3. Replace these files at the same repository paths: `app.js`, `analytics.js` (new), `db.js`, `progression.js`, `styles.css`, `index.html`, `sw.js`, `manifest.webmanifest`, `icons/icon-192.png`, `icons/icon-512.png`. Keep the `icons/` directory structure. Updating README and CHANGELOG is optional.
4. Commit the changes to the branch already used by GitHub Pages. Wait for the Pages deployment to show success. Reopen your usual Setwise Home Screen icon while online and refresh once or twice if needed to pick up the new service worker cache.
5. In Setwise > Settings verify **Version 1.2.0**. Verify an older completed workout remains visible in History and Analytics. Only after confirming that should you record a new workout.

You do **not** need to uninstall Setwise or re-add its Home Screen icon if the website address stays identical.

## Data safety

- All workout sets continue to reside in IndexedDB on your iPad. Updating source files does not deliberately clear IndexedDB.
- Schema ID remains `1`; old records gain defaults for optional fields: `kind = working`, `rir = null`, `bodyweightKg = null`.
- Backups made with v1.0/v1.1 can still be restored. New backups include new fields.
- Website storage can be cleared by iPadOS or user actions, so keep regular backups in Files (ideally a second copy).
- Rest timer is temporary and will restart if the app is completely reloaded during a workout.

## Reading the new Analytics screen

- All charts are derived from completed working sets, not demonstration values.
- Estimated 1RM and 6RM use the Epley formula on eligible sets of 1–10 reps. They are estimates, not safe-load guarantees.
- Input bodyweight into Analytics to see a relative 1RM ratio; for machines the ratio is descriptive only, not a universal strength standard.
- Short or missing histories may result in no trend or cautious goals.

If you accidentally move to a different website address, your old iPad history remains attached to the original address. Return to that address and export a backup from there before changing sites.
