// src/common/errorResolver.ts
// A drag-and-drop resolver that parses your backend errors, resolves messages,
// and updates your page's predefined error fields (top list + per-field map).

import messages from '@/locales/message_properties.json';

type AnyObj = Record<string, unknown>;

export type ErrorTargets = {
  /** A Vue Ref<string[]> or a setter function to put the top error list */
  topList?: { value: string[] } | ((list: string[]) => void);
  /** A Vue Ref<Record<string,string[]>> or a setter function to put field errors */
  fieldMap?: { value: Record<string, string[]> } | ((map: Record<string, string[]>) => void);
  /** If true, existing lists will be cleared before adding new errors (default: true) */
  reset?: boolean;
};

const PLACEHOLDER_RE = /\{([^}]+)\}/g;
const HAS_PLACEHOLDER_RE = /\{[^}]+\}/;

/**
 * Apply resolved errors to the current screen.
 * - You pass the raw error BODY (not whole axios error), e.g. { code, errors: [...], meta: ... }
 * - You also pass where to show: Vue refs or simple setter callbacks.
 * - The function resolves localized strings and populates your top list + field map.
 */
export function applyErrorsToPage(body: unknown, targets: ErrorTargets): void {
  const { topList, fieldMap, reset = true } = targets;
  const errors = extractErrorsArray(body);
  if (!errors.length) {
    if (topList) setTop(topList, []);
    if (fieldMap) setFields(fieldMap, {});
    return;
  }

  const errorTemplates = ((messages as AnyObj).error ?? {}) as Record<string, string>;

  const top: string[] = [];
  const fieldGrouped: Record<string, string[]> = {};

  for (const err of errors) {
    const code = String(err?.code ?? 'ERR_UNKNOWN');
    const template = errorTemplates[code] ?? errorTemplates['ERR_UNKNOWN'] ?? '不明なエラーが発生しました。';

    // Fixed template (no placeholders): ignore field even if present
    if (!HAS_PLACEHOLDER_RE.test(template)) {
      top.push(template);
      continue;
    }

    // Dynamic: parse CSV in err.field: "fieldKey,param1,param2,..."
    const csv = typeof err?.field === 'string' ? err.field : '';
    const parts = csv.split(',').map(s => s.trim()).filter(Boolean);

    const fieldKey = parts[0] ?? '';
    const otherParams = parts.slice(1);

    // Resolve {field} (search anywhere in messages JSON)
    const fieldLabel = findLabel(fieldKey, messages) ?? fieldKey;
    
    let msg = template.replace(/\{([^}]+)\}/g, (_m, name) => {
      // normalize
      if (name === 'field' || name === '0') {
        return fieldLabel;
      }
      const idx = Number(name);
      if (!Number.isNaN(idx)) {
        if (idx === 0) return fieldLabel;
        return otherParams[idx - 1] ?? ''; // empty if missing
      }
      // For named placeholders you don't support, either return '' or keep as-is
      return ''; // or: return _m;
    });

    // Fill subsequent placeholders in template order
    const namesExField = Array.from(template.matchAll(PLACEHOLDER_RE))
      .map(m => String(m[1]))
      .filter(n => n !== 'field');

    namesExField.forEach((name, i) => {
      msg = msg.replace(`{${name}}`, otherParams[i] ?? '');
    });

    top.push(msg);

    // Attach to per-field map only if we have a fieldKey (fixed/global errors won’t map)
    if (fieldKey) {
      (fieldGrouped[fieldKey] ??= []).push(msg);
    }
  }

  if (topList) {
    // reset first if requested
    setTop(topList, reset ? [] : getTop(topList));
    setTop(topList, top);
  }
  if (fieldMap) {
    setFields(fieldMap, reset ? {} : getFields(fieldMap));
    // merge appended messages by field
    const merged = getFields(fieldMap);
    for (const [k, arr] of Object.entries(fieldGrouped)) {
      (merged[k] ??= []).push(...arr);
    }
    setFields(fieldMap, { ...merged });
  }
}

/* ------------------------- internals ------------------------- */

function extractErrorsArray(body: unknown): { code?: string; field?: string }[] {
  const b = toObj(body);
  if (!b) return [];
  const e = b.errors;
  return Array.isArray(e) ? (e as { code?: string; field?: string }[]) : [];
}

function toObj(x: unknown): AnyObj | undefined {
  if (typeof x === 'string') {
    try { return JSON.parse(x) as AnyObj; } catch { return undefined; }
  }
  return typeof x === 'object' && x !== null ? (x as AnyObj) : undefined;
}

function findLabel(fieldKey: string, tree: unknown): string | undefined {
  if (!fieldKey || typeof tree !== 'object' || tree === null) return undefined;
  for (const [k, v] of Object.entries(tree as AnyObj)) {
    if (typeof v === 'string' && k === fieldKey) return v;
    if (typeof v === 'object' && v !== null) {
      const found = findLabel(fieldKey, v);
      if (found) return found;
    }
  }
  return undefined;
}

function setTop(target: ErrorTargets['topList'], list: string[]) {
  if (!target) return;
  if (typeof target === 'function') target(list);
  else target.value = list;
}

function getTop(target: ErrorTargets['topList']): string[] {
  if (!target) return [];
  if (typeof target === 'function') return [];
  return Array.isArray(target.value) ? target.value : [];
}

function setFields(target: ErrorTargets['fieldMap'], map: Record<string, string[]>) {
  if (!target) return;
  if (typeof target === 'function') target(map);
  else target.value = map;
}

function getFields(target: ErrorTargets['fieldMap']): Record<string, string[]> {
  if (!target) return {};
  if (typeof target === 'function') return {};
  return (typeof target.value === 'object' && target.value !== null ? target.value : {}) as Record<string, string[]>;
}
