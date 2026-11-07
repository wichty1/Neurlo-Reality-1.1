# Neurlo — personal Life OS

A private, local-first web app that tracks every area of your life, with a 3D brain as the home page.

- **Private:** everything is stored only in your browser (IndexedDB). There are no accounts, servers, analytics, CDNs or web fonts, and the app makes no network requests to other sites. A Content-Security-Policy in `index.html` blocks them even by accident.
- **Free:** only open-source npm packages (Vite, TypeScript, three.js, idb).
- **Works offline** once it has been opened over http(s) (a service worker caches the app), and can be installed as an app from the browser menu.

## Areas

Home (3D brain), Today, Schedule, Health, Skin Care, Hair Care, Mind & Feelings, Habits & Goals, Work, Job Search, Money, People, Wants & Wishes, Notes, and Settings & Data.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer (only to build; the app itself needs nothing).

```bash
npm install        # once
npm run dev        # development server, prints a local URL (usually http://localhost:5173)
```

## Build a static copy

```bash
npm run build      # type-checks, then writes the finished app to dist/
npm run preview    # serves dist/ at http://localhost:4173 to try it
```

`dist/` is a plain static folder. Put it on any static host or in any subfolder; links are relative. To run it on your own computer without Node, serve the folder with any local static server, for example:

```bash
cd dist && python3 -m http.server 8080    # then open http://localhost:8080
```

Opening `dist/index.html` directly by double-clicking (a `file://` address) does **not** work: browsers block JavaScript modules and service workers on `file://` pages. Use a local server as above.

**Your data belongs to the browser and address you use.** `http://localhost:8080` and `http://localhost:4173` are different addresses, so each has its own separate data. Pick one address and keep using it, and use backups to move data between them.

## Back up your data (do this weekly)

Data lives only in this browser on this device. Clearing site data, uninstalling the browser or using a private window will lose it. The app reminds you on Today and in Settings when your last backup is more than a week old.

1. Open **Settings & Data**.
2. Click **Export all data (JSON)**. A file named `neurlo-backup-YYYY-MM-DD.json` downloads.
3. Keep that file somewhere safe (an external drive, or your own private storage). It contains your health and personal data unencrypted, so treat it like a private document.

To restore (or move to another browser/computer): **Settings & Data → Import from JSON…** and pick the backup file. This **replaces** the contents of every collection in the file.

Also in Settings & Data:
- **Export a collection to CSV:** for opening in a spreadsheet (CSV files are for reading elsewhere, not for restoring).
- **Ask browser to keep data:** asks the browser to mark storage as persistent so it is not cleared automatically when space runs low.
- **Wipe all data:** two steps, and you must type `DELETE`. Export first.

## Using it

- **Ctrl/⌘ K:** search everything (entries, pages, actions). **N:** add a new entry on the current page. **/:** focus search. **Esc:** close a panel. **Ctrl/⌘ Enter:** save a form.
- Click any row or card to edit it; changes save automatically. Deleting shows an **Undo** button.
- The **+** button adds to the current section; **⚡ Quick log** adds to any section.
- **Today** collects today's schedule, due tasks and follow-ups, routines (skin, hair, meds, habits), a mood check-in and quick-add.
- **Reminders** pop up only while the app is open in a tab (no push service). You can also allow desktop notifications in Settings.
- **Home:** drag to rotate the brain, scroll or pinch to zoom, click a node to open that area. Brighter nodes were updated recently. **Switch to grid view** is always available; the app switches to the grid automatically when 3D is not supported or runs slowly.

## Adding a new area

Each area is one config object in `src/modules/` (fields, views, optional Today hint, stats and trend charts) registered in `src/modules/index.ts`. The generic engine renders the list, search, filters, editor, charts, calendar and board views. New storage is created automatically on next load. See `PROGRESS.md` for the architecture notes.

## Project layout

```
src/core/      storage (IndexedDB), router, recurrence, routines, reminders, backup
src/engine/    generic collection page, field widgets, editor, table/cards/checklist/
               calendar/kanban/chart views, SVG charts, 3D brain (lazy-loaded)
src/modules/   one config file per life area
src/pages/     Home, Today, Settings, module overviews and widgets
src/ui/        shell (navigation), panel, toasts, command palette
```
