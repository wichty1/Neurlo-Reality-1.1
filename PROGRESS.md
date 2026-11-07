# Neurlo Life OS — Build Progress

Resume from here. Brief = the 9-section spec in the original prompt (phases 1–7).

## Status
- [x] Phase 1 — scaffold, theme, router, nav shell, IndexedDB layer, generic module engine (test collection: Notes)
- [x] Phase 2 — Today page, Settings & Data (export/import/wipe, CSV), command palette (Ctrl/Cmd+K)
- [ ] Phase 3 — Health, Skin Care, Hair Care, Mind & Feelings + charts (Mind config already written in Phase 2; chart views declared but renderer not built yet → they fall back to table)
- [ ] Phase 4 — Schedule (calendar views), Work, Job Search (kanban DnD), Wants & Wishes
- [ ] Phase 5 — Money, People, Habits & Goals, Notes (Notes config exists; review/extend)
- [ ] Phase 6 — 3D brain homepage + 2D fallback + live stats
- [ ] Phase 7 — polish, a11y, PWA, perf, README

## Architecture (where things live)
- `src/core/types.ts` — schema types (FieldType, ViewDef, Collection, ModuleDef, DBRecord). Store name = `module.collection`.
- `src/core/db.ts` — idb wrapper. `initDB(stores)` auto-creates missing stores by bumping DB version, so adding a module needs no migration code. CRUD emits `dbEvents` `change` (detail = store). `exportAll/importAll/wipeAll` already exist for Phase 2.
- `src/core/router.ts` — hash router. Routes: `#/` home, `#/m/:mod` overview, `#/m/:mod/:col[/:id]` collection (optional id opens editor), `#/:page` for pages registered via `registerPage` in `src/ui/shell.ts`.
- `src/core/page.ts` — per-page cleanup (`onLeave`, `watchStores`) and `pageCtx` (fab action, search box for `/`).
- `src/engine/fields.ts` — inputs/format for all 13 field types. `duration` stored as minutes; `tags` stored lowercase string[]; dates stored as local `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` strings.
- `src/engine/editor.ts` — side panel editor: new = Add button; existing = autosave (500ms debounce, flushed on close); delete with Undo toast.
- `src/engine/views.ts` — `registerView(type, renderer)`; table, cards, checklist done. calendar/kanban/chart to be registered in later phases (they currently fall back to table).
- `src/engine/collection.ts` — generic page: quick-add, search, filters (select/multiselect/tags/checkbox), sort, view switcher. UI prefs in localStorage `ui:<store>`.
- `src/pages/overview.ts` — generic module overview; `registerOverviewExtra(modId, fn)` for charts/widgets.
- `src/modules/index.ts` — MODULES registry. New module = new config file + add to array.
- `src/ui/shell.ts` — sidebar / mobile tab bar / breadcrumbs / FAB / theme. Mobile tab bar currently: Home, first top page, Notes, More — revisit once Today exists.

- `src/core/backup.ts` — JSON backup (`{format:'neurlo-backup', version:1, exportedAt, data}`), import parse/validate, CSV per collection, weekly backup reminder (`lastBackupAt` in localStorage).
- `src/core/routine.ts` — per-day completion stored on record as `_days: string[]`; `streak()` for habits.
- Today page is driven by `Collection.today` hints (`role: event | task | routine | mood`, see types.ts). New modules feed Today just by declaring a hint.
- `src/ui/palette.ts` — Ctrl/Cmd+K palette: pages, areas, sections, "New: X" actions, theme, export, and every record (full-text).
- `src/pages/today*.ts`, `src/pages/settings.ts`, `src/styles/pages.css`.

## Decisions
- Emoji used as module icons (system font, no network).
- CSP meta tag in index.html blocks any non-self network access at runtime.
- Phase 1 "test collection" is the real Notes module (no throwaway code).
- Home currently renders the 2D module grid (this becomes the brain fallback in Phase 6).
- TypeScript 7.0.2 / Vite 8 were what npm resolved; both work.

## Phase 1 manual test checklist (verified with headless Chromium via Playwright against `vite preview`)
- [x] Empty state shows on a fresh collection
- [x] Quick-add creates a record (Enter)
- [x] + button opens full form; Add creates record with text, longtext, tags
- [x] Click card → edit; autosave shows "Saved ✓"; change visible after Esc
- [x] Tag filter and search narrow results
- [x] Delete → Undo restores
- [x] Data persists after reload
- [x] Table view switch; overview count correct
- [x] Mobile width shows bottom tab bar, hides sidebar
- [x] No console errors, no external network requests
- [ ] Not verified: real touch devices, screen reader output

## Phase 2 manual test checklist (verified with Playwright against `vite preview`)
- [x] Today mood check-in (rating + emotion chips) saves and shows "Mood 7/10 · Energy 5/10"
- [x] Today quick-add into any collection (remembers last choice)
- [x] Ctrl+K palette finds a record by text and opens its editor; navigates to pages
- [x] Export JSON → wipe (requires typing DELETE) → import restores every store byte-identical (deep-compared raw IndexedDB dump), and survives reload
- [x] CSV export escapes quotes, commas and newlines; arrays joined with "; "
- [x] No console errors, no external requests
- [ ] Today schedule / due tasks / routines lists: logic written, but no module declares event/task/routine hints yet → verify in Phase 3 (routines) and Phase 4 (events, tasks)
- [ ] Not verified: "Ask browser to keep data" (persist prompt behaviour varies by browser)

## Known issues
- Keys typed in the few ms before the palette input mounts go to the page (could trigger the `n` shortcut). Minor.
- Mobile tab bar: Home, Today, Search, More.

## Next
Phase 3: Health, Skin Care, Hair Care modules + chart renderer (`registerView('chart', …)` in a new `src/engine/charts.ts`, line/bar/heatmap SVG) + module overview trend charts via `registerOverviewExtra`. Skin AM/PM routines, meds daily checklist, hair routine → `today: {role:'routine', groupField, activeOn}`.
