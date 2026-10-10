# Stratus — agent context / project memory

This file is a checked-in snapshot of the working context built up while developing this
app with an AI coding agent. If you're an agent picking up this repo in a new session (or
the user lost their chat history), **read this whole file first** — it explains what's
been built, why, and non-obvious details worth knowing before changing anything.

## What this is
- A personal passport-stamp app, built incrementally via live browser preview, one small
  feature/request at a time.
- Named "Stratus". Header `h1.app__title` = "Stratus", `p.app__subtitle` = "A blanket of
  stamps across the globe, one place at a time.". `<title>` = Stratus.
- Origin story: the user travels a lot (lately in Europe) and noticed passports rarely get
  physically stamped anymore. Stratus fills that void digitally — search a country, state,
  landmark, or city, and generate a personalized ink-stamp graphic for it, collected into
  passport-style pages.
- Intent: a DYNAMIC, never-"final" tool that keeps evolving as the user uses it. Purely
  personal use, not a product.
- **Design Inspiration & Sister Apps:** Cumulus (personal finance), Cirrus (movie tracker),
  and Nimbus (to-do/agenda) share the same sky/cloud design language (drifting clouds,
  day/twilight/night themes, frosted-glass cards, no-build vanilla HTML/CSS/JS stack).
  Stratus follows the same conventions but renders its sky as flat, full-width, layered
  cloud bands (`.cloud-band`) — a blanket deck, unlike Cumulus's puffy lobes, Cirrus's wispy
  streaks, or Nimbus's storm clouds — to visually match its name, plus a drifting plane
  (`.plane`) for travel flavor instead of a lighthouse/coast scene.

## Where it lives
- This repo IS the app folder. Files: `index.html`, `styles.css`, `app.js`,
  `tutorial.html`, `tutorial.css`, plus `icon.svg` and `manifest.webmanifest`. Plain
  vanilla HTML/CSS/JS, no build step, no framework, no bundler.
- Runs by opening `index.html` directly (`file://`), or any static host. Data persists in
  the browser's localStorage — there is NO backend, NO server, NO build step.
- `build/` is a lagging deployment snapshot mirror of the shipped files, only updated at
  release time (see "Build/release process" below) — not every commit.

## Data model (localStorage keys)
- `stratus.stamps` — array of stamp objects:
  `{id, name, type, countryCode, lat, lon, dateVisited (yyyy-mm-dd), note, ink, shape,
  createdAt}`
  - `type` is one of `country` / `state` / `city` / `landmark` / `nature` / `other`,
    inferred from Nominatim's `addresstype`/`class` fields when added via search
    (`inferType()`), or picked manually in the "Add Manually" flow.
  - `countryCode` is a 2-letter ISO code (uppercased), used for the flag emoji
    (`flagEmoji()`) and the Continents stat. Optional — state/landmark/city stamps may
    still have one if the search result's `address.country_code` resolved.
  - `ink` is a key into the `INKS` palette in `app.js` (navy/crimson/forest/plum/
    sepia/charcoal). `shape` is `circle` / `scallop` / `rect`.
- `stratus.theme` — `"day"`, `"twilight"`, `"night"`, or `"random"` (same atmosphere scheme
  as Cumulus/Cirrus/Nimbus).

## External APIs (client-side only, CORS-enabled, no backend/proxy, no keys)
- **OpenStreetMap Nominatim** (`nominatim.openstreetmap.org/search`) — free-text place
  search (countries, states, cities, landmarks). No API key. Debounced 500ms on input to
  stay well under its shared-usage rate limit (~1 req/sec) — see `searchPlaces()`. Search
  results attribution is shown under the search box per OSM's usage policy; don't remove
  it.
- The Continents stat is resolved from a static ISO2-to-continent table baked into
  `app.js` (`CONTINENT_BY_CODE`), not a network call. **Do not** reintroduce the free
  REST Countries API for this — its unauthenticated `v1`–`v4` endpoints were deprecated in
  favor of a paid-key `v5` (confirmed Oct 2026); the static table is deliberate, not a
  placeholder.

## Stamp rendering (`stampSvg()` in app.js)
- Generates a self-contained inline `<svg>` per stamp. Every `<defs>` id (arc paths, grain
  filter) is suffixed with the stamp's own id (`uid`) specifically because multiple stamps
  render simultaneously on one passport page — hardcoded ids would collide across stamps
  and break `textPath` references. Any new shape/variant must keep this per-stamp id
  suffixing.
- Three shapes: `circle` (dashed outer ring + curved top/bottom text via `textPath` arcs),
  `scallop` (same but outer ring is a wavy/scalloped closed path from
  `scallopCirclePath()`), `rect` (visa-style rectangle, straight stacked text lines, no
  arcs).
- A `feTurbulence`/`feColorMatrix`/`feComposite` grunge filter is applied to every shape so
  ink looks hand-stamped rather than vector-perfect; the turbulence `seed` is derived from
  a hash of the stamp id (`hashSeed()`) so each stamp's texture is stable but distinct.
- Center icon is the country's flag emoji (from `countryCode` via `flagEmoji()`) when
  available, else a type-based emoji (`typeIcon()`).

## Build/release process
Same flow as Cumulus/Cirrus/Nimbus:
1. Confirm on `develop` (once that branch model is adopted here — repo started on `main`
   via a direct clone, so check current branch conventions before assuming `develop`
   exists).
2. Bump the static asset version (`?v=` query strings in `index.html`/`tutorial.html` +
   the about-modal "Version …" text), format `YYYY.MM.DD.N` — bump `N` or start a new date.
3. Sync the `build/` mirror:
   `cp app.js index.html styles.css tutorial.html tutorial.css manifest.webmanifest build/`
4. Commit as `Release Stratus <version>`, push.
5. If using a `develop`/`main` split like the sister apps, merge into `main` with a regular
   merge (`git merge develop -m "Merge develop for Stratus <version>"`), push `main`, switch
   back to `develop`.

## Conventions carried over from Cumulus/Cirrus/Nimbus
- Modal toggling: `.modal` (hidden) / `.modal.open` (shown), closed on backdrop click.
- Theme script in `<head>` sets `html.dark`/`html.night`/`html.twilight` synchronously
  before first paint to avoid a flash of the wrong theme.
- `#app-version` header badge is mirrored from `.about-modal__version` text via a small JS
  snippet at the bottom of `app.js`, so the version is only ever typed in one place.
- Export/Import JSON in Settings for manual backups (no accounts, no sync).
