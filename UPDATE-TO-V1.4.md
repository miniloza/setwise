# Setwise v1.4.0 installation

1. In your current Setwise app, open **Settings → Export full backup** and save the file to iPad **Files**.
2. Replace the files in your **existing** GitHub Pages repository at the same URL. Do **not** delete browser storage, remove the Home Screen app, or rename the repository.
3. The new `strength-target.js`, `exercise-order.js`, and `icons/*.png` files must be included alongside the updated `app.js`, `styles.css`, and `sw.js`.
4. Reopen Setwise with internet access to cache v1.4.0, then check **Settings → About Setwise** for version 1.4.0.
5. Confirm your previous sessions are still present before recording another workout.

The app uses the same IndexedDB database name and schema as v1.3.0. An update of the code on the same web origin should leave your existing records intact. The backup protects against unexpected device/browser storage loss.

8-rep recommendations are approximate. They use the Epley equation on challenging full repetitions and the best qualifying working set among the last eight completed exercise sessions and the current session. Half reps are not converted into full reps. Do not force a predicted load if it does not feel controlled.
