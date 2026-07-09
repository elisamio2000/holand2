'use client';

import { Badge, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { TaskSummary } from '@/types/projects.types';

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function ProjectCalendarView({ tasks }: { tasks: TaskSummary[] }) {
  const { t } = useTranslation();
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const tasksByDay = (day: Date) =>
    tasks.filter((task) => {
      if (!task.due_at) return false;
      const due = new Date(task.due_at);
      return due.toDateString() === day.toDateString();
    });

  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((day) => (
        <div key={day.toISOString()} className="min-h-[120px] rounded-xl border border-muted bg-gray-0 p-2 dark:bg-gray-50">
          <Text className="text-xs font-semibold text-gray-500">
            {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <div className="mt-2 space-y-1">
            {tasksByDay(day).map((task) => (
              <div key={task.id} className="rounded bg-primary/10 px-2 py-1 text-xs">
                {task.title}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!tasks.some((t) => t.due_at) && (
        <Text className="col-span-full py-4 text-center text-sm text-gray-400">
          {t('projects.calendar.noDue', 'No tasks with due dates this week')}
        </Text>
      )}
    </div>
  );
}
