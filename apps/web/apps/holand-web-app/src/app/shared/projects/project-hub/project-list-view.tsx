'use client';

import { useState } from 'react';
import { Badge, Text } from 'rizzui';
import TaskRow from '../components/task-row';
import type { TaskSummary } from '@/types/projects.types';

export default function ProjectListView({
  tasks,
  onToggle,
  onSelect,
}: {
  tasks: TaskSummary[];
  onToggle: (task: TaskSummary) => void;
  onSelect: (task: TaskSummary) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="rounded-xl border border-muted bg-gray-0 dark:bg-gray-50">
      {selected.length > 0 && (
        <div className="border-b border-muted px-4 py-2 text-xs text-gray-500">
          {selected.length} selected
        </div>
      )}
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggleComplete={onToggle}
          onSelect={(t) => {
            setSelected((s) =>
              s.includes(t.id) ? s.filter((id) => id !== t.id) : [...s, t.id]
            );
            onSelect(t);
          }}
          selected={selected.includes(task.id)}
        />
      ))}
      {!tasks.length && (
        <Text className="py-12 text-center text-gray-400">No tasks in this project</Text>
      )}
    </div>
  );
}
