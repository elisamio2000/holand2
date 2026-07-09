'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Loader, Text, Textarea, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { projectsService } from '@/services/projects.service';
import { invalidateProjectsCache } from '@/app/shared/projects/utils/projects-cache';
import { useProjectDocs } from '@/hooks/use-project-extended';
import type { ProjectDoc } from '@/types/projects.types';
import cn from '@core/utils/class-names';

export default function ProjectDocsView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, loading, refetch } = useProjectDocs(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const selected = useMemo(
    () => data?.docs.find((d) => d.id === selectedId) ?? data?.docs[0] ?? null,
    [data?.docs, selectedId]
  );

  const startEdit = (doc: ProjectDoc) => {
    setSelectedId(doc.id);
    setEditContent(doc.content);
  };

  const handleSave = async () => {
    if (!selected) return;
    await projectsService.updateDoc(selected.id, { content: editContent });
    invalidateProjectsCache(`projects:${projectId}:docs`);
    await refetch();
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const result = await projectsService.createDoc(projectId, newTitle.trim(), '# New doc\n\n');
    setNewTitle('');
    invalidateProjectsCache(`projects:${projectId}:docs`);
    await refetch();
    startEdit(result.data);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader variant="spinner" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="rounded-xl border border-muted bg-gray-0 p-3 dark:bg-gray-50">
        <Title as="h6" className="mb-2 text-xs font-semibold uppercase text-gray-500">
          {t('projects.docs.folders', 'Folders')}
        </Title>
        {(data?.folders ?? []).map((f) => (
          <Text key={f.id} className="py-1 text-sm">
            {f.name}
          </Text>
        ))}
        <div className="mt-4 border-t border-muted pt-3">
          {(data?.docs ?? []).map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => startEdit(doc)}
              className={cn(
                'block w-full rounded px-2 py-1.5 text-start text-sm hover:bg-gray-50',
                selected?.id === doc.id && 'bg-primary/10 font-medium text-primary'
              )}
            >
              {doc.title}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('projects.docs.newDoc', 'New doc')} />
          <Button size="sm" variant="outline" onClick={() => void handleCreate()}>
            {t('common.create')}
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        {selected ? (
          <>
            <Title as="h5" className="mb-3 text-base font-semibold">
              {selected.title}
            </Title>
            <Textarea rows={14} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
            <Button className="mt-3" variant="solid" size="sm" onClick={() => void handleSave()}>
              {t('common.save')}
            </Button>
          </>
        ) : (
          <Text className="text-gray-400">{t('projects.docs.empty', 'Select or create a doc')}</Text>
        )}
      </div>
    </div>
  );
}
