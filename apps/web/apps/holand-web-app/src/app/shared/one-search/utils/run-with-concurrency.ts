// ============================================
// Run async tasks with a concurrency cap
// ============================================

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
