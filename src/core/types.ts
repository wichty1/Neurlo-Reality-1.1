// Schema types for the module engine. A life area = one ModuleDef config object.

export type FieldType =
  | 'text' | 'longtext' | 'number' | 'date' | 'time' | 'datetime'
  | 'select' | 'multiselect' | 'rating' | 'checkbox' | 'tags' | 'url' | 'duration';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];          // select / multiselect
  required?: boolean;
  /** Static default or a function evaluated when a new record form opens. */
  default?: unknown | (() => unknown);
  unit?: string;               // shown after numbers, e.g. "kg"
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Hide from table columns / card body (still editable in the form). */
  hidden?: boolean;
  help?: string;
}

export type ViewType = 'table' | 'cards' | 'checklist' | 'calendar' | 'kanban' | 'chart';

export interface ViewDef {
  type: ViewType;
  label?: string;
  /** kanban: select field whose options become columns. */
  groupBy?: string;
  /** checklist: checkbox field to toggle. */
  checkField?: string;
  /** chart: numeric fields plotted against the collection dateField. */
  valueFields?: string[];
  chart?: 'line' | 'bar' | 'heatmap';
  /** chart: how to aggregate values per day ('avg' | 'sum' | 'count'). */
  agg?: 'avg' | 'sum' | 'count';
}

export interface Collection {
  id: string;
  name: string;
  icon?: string;
  fields: Field[];
  views: ViewDef[];
  /** Field used as the record's title in lists, search and the palette. */
  titleField: string;
  /** Field used for date sorting, calendars and charts. */
  dateField?: string;
  /** Fields shown in the compact quick-add form (defaults to the titleField). */
  quickAdd?: string[];
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  description?: string;
}

export interface ModuleDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  collections: Collection[];
  /** Optional live stat for overview cards / brain tooltip. */
  stat?: () => Promise<string>;
}

export interface DBRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export const storeName = (moduleId: string, collectionId: string): string =>
  `${moduleId}.${collectionId}`;
