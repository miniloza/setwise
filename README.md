# SETWISE · Personal Fitness Tracker

**Version 1.0.0 — offline-first installable iPad web app (PWA)**

A personal, no-subscription training journal that runs on your iPad. After the initial installation and offline files are cached, it can log workouts without an internet connection.

## What is included

- Choose Chest, Back, Shoulders, Arms, Legs, Core, or Full Body.
- Choose an exercise from a ready-to-use library; add your own machines and change target sets.
- Enter weight (kg) and reps, then **Save & next set** or **Save & next exercise**.
- See the exact set number from your most recent completed session, plus the last 5 sessions' average for that set number.
- View sets recorded in the current workout; edit errors or delete the most recent set.
- Finish sessions and inspect past workouts; correct saved sets.
- Follow best weights across sessions and see average performance for each set number.
- Export a `.csv` file that opens in Apple Numbers.
- Export a complete `.json` backup; restore it later if required.
- Local IndexedDB workout database; no account, no subscription, no third-party requests in the app.

## Installation on iPad (one-time internet connection)

**The downloadable ZIP is source code, not an app-store installation file.** It must be hosted at an HTTPS address once, so Safari can install it as an app and cache it for later offline use.

### Free option: GitHub Pages

1. Create a free GitHub account if you do not already have one: https://github.com/.
2. Create a new **public** repository named `setwise` with an empty initial repository. (GitHub Pages on the free plan requires public source code; workout data is not part of the repository.)
3. Unzip the downloaded `setwise-v1.zip` package. In the repository, select **Add file → Upload files** and upload the app files at the root, keeping `icons/` as an `icons` folder. The files at the published repository root should include `index.html`, `app.js`, `db.js`, `styles.css`, `sw.js`, `manifest.webmanifest` and `icons/`.
4. Commit the upload.
5. In GitHub repository **Settings → Pages**, under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
6. Open `https://YOUR_GITHUB_USERNAME.github.io/setwise/` in **Safari on the iPad**. Replace `YOUR_GITHUB_USERNAME` with your account username.
7. In Safari, tap **Share → Add to Home Screen**, turn on **Open as Web App**, then **Add**.
8. Launch Setwise from your Home Screen while connected to the internet once, to allow its offline app files to cache. Afterwards, the workout tracker works offline.

Do not upload a JSON backup or a CSV containing your workouts to a public repository. Those files are personal and should stay in your iPad's **Files** app.

### Testing locally on a computer

From this source folder, run:

```sh
python -m http.server 8000
```

Visit `http://localhost:8000/` in a local browser. `file://` alone is not a supported deployment because service workers require a secure origin (HTTPS or localhost).

## Back up your history

In Setwise choose **Settings → Export full backup**, then save the `.json` file in **Files → On My iPad** or another protected location. Use **Settings → Choose backup file** to restore. Restoring is deliberately a **replace operation** to avoid silently mixing unrelated workout histories.

For Numbers, choose **Settings → Export Numbers CSV**, save/open the `.csv` file, then import it into Numbers. It is a point-in-time export, not a live `.numbers` database connection.

**Important:** Browser/app data can be removed by device/system cleanup, clearing Safari website data, or resetting the device. Backups are essential. The app does not automatically sync them to Files.

## Updating without wiping workouts

1. Export a JSON recovery backup first.
2. Ask for a new Setwise version or edit the source code.
3. Upload only the updated application files to the **same** GitHub repository and published location.
4. Do not change the GitHub Pages URL, clear website data, uninstall the Home Screen app, or rename the database (`setwise-workouts`) as part of a routine update.
5. Relaunch when online to receive updated files. Existing IndexedDB records stay separate from the website code.
6. If a future feature requires changing the data schema, implement and test a versioned database migration before deploying.

The URL/origin is part of the data's identity. Moving the app to another domain, even if the files are identical, will show a separate local database until you restore a JSON backup.

## File map

| File | Purpose |
| --- | --- |
| `index.html` | App entry point |
| `styles.css` | Tablet/mobile interface and appearance |
| `app.js` | Workout screens, navigation and calculations |
| `db.js` | Validated IndexedDB data model and storage |
| `sw.js` | Offline cache and app shell |
| `manifest.webmanifest` | iPad Home Screen app metadata |
| `icons/` | Installed app icons |
| `tests/test_logic.mjs` | Data-model and core workflow regression test |

## Testing and scope

Automated tests completed for creation, set saving, finishing a session, history, insights, data reload, schema validation and refusal to accept corrupt set references.

**Known deployment limitation:** This environment could not run a full Safari-on-iPad acceptance test or a real-browser service-worker/Files share-sheet test. The application is supplied as a working first build, but those device-specific steps still need validation on the actual iPad after installation.

**Privacy:** The static source code can be public on GitHub Pages, but the app does not send workouts to GitHub. Workout information is in the browser's local IndexedDB and in any backups the user manually exports. Do not rely on IndexedDB as the only durable copy.
