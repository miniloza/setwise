# SETWISE · Personal Fitness Tracker

**Version 1.1.0 — offline-first installable iPad web app (PWA)**

A personal, no-subscription training journal that runs on your iPad. After the initial installation and offline files are cached, it can log workouts without an internet connection.

## What is included

- Choose Chest, Back, Shoulders, Arms, Legs, Core, or Full Body.
- Choose an exercise from a ready-to-use library; add your own machines and change target sets.
- Enter weight (kg) and reps with larger +/- controls, then **Save & next set** or **Save & next exercise**.
- After the first recorded set, display a repeating 2-minute rest countdown; it stops when the session ends and is **not saved** in workout history or backups. Because it is intentionally not saved, reopening the app resets the countdown.
- Compare current exercise training volume (sum of weight × repetitions) with the **average total volume** across the last five completed sessions, and see today’s average weight per set.
- See an estimated 6-repetition maximum calculated using the Epley equation from the strongest eligible 1–10 rep set in your recent five completed sessions or current workout. This is an approximation, *not* a mandatory lifting target.
- Get a next-set coaching cue and a next-workout target. A small load increase is suggested after two consecutive qualifying workouts (final set ≥8 reps at the same weight), with a ≤5% increment cap and estimated 6RM guardrail.
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
3. Unzip the downloaded `Setwise-Fitness-Tracker-v1.1.0.zip` package. In the repository, select **Add file → Upload files** and upload the app files at the root, keeping `icons/` as an `icons` folder. The files at the published repository root should include `index.html`, `app.js`, `db.js`, `progression.js`, `styles.css`, `sw.js`, `manifest.webmanifest` and `icons/`.
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
2. Download the updated Setwise package and unzip it.
3. Upload or replace the app files at the root of the **same** GitHub repository and published location (do not create another site or repository). Existing files with the same names should be replaced; add any new files such as `progression.js`. Do **not** upload your JSON backups.
4. Do not change the GitHub Pages URL, clear website data, uninstall the Home Screen app, or rename the database (`setwise-workouts`) as part of a routine update.
5. Open or relaunch Setwise while online, and reload if the previous version is still displayed. Verify that Settings shows Version 1.1.0 (an installed service worker may require another relaunch). Existing IndexedDB records stay separate from the website code.
6. If a future feature requires changing the data schema, implement and test a versioned database migration before deploying.

The URL/origin is part of the data's identity. Moving the app to another domain, even if the files are identical, will show a separate local database until you restore a JSON backup.

## File map

| File | Purpose |
| --- | --- |
| `index.html` | App entry point |
| `styles.css` | Tablet/mobile interface and appearance |
| `app.js` | Workout screens, navigation and calculations |
| `db.js` | Validated IndexedDB data model and storage; unchanged from v1.0 |
| `progression.js` | 6RM estimation, exercise average volume, coaching and countdown math |
| `sw.js` | Offline cache and app shell |
| `manifest.webmanifest` | iPad Home Screen app metadata |
| `icons/` | Installed app icons |
| `tests/test_logic.mjs` | Data-model and core workflow regression test |
| `tests/test_progression.mjs` | New maths, rest countdown and guidance regression test |

## Testing and scope

Automated tests completed for creation, set saving, finishing a session, history, insights, data reload, schema validation, refusal to accept corrupt set references, 6RM calculations, volume averages, progress targets and repeating timer mathematics.

**Known deployment limitation:** This environment could not run a full Safari-on-iPad acceptance test or a real-browser service-worker/Files share-sheet test. The application is supplied as a working first build, but those device-specific steps still need validation on the actual iPad after installation.

**Privacy:** The static source code can be public on GitHub Pages, but the app does not send workouts to GitHub. Workout information is in the browser's local IndexedDB and in any backups the user manually exports. Do not rely on IndexedDB as the only durable copy.

## Understanding the new training cues

- **Current volume**: all recorded sets for the exercise today, each weighted by its repetitions (kg × reps). **Previous average volume** is the mean of the same exercise's total session volume in up to five completed workouts.
- **Estimated 6RM**: uses the Epley equation `weight × (1 + reps / 30) / 1.2` from the largest implied six-rep performance among your recent working sets with 1–10 reps. Assumes a set taken close to muscular failure and similar equipment/technique. It can be wrong, sometimes substantially; do not use it as an unconditional load recommendation.
- **Next workout target**: starts with your last completed final set. When the last set contains at least 8 reps at the same load in two consecutive exercise workouts, the app can suggest a small increase of your configured weight increment, provided it is at most 5% and falls within the latest implied six-rep estimate. Otherwise the target focuses on repeating the weight and adding controlled reps. The strict '2-for-2 rule' is normally stated across two consecutive weeks; our app uses a conservative two-consecutive-session readiness indicator, so it is a coaching cue rather than an exact implementation of the weekly rule.
- **Next set**: if you complete at least 8 reps with the current set, a modest weight increase may be presented as an *option* for the next set, assuming form is good and the set was comfortable. Keeping or reducing weight is appropriate when fatigued.
- **Rest clock**: starts only after the first recorded set, rolls over every two minutes, and stops when the workout ends. It uses elapsed wall-clock time so tab throttling cannot make time run artificially slowly; background screen locking may delay the visual update until you reopen the app. No push notifications or sound. It does not appear in exported CSV/JSON.

## Sources for the calculations and progressive overload guidance

- Brzycki and Epley 1RM estimation approaches: https://assets-eu.researchsquare.com/files/rs-2165112/v1/74421c1e-8031-4243-872c-4487f75d72ea.pdf
- American College of Sports Medicine, *Progression Models in Resistance Training for Healthy Adults*: https://pubmed.ncbi.nlm.nih.gov/19204579/
- Human Performance Resources Center, NSCA/ACSM 2-for-2 rule: https://www.hprc-online.org/physical-fitness/training-performance/guidelines-progress-your-physical-training-over-time
