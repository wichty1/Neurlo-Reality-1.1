# Neurlo Life OS — Build Progress

Resume from here. Brief = the 9-section spec in the original prompt (phases 1–7).

## Status
- [x] Phase 1 — scaffold, theme, router, nav shell, IndexedDB layer, generic module engine (test collection: Notes)
- [ ] Phase 2 — Today page, Settings & Data (export/import/wipe, CSV), command palette (Ctrl/Cmd+K)
- [ ] Phase 3 — Health, Skin Care, Hair Care, Mind & Feelings + charts
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

## Known issues
- None open.

## Next
Phase 2: Today page (`registerPage` position top), Settings & Data page (position bottom), command palette.
