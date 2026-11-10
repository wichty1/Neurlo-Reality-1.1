// IndexedDB layer: one object store per collection, keyed by record id.
import { openDB, type IDBPDatabase } from 'idb';
import type { DBRecord } from './types';

const DB_NAME = 'neurlo-life-os';
let db: IDBPDatabase | null = null;

/** Fires `change` with detail = store name whenever data changes. */
export const dbEvents = new EventTarget();
const notify = (store: string) =>
  dbEvents.dispatchEvent(new CustomEvent<string>('change', { detail: store }));

export function newId(): string {
  // randomUUID only exists in secure contexts (https/localhost); fall back for plain http hosts.
  const c: Crypto = crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('');
}

function guard(conn: IDBPDatabase): IDBPDatabase {
  // Another tab upgraded the schema: close and reload so we pick up new stores.
  conn.addEventListener('versionchange', () => { conn.close(); location.reload(); });
  return conn;
}

/** Opens the DB and creates any stores that do not exist yet (schema grows with modules). */
export async function initDB(stores: string[]): Promise<void> {
  const probe = await openDB(DB_NAME);
  const missing = stores.filter((s) => !probe.objectStoreNames.contains(s));
  if (missing.length === 0) { db = guard(probe); return; }
  const version = probe.version + 1;
  probe.close();
  db = guard(await openDB(DB_NAME, version, {
    upgrade(d) {
      for (const s of missing) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
    },
  }));
}

function conn(): IDBPDatabase {
  if (!db) throw new Error('Database not initialised');
  return db;
}

export function allStores(): string[] {
  return Array.from(conn().objectStoreNames);
}

export async function list(store: string): Promise<DBRecord[]> {
  return (await conn().getAll(store)) as DBRecord[];
}

export async function get(store: string, id: string): Promise<DBRecord | undefined> {
  return (await conn().get(store, id)) as DBRecord | undefined;
}

export async function create(store: string, data: Record<string, unknown>): Promise<DBRecord> {
  const now = Date.now();
  const rec: DBRecord = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await conn().put(store, rec);
  notify(store);
  return rec;
}

export async function update(store: string, id: string, patch: Record<string, unknown>): Promise<DBRecord> {
  const cur = await get(store, id);
  if (!cur) throw new Error(`Record ${id} not found in ${store}`);
  const rec: DBRecord = { ...cur, ...patch, id, createdAt: cur.createdAt, updatedAt: Date.now() };
  await conn().put(store, rec);
  notify(store);
  return rec;
}

/** Writes a record exactly as given (used by undo and import). */
export async function putRaw(store: string, rec: DBRecord, silent = false): Promise<void> {
  await conn().put(store, rec);
  if (!silent) notify(store);
}

export async function remove(store: string, id: string): Promise<DBRecord | undefined> {
  const cur = await get(store, id);
  await conn().delete(store, id);
  notify(store);
  return cur;
}

export async function clearStore(store: string): Promise<void> {
  await conn().clear(store);
  notify(store);
}

export type Dump = Record<string, DBRecord[]>;

export async function exportAll(): Promise<Dump> {
  const out: Dump = {};
  for (const s of allStores()) out[s] = await list(s);
  return out;
}

/** Replaces the contents of every store present in the dump. Unknown stores are skipped. */
export async function importAll(dump: Dump): Promise<{ stores: number; records: number; skipped: string[] }> {
  const known = new Set(allStores());
  const skipped: string[] = [];
  let stores = 0, records = 0;
  for (const [s, recs] of Object.entries(dump)) {
    if (!known.has(s) || !Array.isArray(recs)) { skipped.push(s); continue; }
    const tx = conn().transaction(s, 'readwrite');
    await tx.store.clear();
    for (const r of recs) if (r && typeof r.id === 'string') { await tx.store.put(r); records++; }
    await tx.done;
    stores++;
    notify(s);
  }
  return { stores, records, skipped };
}

export async function wipeAll(): Promise<void> {
  for (const s of allStores()) await clearStore(s);
}
