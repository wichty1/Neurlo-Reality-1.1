// Field-type registry: input widgets, value parsing and display formatting.
import type { Field } from '../core/types';
import { h, fmtDate, fmtDateTime, fmtDuration, parseDuration, asArray } from '../core/util';

export interface FieldInput {
  el: HTMLElement;
  /** Returns the parsed value, undefined for empty, or throws Error with a user message. */
  read(): unknown;
  focusEl: HTMLElement;
}

let uid = 0;

export function defaultValue(f: Field): unknown {
  return typeof f.default === 'function' ? (f.default as () => unknown)() : f.default;
}

export function fieldInput(f: Field, value: unknown, onChange: () => void): FieldInput {
  const id = `f-${f.key}-${++uid}`;
  const label = h('label', { for: id, class: 'field-label' }, f.label, f.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null);
  const wrap = h('div', { class: `field field-${f.type}` }, label);
  const common = { id, name: f.key, placeholder: f.placeholder ?? '', oninput: onChange, onchange: onChange };
  let input: HTMLElement;
  let read: () => unknown;
  const str = value === undefined || value === null ? '' : String(value);

  switch (f.type) {
    case 'longtext': {
      const t = h('textarea', { ...common, rows: 6 }); t.value = str;
      input = t; read = () => t.value.trim() || undefined; break;
    }
    case 'number': {
      const i = h('input', { ...common, type: 'number', inputmode: 'decimal', step: f.step ?? 'any', min: f.min, max: f.max });
      i.value = str;
      input = i;
      read = () => {
        if (i.value.trim() === '') return undefined;
        const n = Number(i.value);
        if (!isFinite(n)) throw new Error(`${f.label} must be a number`);
        return n;
      };
      break;
    }
    case 'date': case 'time': case 'datetime': {
      const i = h('input', { ...common, type: f.type === 'datetime' ? 'datetime-local' : f.type }); i.value = str;
      input = i; read = () => i.value || undefined; break;
    }
    case 'url': {
      const i = h('input', { ...common, type: 'url', inputmode: 'url' }); i.value = str;
      input = i; read = () => i.value.trim() || undefined; break;
    }
    case 'duration': {
      const i = h('input', { ...common, type: 'text', placeholder: f.placeholder ?? 'e.g. 1h 30m or 90' });
      i.value = typeof value === 'number' ? fmtDuration(value) : str;
      input = i;
      read = () => {
        if (!i.value.trim()) return undefined;
        const m = parseDuration(i.value);
        if (m === null) throw new Error(`${f.label}: use a format like 1h 30m, 1:30 or 90`);
        return m;
      };
      break;
    }
    case 'select': {
      const s = h('select', common, h('option', { value: '' }, '—'), ...(f.options ?? []).map((o) => h('option', { value: o }, o)));
      s.value = str;
      input = s; read = () => s.value || undefined; break;
    }
    case 'checkbox': {
      const c = h('input', { ...common, type: 'checkbox' }); c.checked = value === true;
      wrap.classList.add('field-inline');
      input = c; read = () => c.checked; break;
    }
    case 'multiselect': {
      const sel = new Set(asArray(value));
      const group = h('div', { class: 'chips', role: 'group', 'aria-labelledby': `${id}-l` });
      label.id = `${id}-l`; label.removeAttribute('for');
      for (const o of f.options ?? []) {
        const c = h('input', { type: 'checkbox', value: o, onchange: onChange }); c.checked = sel.has(o);
        group.append(h('label', { class: 'chip-check' }, c, h('span', {}, o)));
      }
      input = group;
      read = () => {
        const v = Array.from(group.querySelectorAll<HTMLInputElement>('input:checked'), (c) => c.value);
        return v.length ? v : undefined;
      };
      break;
    }
    case 'rating': {
      let cur = typeof value === 'number' ? value : 0;
      const group = h('div', { class: 'rating', role: 'radiogroup', 'aria-labelledby': `${id}-l` });
      label.id = `${id}-l`; label.removeAttribute('for');
      const paint = () => group.querySelectorAll('button').forEach((b, i) => {
        b.classList.toggle('on', i < cur); b.setAttribute('aria-checked', String(i + 1 === cur));
      });
      for (let n = 1; n <= 10; n++) {
        group.append(h('button', {
          type: 'button', role: 'radio', 'aria-label': `${n} of 10`,
          onclick: () => { cur = cur === n ? 0 : n; paint(); onChange(); },
        }, String(n)));
      }
      paint();
      input = group; read = () => (cur > 0 ? cur : undefined); break;
    }
    case 'tags': {
      const i = h('input', { ...common, type: 'text', placeholder: f.placeholder ?? 'comma, separated, tags' });
      i.value = asArray(value).join(', ');
      input = i;
      read = () => {
        const t = Array.from(new Set(i.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)));
        return t.length ? t : undefined;
      };
      break;
    }
    default: {
      const i = h('input', { ...common, type: 'text' }); i.value = str;
      input = i; read = () => i.value.trim() || undefined;
    }
  }
  if (f.unit && f.type === 'number') wrap.append(h('div', { class: 'with-unit' }, input, h('span', { class: 'unit' }, f.unit)));
  else wrap.append(input);
  if (f.help) wrap.append(h('small', { class: 'help' }, f.help));
  return { el: wrap, read, focusEl: input };
}

/** Plain-text representation (search, CSV, palette). */
export function textValue(f: Field, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  switch (f.type) {
    case 'checkbox': return v ? 'yes' : 'no';
    case 'date': return fmtDate(v);
    case 'datetime': return fmtDateTime(v);
    case 'duration': return fmtDuration(v);
    case 'rating': return `${v}/10`;
    case 'number': return f.unit ? `${v} ${f.unit}` : String(v);
    case 'multiselect': case 'tags': return asArray(v).join(', ');
    default: return String(v);
  }
}

/** Rich display node for tables and cards. */
export function displayValue(f: Field, v: unknown): Node | string {
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'tags' || f.type === 'multiselect') {
    return h('span', { class: 'tag-list' }, ...asArray(v).map((t) => h('span', { class: f.type === 'tags' ? 'tag' : 'pill' }, f.type === 'tags' ? `#${t}` : t)));
  }
  if (f.type === 'url') {
    const s = String(v);
    return /^https?:\/\//i.test(s)
      ? h('a', { href: s, target: '_blank', rel: 'noopener noreferrer', onclick: (e: Event) => e.stopPropagation() }, s.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 40))
      : s;
  }
  if (f.type === 'select') return h('span', { class: 'pill' }, String(v));
  if (f.type === 'checkbox') return v ? '✓' : '';
  return textValue(f, v);
}
