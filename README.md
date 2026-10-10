# Stratus

**A blanket of stamps across the globe, one place at a time.**

Stratus is a local-first passport-stamp app. Modern travel rarely leaves an actual stamp in your passport anymore, so Stratus fills that void: search any country, state, landmark, or city and turn it into a personalized ink stamp, collected across pages just like a real passport. It is a plain HTML, CSS, and JavaScript app with no build step and no backend.

## Run it

Open [index.html](index.html) directly in a modern browser:

```sh
open index.html
```

The app can also be hosted as static files, but opening it through `file://` is the intended personal-use workflow.

## What it does

- Search any country, state, city, or landmark (via the free OpenStreetMap Nominatim API — no key required) and turn the result into a personalized ink stamp.
- Design each stamp: pick an ink color, a shape (circle, scallop, or visa-style rectangle), the date visited, and a short note.
- Collects stamps into passport pages, six to a page, newest first, with page-flip navigation.
- Tracks total stamps, countries, and continents visited (continents are resolved from a built-in offline lookup table, no network call needed).
- Works fully offline for manual entries via **Add Manually**; only live place search needs network access.
- Includes day/twilight/night themes, a built-in tutorial, and JSON export/import for backups.

## Data and privacy

Stratus stores its data only in the browser's `localStorage`; it does not send your data to a server. Export a JSON backup regularly from **Settings** before clearing browser storage or switching environments.

Place search is requested directly from the public OpenStreetMap Nominatim API — free, keyless, and client-side only.

## Project structure

- [index.html](index.html): the main app UI.
- [app.js](app.js): search, stamp generation, passport pages, and persistence.
- [styles.css](styles.css): application styling and themes.
- [tutorial.html](tutorial.html) and [tutorial.css](tutorial.css): standalone in-app tutorial.
- [manifest.webmanifest](manifest.webmanifest) and [icon.svg](icon.svg): installable-app metadata and icon.
