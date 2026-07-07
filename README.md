# Renovation Tracker

A React Native (Expo) app for house-restoration businesses. Track properties,
projects, per-room expenses, carrying costs (loans, interest, insurance,
property taxes), scan receipts with on-device OCR, itemize them into expenses,
and watch budgets on clean dashboards.

**All data lives on the device.** There is no external database, no account,
and no network dependency at runtime — storage is a local SQLite database plus
app-private image files.

## Features

- **Properties** — address & GPS coordinates, beds/baths, square footage, lot
  size, year built, type, status, purchase price/date, renovation budget,
  cover photo, notes.
- **Projects** per property — status, budget, start/end dates, with budget
  utilization bars computed from actual expenses.
- **Rooms/areas** per property — organize expenses by room and store
  **before / after / progress photos** with a full-screen viewer.
- **Expenses** — tied to a property, and optionally a project and room;
  categorized (materials, labor, permits, tools…), with vendor and date.
- **Carrying costs** — loan payments, interest, insurance, property taxes,
  utilities, HOA, closing costs; plus **loan records** (lender, principal,
  rate, term, payment) with a simple annual-interest estimate.
- **Receipt scanning** — photograph a receipt (or pick from the gallery); text
  is read **on-device with ML Kit OCR**, then a heuristic parser pre-fills
  vendor, date, total, and line items. Review, correct, assign to
  property/project/room, and every line item becomes an expense linked back to
  the stored receipt image.
- **Dashboards** — portfolio totals (all-in cost, renovation spend, carrying
  costs), per-property budget bars, category donuts, monthly spend chart, and
  recent activity.
- Light and dark mode.

## Tech stack

- Expo SDK 57 / React Native 0.86, TypeScript, expo-router
- expo-sqlite (local relational store, versioned migrations)
- @react-native-ml-kit/text-recognition (on-device Google ML Kit OCR)
- expo-image-picker + expo-file-system (photos persisted to app storage)
- react-native-svg (charts)

## Install on your phone (no tools needed)

Every push builds an APK on GitHub Actions and publishes it to the
[**latest** release](../../releases/latest):

1. On your Android phone, open the repo's **Releases** page and download
   `renovation-tracker.apk` (log in to GitHub if the repo is private).
2. Open the downloaded file and allow installing from your browser when
   Android asks.

You can also grab the APK from any run on the **Actions** tab (artifact
`renovation-tracker-apk`). Builds are debug-signed — fine for sideloading;
generate a proper keystore before any Play Store release.

## Running it

```bash
npm install

# Android (device or emulator) — builds a dev client with the native OCR module
npx expo run:android

# iOS (macOS only)
npx expo run:ios
```

> **Note on Expo Go:** the ML Kit OCR module is native code, so it is not
> available inside the Expo Go sandbox app. Everything else works in Expo Go
> (`npx expo start`), and receipt scanning degrades gracefully to manual
> itemization there. Use `npx expo run:android` (or an EAS development build)
> to get OCR.

### Release build (APK)

```bash
npx expo prebuild -p android   # generates the android/ project
cd android && ./gradlew assembleRelease
# APK at android/app/build/outputs/apk/release/
```

## Development

```bash
npm run typecheck   # strict TypeScript over the whole app
npm test            # vitest unit tests for the pure business logic
```

The receipt OCR parser (`src/lib/receiptParser.ts`), money handling
(`src/lib/money.ts`), and date parsing (`src/lib/dates.ts`) are pure modules
covered by unit tests. OCR output quality varies with receipt layout — the
review screen is designed so anything the parser misses is one tap to fix.

## Project layout

```
src/
  app/                    expo-router screens
    (tabs)/               Dashboard · Properties · Scan receipt
    property/ project/ room/ expense/ cost/ loan/ receipt/
  components/             theme, UI kit, forms, charts, photo grid
  lib/
    db/                   SQLite schema/migrations, typed repositories
    receiptParser.ts      OCR text → vendor/date/total/line items
    money.ts dates.ts     pure helpers (unit tested)
    images.ts ocr.ts      photo persistence, ML Kit wrapper
```

## Data model

`properties` → `projects`, `rooms`, `expenses`, `property_costs`, `loans`,
`receipts` (+ `receipt_items`), `room_photos`. Money is stored as integer
cents; dates as ISO `YYYY-MM-DD`. Deleting a property cascades to everything
under it; deleting a project or room keeps its expenses (the link is nulled).
