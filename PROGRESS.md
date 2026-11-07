# Neurlo Life OS — Build Progress

Resume from here. Brief = the 9-section spec in the original prompt (phases 1–7).

## Status
- [x] Phase 1 — scaffold, theme, router, nav shell, IndexedDB layer, generic module engine (test collection: Notes)
- [x] Phase 2 — Today page, Settings & Data (export/import/wipe, CSV), command palette (Ctrl/Cmd+K)
- [x] Phase 3 — Health, Skin Care, Hair Care, Mind & Feelings + charts
- [x] Phase 4 — Schedule (calendar views), Work, Job Search (kanban DnD), Wants & Wishes
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

- `src/engine/charts.ts` — SVG line / bar / heatmap + `aggregate()` (per day or ISO week; avg/sum/count). `src/engine/chart-view.ts` registers the `chart` view (30d/90d/1y/All) and exports `trendChart()` used by overviews.
- `ModuleDef.trends` → trend cards on the overview; `ModuleDef.stat` → live stat line (also for brain tooltips in Phase 6).
- `Collection.derive` → computed fields on save (sleep hours from bed/wake).
- `src/modules/common.ts` — `goalsCollection()`, `routineCollection()` (AM/PM etc., `everyDays` repeat, `active`), `avgRecent()`, `routineProgress()`. `productsCollection()` lives in skin.ts and is reused by hair.
- Routine collections (`today.role = 'routine'`) render the checklist view as a per-day checklist with streaks; `dueEvery()` handles every-N-days items.
- Goals collections declare a `kanban` view (falls back to table until Phase 4 registers kanban).

- `src/core/recur.ts` — `REPEAT`/`REMIND` option lists, `occursOn(r, day, dateField)` (daily, weekdays, weekly, biweekly, monthly with month-end clamp, yearly, `until`), `timeOf()`. Keep this file dependency-free (module configs import it; importing reminders.ts from configs caused an import cycle).
- `src/engine/calendar.ts` — month/week/day widget over any number of sources; registered as `calendar` view; `occurrences()`; state per key kept in memory. Mobile defaults to week view.
- `src/engine/kanban.ts` — `kanban` view: columns = options of `groupBy` select; HTML5 drag & drop + per-card "move to" select (keyboard/touch); "+" per column presets the status.
- `src/core/reminders.ts` — every 30s while open: records in collections with a `remind` field and a `today` event hint; fires toast (+ local Notification if permitted and tab hidden); fired keys in localStorage `remindersFired` (pruned after 3 days). Window: from reminder time until 1h after start.
- `src/pages/schedule-overview.ts` — combined calendar of all `today.role='event'` collections on the Schedule overview.
- `Field.filter: false` hides a field from the filter bar.

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

## Phase 3 manual test checklist (verified with Playwright)
- [x] Old DB (only notes store) auto-upgrades; old data kept, new stores created
- [x] Sleep hours derived from 23:30 → 07:00 = 7.5 h
- [x] Quick-add with rating fields, repeated (found + fixed bug: rating state not reset between quick-adds)
- [x] Line chart (2 series), heatmap (filled days), labs chart split per test (seriesBy)
- [x] Meds and skin routine items appear on Today grouped; ticking persists after reload; streak 🔥 shown
- [x] Every-7-days skin step is due today when never done
- [x] Appointment with today's datetime shows in Today schedule with time
- [x] Health overview stat "Sleep avg 7.2h (7d) · Meds 1/2 today" and 3 trend cards
- [x] Phase 1 + 2 suites re-run green; no console errors; no external requests
- [ ] Not verified: Hair "Next wash" stat text (logic shared with tested dueEvery), chart readability on a real phone
- Units are US (lb, in, °F, oz) — simple choice; change `unit` in health.ts if needed (labels only, no conversion).

## Phase 4 manual test checklist
Unit (node, compiled recur.ts, run in UTC and America/New_York): 11/11 recurrence cases incl. Jan 31 monthly → Feb 28/Mar 31/Apr 30, leap-day yearly, weekly across DST, until.
Browser (Playwright, 21/21):
- [x] Weekly event: month shows occurrences, week shows 1, day shows time; prev/next navigation
- [x] Reminder due 2 min ago fires a toast on load, and does not fire again on reload
- [x] Kanban: quick-add lands in first stage; HTML5 drag & drop to another stage; move-to select; persists after reload
- [x] Jobs stat "2 applications this week · 1 follow-up due"; applications-per-week bar chart (undated "Researching" apps excluded)
- [x] Today shows contact follow-up and application next step as due tasks; ticking removes; recurring event + reminder in schedule
- [x] Work shift hours derived 09:00–17:30 minus 30 min = 8 h
- [x] Schedule overview calendar includes a Health appointment
- [x] Wants board has 4 status columns; mobile calendar defaults to week view
- [x] Phases 1–3 suites still green; no console errors; no external requests
- [ ] Not verified: real desktop Notification popup (needs permission UI), touch drag on a phone (move-to select is the touch path)
Test scripts live outside the repo (session scratchpad); they are not part of the deliverable.

## Known issues
- Keys typed in the few ms before the palette input mounts go to the page (could trigger the `n` shortcut). Minor.
- Mobile tab bar: Home, Today, Search, More.
- Mobile: collection toolbar (search + several filters + sort + view tabs) is tall on phones → collapse filters behind a toggle in Phase 7.

## Next
Phase 5: Money (income/expense log with monthly totals chart, monthly budget per category with spent vs budget, bills with due dates → `today.role='task'` + recurrence?, savings goals), People (contacts, birthdays → Today events via yearly recurrence, last-contacted, notes), Habits & Goals (daily habits → routine role with streaks; long-term goals with milestones), Notes (exists; add pinned-first sort / review).

(Done) Phase 4: Schedule module (events with recurrence → `today.occursOn`, reminders, time blocks; month/week/day calendar view registered as `calendar`; in-app notifications while open), Work (shifts/hours, tasks with `today.role='task'`, projects, notes, wins, goals), Job Search (kanban view with drag & drop registered as `kanban`, applications, contacts/outreach with follow-ups, interview prep, resume versions, weekly counter), Wants & Wishes (status Idea/Planning/In progress/Done → `STATUS` in common.ts).
