'use client';

import { Text } from 'rizzui';
import type { TaskSummary } from '@/types/projects.types';

function barLeft(start?: string): number {
  if (!start) return 0;
  const s = new Date(start).getTime();
  const min = Date.now() - 14 * 86400000;
  const max = Date.now() + 14 * 86400000;
  return Math.max(0, Math.min(100, ((s - min) / (max - min)) * 100));
}

function barWidth(start?: string, due?: string): number {
  const left = barLeft(start);
  const end = due ? new Date(due).getTime() : Date.now() + 7 * 86400000;
  const min = Date.now() - 14 * 86400000;
  const max = Date.now() + 14 * 86400000;
  const right = Math.max(left + 5, Math.min(100, ((end - min) / (max - min)) * 100));
  return right - left;
}

export default function ProjectTimelineView({ tasks }: { tasks: TaskSummary[] }) {
  const withDates = tasks.filter((t) => t.start_at || t.due_at);

  return (
    <div className="space-y-3">
      {withDates.map((task) => (
        <div key={task.id} className="rounded-xl border border-muted bg-gray-0 px-4 py-3 dark:bg-gray-50">
          <Text className="mb-2 text-sm font-medium">{task.title}</Text>
          <div className="relative h-3 rounded-full bg-gray-100">
            <div
              className="absolute top-0 h-3 rounded-full bg-primary/70"
              style={{ left: `${barLeft(task.start_at ?? task.due_at)}%`, width: `${barWidth(task.start_at, task.due_at)}%` }}
            />
          </div>
        </div>
      ))}
      {!withDates.length && (
        <Text className="py-12 text-center text-gray-400">No tasks with start/due dates for timeline</Text>
      )}
    </div>
  );
}
