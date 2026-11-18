# Setwise changelog

## 1.2.0 — 18 November 2026

- OLED-friendly true-black theme, light-grey typography, muted pastel-red accents, graphics and icons.
- Sticky workout header: weight, reps, current local time, two-minute repeating rest timer, target range, and Save & Next Set / Save & Next Exercise actions.
- Rest timer begins on first saved set, resets after **every** saved set and stops on Finish Workout. It is never stored, exported or synced.
- Larger weight and rep controls.
- Compact workout page: working-set ordinal average vs last comparable working set; optional RIR; immediate next-set coaching; collapsible set history.
- Separately log warm-up and working sets; warm-up sets excluded from strength, volume and working-set position comparisons. Old sets remain working sets for backwards compatibility.
- 3, 7 or more working sets accepted without a fixed cap; optional per-exercise planned set count still supported.
- Full Analytics page from stored workout history: Epley estimated 6RM/1RM, trend, top-set weight and session-volume charts, average working-set volume, next workout and warm-up suggestions.
- Optional bodyweight in Analytics and equipment-aware relative strength analysis. Machine load is *not* treated as a universal bodyweight strength standard.
- Exercise equipment type can be set in the exercise editor. New JSON backups and Numbers CSV include set types and RIR.
- IndexedDB name, object-store name, key and schema version **unchanged**, with optional field validation and legacy data conversion.
- Offline cache revision updated to v1.2.0.

## 1.1.0

- Live rest clock, larger +/- buttons, six-rep estimates and progression targets.

## 1.0.0

- Offline-first workout logging, local history, exercise management, JSON backup and CSV export.
