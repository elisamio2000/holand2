'use client';

import { Button, Text } from 'rizzui';
import { PiDownloadSimpleBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import type { TaskSummary } from '@/types/projects.types';

function exportTasksCsv(tasks: TaskSummary[]) {
  const headers = ['id', 'title', 'status', 'priority', 'assignee', 'due_at', 'case_id'];
  const rows = tasks.map((t) =>
    [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.assignee_name ?? '',
      t.due_at ?? '',
      t.case_id ?? '',
    ].join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProjectTableView({ tasks }: { tasks: TaskSummary[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!tasks.length}
          onClick={() => exportTasksCsv(tasks)}
        >
          <PiDownloadSimpleBold className="h-4 w-4" />
          {t('projects.table.exportCsv', 'Export CSV')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-muted">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-gray-50/80 text-xs uppercase text-gray-500 dark:bg-gray-100/50">
            <tr>
              <th className="px-4 py-3 text-start">{t('projects.table.title', 'Title')}</th>
              <th className="px-4 py-3 text-start">{t('common.status')}</th>
              <th className="px-4 py-3 text-start">{t('projects.table.priority', 'Priority')}</th>
              <th className="px-4 py-3 text-start">{t('projects.table.assignee', 'Assignee')}</th>
              <th className="px-4 py-3 text-start">{t('projects.table.due', 'Due')}</th>
              <th className="px-4 py-3 text-start">{t('projects.table.case', 'Case')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-muted">
                <td className="px-4 py-3 font-medium">{task.title}</td>
                <td className="px-4 py-3">{task.status}</td>
                <td className="px-4 py-3">{task.priority}</td>
                <td className="px-4 py-3">{task.assignee_name ?? '—'}</td>
                <td className="px-4 py-3">
                  {task.due_at ? new Date(task.due_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">{task.case_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tasks.length && (
          <Text className="py-12 text-center text-gray-400">{t('projects.myTasks.noTasks')}</Text>
        )}
      </div>
    </div>
  );
}
