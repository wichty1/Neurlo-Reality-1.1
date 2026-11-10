// Settings & Data: theme, JSON backup/restore, CSV export, storage info, wipe.
import * as db from '../core/db';
import { h } from '../core/util';
import { storeName } from '../core/types';
import { exportJSON, parseBackup, exportCSV, lastBackupAt, backupDue } from '../core/backup';
import { MODULES } from '../modules';
import { getTheme, setTheme } from '../ui/shell';
import { toast } from '../ui/toast';

function themeSection(): HTMLElement {
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Theme' });
  const paint = () => group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.t === getTheme())));
  for (const [t, label] of [['dark', 'Dark'], ['light', 'Light']] as const) {
    group.append(h('button', { type: 'button', role: 'radio', 'data-t': t, onclick: () => { setTheme(t); paint(); } }, label));
  }
  paint();
  return h('section', { class: 'card settings-sec' }, h('h2', {}, 'Appearance'), group);
}

function backupSection(): HTMLElement {
  const status = h('p', { class: 'small', 'aria-live': 'polite' });
  const paintStatus = async () => {
    const last = lastBackupAt();
    status.textContent = last ? `Last export: ${new Date(last).toLocaleString()}` : 'You have not exported a backup from this browser yet.';
    status.classList.toggle('warn', await backupDue());
  };
  void paintStatus();

  const file = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'visually-hidden' });
  const result = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const backup = parseBackup(await f.text());
      const total = Object.values(backup.data).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
      const when = new Date(backup.exportedAt).toLocaleString();
      if (!confirm(`Restore ${total} records from the backup made ${when}?\n\nThis replaces the current contents of every collection included in the file.`)) return;
      const r = await db.importAll(backup.data);
      result.textContent = `Restored ${r.records} records into ${r.stores} collections.${r.skipped.length ? ` Skipped unknown: ${r.skipped.join(', ')}.` : ''}`;
      result.classList.remove('error');
      toast('Backup restored');
    } catch (e) {
      result.textContent = e instanceof Error ? e.message : String(e);
      result.classList.add('error');
    }
  });

  return h('section', { class: 'card settings-sec' },
    h('h2', {}, 'Backup & restore'),
    h('p', { class: 'muted' }, 'Everything is stored only in this browser. Export a backup file at least once a week and keep it somewhere safe; clearing browser data deletes it.'),
    status,
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: async () => { await exportJSON(); void paintStatus(); toast('Backup downloaded'); } }, 'Export all data (JSON)'),
      h('label', { for: 'import-file', class: 'btn', tabindex: 0, onkeydown: (e: Event) => { if ((e as KeyboardEvent).key === 'Enter') file.click(); } }, 'Import from JSON…'),
      file),
    result);
}

function csvSection(): HTMLElement {
  const sel = h('select', { 'aria-label': 'Collection to export' }, ...MODULES.map((m) => h('optgroup', { label: m.name },
    ...m.collections.map((c) => h('option', { value: storeName(m.id, c.id) }, c.name)))));
  return h('section', { class: 'card settings-sec' },
    h('h2', {}, 'Export a collection to CSV'),
    h('p', { class: 'muted' }, 'Opens in any spreadsheet app. CSV is for reading elsewhere; use the JSON backup to restore.'),
    h('div', { class: 'btn-row' }, sel, h('button', { type: 'button', class: 'btn', onclick: async () => {
      const [mid, cid] = sel.value.split('.');
      const col = MODULES.find((m) => m.id === mid)!.collections.find((c) => c.id === cid)!;
      const n = await exportCSV(sel.value, col);
      toast(`Exported ${n} rows`);
    } }, 'Download CSV')));
}

