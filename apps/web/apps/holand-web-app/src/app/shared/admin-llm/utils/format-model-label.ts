/** Backend may return model as string or nested object (name, backend_kind, …). */
export function formatModelLabel(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'name' in value) {
    const name = (value as { name: unknown }).name;
    return name != null && name !== '' ? String(name) : '—';
  }
  return String(value);
}

export function candidateModelName(model: unknown): string {
  if (typeof model === 'string') return model;
  return formatModelLabel(model);
}
