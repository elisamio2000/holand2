'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { projectsService } from '@/services/projects.service';
import { invalidateProjectsCache } from '@/app/shared/projects/utils/projects-cache';
import { useProjectDiscussion } from '@/hooks/use-project-extended';

export default function ProjectDiscussionView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: threads, loading, refetch } = useProjectDiscussion(projectId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await projectsService.createDiscussionThread(projectId, title.trim(), body.trim());
      setTitle('');
      setBody('');
      invalidateProjectsCache(`projects:${projectId}:discussion`);
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader variant="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        <Title as="h6" className="mb-3 text-sm font-semibold">
          {t('projects.discussion.newThread', 'New thread')}
        </Title>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('common.title', 'Title')} />
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('projects.discussion.message', 'Message')} />
          <Button variant="solid" size="sm" disabled={saving} onClick={() => void handleCreate()}>
            {t('common.post', 'Post')}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {(threads ?? []).map((thread) => (
          <div key={thread.id} className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50">
            <Text className="font-semibold">{thread.title}</Text>
            <Text className="mt-2 text-sm text-gray-600">{thread.body}</Text>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                {thread.author_name} · {thread.reply_count} {t('projects.discussion.replies', 'replies')}
              </span>
              {thread.message_partner_id && (
                <Link
                  href={routes.messagesPeopleChat(thread.message_partner_id)}
                  className="text-primary hover:underline"
                >
                  {t('projects.discussion.openInMessages', 'Open in Messages')}
                </Link>
              )}
            </div>
          </div>
        ))}
        {!threads?.length && (
          <Text className="py-8 text-center text-gray-400">
            {t('projects.discussion.empty', 'No discussion threads yet')}
          </Text>
        )}
      </div>
    </div>
  );
}