function storageSection(): HTMLElement {
  const info = h('p', { class: 'small' });
  const persistBtn = h('button', { type: 'button', class: 'btn btn-sm' }, 'Ask browser to keep data');
  const paint = async () => {
    let total = 0;
    for (const s of db.allStores()) total += (await db.list(s)).length;
    let line = `${total} records across ${db.allStores().length} collections.`;
    if (navigator.storage?.persisted) {
      const p = await navigator.storage.persisted();
      line += p ? ' Storage is persistent (the browser will not evict it automatically).' : ' Storage is not yet persistent.';
      persistBtn.hidden = p;
    } else persistBtn.hidden = true;
    info.textContent = line;
  };
  persistBtn.addEventListener('click', async () => {
    const ok = await navigator.storage.persist();
    toast(ok ? 'Storage marked persistent' : 'The browser declined; keep exporting backups');
    void paint();
  });
  void paint();
  return h('section', { class: 'card settings-sec' }, h('h2', {}, 'Storage'), info, persistBtn);
}

function notifySection(): HTMLElement {
  const info = h('p', { class: 'small' });
  const btn = h('button', { type: 'button', class: 'btn btn-sm' }, 'Allow desktop notifications');
  const paint = () => {
    if (!('Notification' in window)) { info.textContent = 'This browser does not support notifications; reminders show as in-app pop-ups.'; btn.hidden = true; return; }
    const p = Notification.permission;
    info.textContent = p === 'granted' ? 'Desktop notifications are on (shown when the app is open in a background tab).'
      : p === 'denied' ? 'Notifications are blocked in browser settings; reminders show as in-app pop-ups.'
      : 'Reminders show as in-app pop-ups. Allow notifications to also see them when this tab is in the background.';
    btn.hidden = p !== 'default';
  };
  btn.addEventListener('click', async () => { await Notification.requestPermission(); paint(); });
  paint();
  return h('section', { class: 'card settings-sec' }, h('h2', {}, 'Reminders'),
    h('p', { class: 'muted' }, 'Reminders only work while the app is open in a browser tab. No push service or server is used.'), info, btn);
}

function wipeSection(): HTMLElement {
  const step2 = h('div', { class: 'wipe-confirm', hidden: true });
  const input = h('input', { type: 'text', 'aria-label': 'Type DELETE to confirm', placeholder: 'Type DELETE', autocomplete: 'off' });
  const go = h('button', { type: 'button', class: 'btn btn-danger', disabled: true, onclick: async () => {
    if (input.value !== 'DELETE') return;
    await db.wipeAll();
    input.value = ''; go.disabled = true; step2.hidden = true;
    toast('All data wiped');
  } }, 'Permanently wipe everything');
  input.addEventListener('input', () => { go.disabled = input.value !== 'DELETE'; });
  step2.append(h('p', { class: 'warn' }, 'Step 2 of 2: this cannot be undone. Type DELETE to confirm.'), h('div', { class: 'btn-row' }, input, go,
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { step2.hidden = true; input.value = ''; go.disabled = true; } }, 'Cancel')));
  return h('section', { class: 'card settings-sec danger-zone' },
    h('h2', {}, 'Danger zone'),
    h('p', { class: 'muted' }, 'Deletes every record in every collection from this browser. Export a backup first.'),
    h('button', { type: 'button', class: 'btn btn-danger', onclick: () => { step2.hidden = false; input.focus(); } }, 'Wipe all data…'),
    step2);
}

export function renderSettings(): HTMLElement {
  return h('section', { class: 'settings' },
    h('div', { class: 'page-head' }, h('h1', {}, '⚙️ Settings & Data'), h('p', { class: 'muted' }, 'Your data never leaves this device unless you export it.')),
    themeSection(), backupSection(), csvSection(), storageSection(), notifySection(), wipeSection(),
    h('section', { class: 'card settings-sec' }, h('h2', {}, 'Keyboard shortcuts'),
      h('ul', { class: 'small' },
        h('li', {}, h('kbd', {}, 'Ctrl/⌘ K'), ' search and jump anywhere'),
        h('li', {}, h('kbd', {}, 'N'), ' add a new entry on the current page'),
        h('li', {}, h('kbd', {}, '/'), ' focus the search box'),
        h('li', {}, h('kbd', {}, 'Esc'), ' close a panel'),
        h('li', {}, h('kbd', {}, 'Ctrl/⌘ Enter'), ' save the open form'))));
}
