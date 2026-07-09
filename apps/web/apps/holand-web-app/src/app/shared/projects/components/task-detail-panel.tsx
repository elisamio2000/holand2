'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Select, Text, Textarea, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import type { TaskDetail, TaskStatus } from '@/types/projects.types';

const statusOptions: { label: string; value: TaskStatus }[] = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Review', value: 'review' },
  { label: 'Done', value: 'done' },
];

interface Props {
  task: TaskDetail;
  onStatusChange: (status: TaskStatus) => void;
  onAddComment: (body: string) => void;
  onClose?: () => void;
}

export default function TaskDetailPanel({
  task,
  onStatusChange,
  onAddComment,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');

  return (
    <div className="flex h-full flex-col border-s border-muted bg-gray-0 dark:bg-gray-50">
      <div className="flex items-center justify-between border-b border-muted p-4">
        <Title as="h5" className="text-base font-semibold">
          {t('projects.tasks.detail')}
        </Title>
        {onClose && (
          <Button size="sm" variant="text" onClick={onClose}>
            {t('common.close')}
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <Text className="text-lg font-semibold">{task.title}</Text>
          {task.project_name && (
            <Text className="text-xs text-gray-500">{task.project_name}</Text>
          )}
        </div>

        <Select
          label={t('common.status')}
          options={statusOptions}
          value={task.status}
          onChange={(v: { value: TaskStatus }) => onStatusChange(v.value)}
        />

        {task.description && (
          <Text className="text-sm text-gray-600">{task.description}</Text>
        )}

        {task.custom_fields.length > 0 && (
          <div className="space-y-2">
            <Text className="text-xs font-semibold uppercase text-gray-500">
              {t('projects.tasks.customFields')}
            </Text>
            {task.custom_fields.map((f) => (
              <div key={f.key} className="flex justify-between text-sm">
                <Text className="text-gray-500">{f.label}</Text>
                <Text>{String(f.value ?? '—')}</Text>
              </div>
            ))}
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div>
            <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
              {t('projects.tasks.subtasks')}
            </Text>
            {task.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-1 text-sm">
                <Badge variant="flat" size="sm">
                  {s.status}
                </Badge>
                <Text>{s.title}</Text>
              </div>
            ))}
          </div>
        )}

        {task.checklists.map((cl) => (
          <div key={cl.id}>
            <Text className="mb-2 text-xs font-semibold">{cl.title}</Text>
            {cl.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.done} readOnly />
                <Text className={item.done ? 'text-gray-400 line-through' : ''}>
                  {item.title}
                </Text>
              </div>
            ))}
          </div>
        ))}

        {task.dependencies.length > 0 && (
          <div>
            <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
              {t('projects.tasks.dependencies')}
            </Text>
            {task.dependencies.map((d) => (
              <Text key={d.id} className="text-sm text-amber-700">
                {d.type}: {d.related_task_title ?? d.related_task_id}
              </Text>
            ))}
          </div>
        )}

        <div>
          <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
            {t('projects.tasks.ermineLinks')}
          </Text>
          <div className="flex flex-wrap gap-2">
            {task.links.map((link) => (
              <Link
                key={link.id}
                href={link.href ?? '#'}
                className="text-xs text-primary hover:underline"
              >
                {link.type}: {link.label ?? link.target_id}
              </Link>
            ))}
            {task.case_id && (
              <Link href={`/cases/${task.case_id}`} className="text-xs text-primary">
                Case
              </Link>
            )}
            <Link href={routes.eventCalendar} className="text-xs text-primary">
              {t('nav.calendar')}
            </Link>
            <Link href={routes.messages} className="text-xs text-primary">
              {t('nav.messages')}
            </Link>
          </div>
        </div>

        <div>
          <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
            {t('projects.tasks.comments')}
          </Text>
          {task.comments.map((c) => (
            <div key={c.id} className="mb-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-100/50">
              <Text className="text-xs font-medium">{c.author_name}</Text>
              <Text className="text-sm">{c.body}</Text>
            </div>
          ))}
          <Textarea
            placeholder={t('projects.tasks.addComment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              if (comment.trim()) {
                onAddComment(comment.trim());
                setComment('');
              }
            }}
          >
            {t('common.send')}
          </Button>
        </div>
      </div>
    </div>
  );
}
