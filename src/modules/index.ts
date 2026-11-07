// Module registry. Adding a life area = adding one config object here.
import type { Collection, ModuleDef } from '../core/types';
import { storeName } from '../core/types';
import { notes } from './notes';
import { mind } from './mind';
import { health } from './health';
import { skin } from './skin';
import { hair } from './hair';
import { schedule } from './schedule';
import { work } from './work';
import { jobs } from './jobs';
import { wants } from './wants';
import { money } from './money';
import { people } from './people';
import { habits } from './habits';

export const MODULES: ModuleDef[] = [schedule, health, skin, hair, mind, habits, work, jobs, money, people, wants, notes];

export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getCollection(mod: ModuleDef, colId: string): Collection | undefined {
  return mod.collections.find((c) => c.id === colId);
}

export function allStoreNames(): string[] {
  return MODULES.flatMap((m) => m.collections.map((c) => storeName(m.id, c.id)));
}

/** Resolves "module.collection" store names back to their schema. */
export function resolveStore(store: string): { mod: ModuleDef; col: Collection } | undefined {
  const [mid, cid] = store.split('.');
  const mod = getModule(mid);
  const col = mod && getCollection(mod, cid);
  return mod && col ? { mod, col } : undefined;
}
