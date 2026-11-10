// Record editor: new records use an explicit Add; existing records autosave.
import type { Collection, DBRecord, ModuleDef } from '../core/types';
import { storeName } from '../core/types';
import * as db from '../core/db';
import { h } from '../core/util';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/toast';
import { fieldInput, defaultValue, type FieldInput } from './fields';

function collect(col: Collection, inputs: Map<string, FieldInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of col.fields) {
    const v = inputs.get(f.key)!.read(); // may throw a user-facing Error
    if (f.required && (v === undefined || v === '')) throw new Error(`${f.label} is required`);
    data[f.key] = v;
  }
  return applyDerive(col, data);
}

export function applyDerive(col: Collection, data: Record<string, unknown>): Record<string, unknown> {
  return col.derive ? { ...data, ...col.derive(data) } : data;
}

export async function deleteWithUndo(store: string, id: string, label = 'Entry'): Promise<void> {
  const removed = await db.remove(store, id);
  if (removed) toast(`${label} deleted`, { label: 'Undo', run: () => void db.putRaw(store, removed) });
}

export function newRecordData(col: Collection, preset: Record<string, unknown> = {}): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of col.fields) {
    const d = defaultValue(f);
    if (d !== undefined) data[f.key] = d;
  }
  return { ...data, ...preset };
}

export function openEditor(mod: ModuleDef, col: Collection, rec?: DBRecord, preset: Record<string, unknown> = {}): void {
  const store = storeName(mod.id, col.id);
  const values: Record<string, unknown> = rec ?? newRecordData(col, preset);
  const inputs = new Map<string, FieldInput>();
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const form = h('form', { class: 'record-form', novalidate: true });
  let pending: number | undefined;

  const save = async (): Promise<boolean> => {
    clearTimeout(pending); pending = undefined;
    try {
      const data = collect(col, inputs);
      status.classList.remove('error');
      if (rec) {
        await db.update(store, rec.id, data);
        status.textContent = 'Saved ✓';
      } else {
        await db.create(store, data);
        toast(`Added to ${col.name}`);
        closePanel();
      }
      return true;
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
      status.classList.add('error');
      return false;
    }
  };

  const onChange = () => {
    if (!rec) return;
    status.textContent = 'Saving…';
    status.classList.remove('error');
    clearTimeout(pending);
    pending = window.setTimeout(() => void save(), 500);
  };

  for (const f of col.fields) {
    const fi = fieldInput(f, values[f.key], onChange);
    inputs.set(f.key, fi);
    form.append(fi.el);
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); void save(); });
  form.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void save(); }
  });

  const footer = h('div', { class: 'form-actions' }, status);
  if (rec) {
    footer.append(
      h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
        clearTimeout(pending); pending = undefined;
        closePanel();
        await deleteWithUndo(store, rec.id, col.name.replace(/s$/, ''));
      } }, 'Delete'),
      h('button', { type: 'button', class: 'btn', onclick: closePanel }, 'Done'));
  } else {
    footer.append(
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closePanel }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add'));
  }
  form.append(footer);
  if (rec) {
    form.append(h('p', { class: 'meta' },
      `Created ${new Date(rec.createdAt).toLocaleString()} · Updated ${new Date(rec.updatedAt).toLocaleString()}`));
  }

  openPanel(rec ? `Edit ${col.name.replace(/s$/, '').toLowerCase()}` : `New in ${col.name}`, form, {
    // Flush a pending autosave when the panel closes.
    onClose: () => { if (pending !== undefined) void save(); },
  });
  document.querySelector<HTMLElement>('.panel')?.style.setProperty('--accent', mod.color);
}
