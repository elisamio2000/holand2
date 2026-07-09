import type { TaskSummary } from '@/types/projects.types';

export function groupTasksByDueBucket(tasks: TaskSummary[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const buckets = {
    overdue: [] as TaskSummary[],
    today: [] as TaskSummary[],
    thisWeek: [] as TaskSummary[],
    later: [] as TaskSummary[],
    unscheduled: [] as TaskSummary[],
  };

  for (const task of tasks) {
    if (!task.due_at) {
      buckets.unscheduled.push(task);
      continue;
    }
    const due = new Date(task.due_at).getTime();
    if (due < startOfToday.getTime() && task.status !== 'done' && task.status !== 'canceled') {
      buckets.overdue.push(task);
    } else if (due <= endOfToday.getTime()) {
      buckets.today.push(task);
    } else if (due <= endOfWeek.getTime()) {
      buckets.thisWeek.push(task);
    } else {
      buckets.later.push(task);
    }
  }
  return buckets;
}
