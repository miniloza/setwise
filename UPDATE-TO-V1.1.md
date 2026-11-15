# Update your installed Setwise app to 1.1

1. **Back up first:** Open Setwise → **Settings → Export full backup**. Save the `.json` file to **Files → On My iPad**. Check that it is actually present in Files before changing the website files.
2. Download `Setwise-Fitness-Tracker-v1.1.0.zip` and unzip it on your iPad or computer.
3. Open **the same GitHub repository** you used for v1.0. Replace the published application files in the repository root with the v1.1 files, preserving the `icons/` directory. Upload the **new `progression.js`** file too. Commit your changes. If GitHub's Upload Files screen refuses to overwrite existing files, update the files through your preferred Git client or GitHub's file editor; do not create a new repository/Pages URL.
4. Keep the **same GitHub Pages address**, and open Setwise while online. Close and reopen the Home Screen app as needed, allowing the service worker to refresh. In Settings, confirm it says **Version 1.1.0**.
5. Check **History**: your previous workouts should still be present. Start a new workout, save one set and verify the 2-minute timer, estimated 6RM, coaching card and average volume.

**Do not** uninstall the app, clear Safari website data, rename the Pages URL, or replace `db.js` with a different database design. Version 1.1 ships with exactly the same `db.js` as v1.0; the data schema remains version 1.

The timer is transient and resets when the app is closed or reloaded. Your saved workouts and exercise history do not reset. There is no audio or push notification when it reaches 0:00.
