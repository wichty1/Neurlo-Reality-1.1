// Backup: JSON export/import of every store, CSV export of one collection, backup reminder.
import * as db from './db';
import type { Collection } from './types';
import { download, isoDate } from './util';

export const BACKUP_FORMAT = 'neurlo-backup';
const LAST_KEY = 'lastBackupAt';

export interface BackupFile { format: string; version: 1; exportedAt: string; data: db.Dump; }

export async function exportJSON(): Promise<void> {
  const file: BackupFile = { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), data: await db.exportAll() };
  download(`neurlo-backup-${isoDate()}.json`, JSON.stringify(file, null, 1));
  try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* ignore */ }
}

export function parseBackup(text: string): BackupFile {
  let obj: unknown;
  try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  const f = obj as Partial<BackupFile>;
  if (!f || f.format !== BACKUP_FORMAT || typeof f.data !== 'object' || f.data === null) {
    throw new Error('That file is not a Neurlo backup.');
  }
  return f as BackupFile;
}

export function lastBackupAt(): number | null {
  try { const v = Number(localStorage.getItem(LAST_KEY)); return v > 0 ? v : null; } catch { return null; }
}

/** True when there is data and no export within the last 7 days. */
export async function backupDue(): Promise<boolean> {
  const last = lastBackupAt();
  if (last && Date.now() - last < 7 * 86400000) return false;
  for (const s of db.allStores()) if ((await db.list(s)).length) return true;
  return false;
}

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCSV(store: string, col: Collection): Promise<number> {
  const recs = await db.list(store);
  const head = ['id', ...col.fields.map((f) => f.label), 'createdAt', 'updatedAt'];
  const rows = recs.map((r) => [r.id, ...col.fields.map((f) => r[f.key]),
    new Date(r.createdAt).toISOString(), new Date(r.updatedAt).toISOString()].map(csvCell).join(','));
  // BOM so spreadsheet apps detect UTF-8.
  download(`neurlo-${store.replace('.', '-')}-${isoDate()}.csv`, '﻿' + [head.map(csvCell).join(','), ...rows].join('\r\n'), 'text/csv');
  return recs.length;
}
