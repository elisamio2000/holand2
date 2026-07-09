import type { FieldSchema } from './schema-types';

/** Simple visibleWhen: all listed keys must match values (equality). */
export function isFieldVisible(
  field: FieldSchema,
  values: Record<string, unknown>
): boolean {
  if (!field.visibleWhen || Object.keys(field.visibleWhen).length === 0) return true;
  return Object.entries(field.visibleWhen).every(([key, expected]) => {
    const actual = values[key];
    if (expected === true || expected === false) return Boolean(actual) === expected;
    return actual === expected;
  });
}

export function filterVisibleFields(
  fields: FieldSchema[],
  values: Record<string, unknown>
): FieldSchema[] {
  return fields.filter((f) => isFieldVisible(f, values));
}
