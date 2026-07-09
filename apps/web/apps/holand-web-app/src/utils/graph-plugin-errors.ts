/** Map graph plugin backend errors to user-facing hints. */
export function formatGraphPluginError(error: unknown, plugin: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  const lower = raw.toLowerCase();

  if (lower.includes('seed_not_found')) {
    return `${plugin}: node not found in graph storage (seed_not_found). Backend must index this case/element.`;
  }
  if (lower.includes('storage_unreachable')) {
    return `${plugin}: graph storage unreachable — check Neo4j connection on the backend.`;
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return `${plugin}: request timed out — try again or reduce graph scope.`;
  }

  return `${plugin} failed: ${raw}`;
}
