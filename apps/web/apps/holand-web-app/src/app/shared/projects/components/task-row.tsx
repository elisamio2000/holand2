'use client';

import Link from 'next/link';
import { ActionIcon, Badge, Checkbox, Text } from 'rizzui';
import { PiWarningCircleBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import type { TaskSummary } from '@/types/projects.types';

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-400',
};

interface TaskRowProps {
  task: TaskSummary;
  onToggleComplete?: (task: TaskSummary) => void;
  onSelect?: (task: TaskSummary) => void;
  selected?: boolean;
}

export default function TaskRow({
  task,
  onToggleComplete,
  onSelect,
  selected,
}: TaskRowProps) {
  const overdue =
    task.due_at &&
    new Date(task.due_at).getTime() < Date.now() &&
    task.status !== 'done' &&
    task.status !== 'canceled';

  return (
    <div
      className={cn(
        'grid grid-cols-12 items-center gap-3 border-b border-muted px-4 py-3 last:border-0',
        overdue && 'border-s-2 border-s-red-400 bg-red-50/30 dark:bg-red-950/10',
        selected && 'bg-primary/5'
      )}
      onClick={() => onSelect?.(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(task)}
    >
      <div className="col-span-5 flex items-center gap-3">
        <Checkbox
          checked={task.status === 'done'}
          onChange={() => onToggleComplete?.(task)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="min-w-0">
          <Text className="truncate text-sm font-medium">{task.title}</Text>
          {task.project_name && (
            <Text className="truncate text-xs text-gray-500">{task.project_name}</Text>
          )}
        </div>
        {task.is_blocked && (
          <PiWarningCircleBold className="h-4 w-4 shrink-0 text-amber-500" title="Blocked" />
        )}
      </div>
      <div className="col-span-2">
        <Badge variant="flat" size="sm">
          {task.status.replace('_', ' ')}
        </Badge>
      </div>
      <div className="col-span-2 flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', priorityColors[task.priority])} />
        <Text className="text-xs capitalize">{task.priority}</Text>
      </div>
      <div className="col-span-2">
        <Text className={cn('text-xs', overdue && 'font-medium text-red-600')}>
          {task.due_at ? new Date(task.due_at).toLocaleDateString() : '—'}
        </Text>
      </div>
      <div className="col-span-1">
        {task.case_id && (
          <Link
            href={`/cases/${task.case_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline"
          >
            Case
          </Link>
        )}
      </div>
    </div>
  );
}
