'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Select, Text, Textarea, Title } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import CaseViewDataBanner from '@/app/shared/cases/panels/case-view-data-banner';
import {
  loadExpertNote,
  saveExpertNote,
  exportExpertNotesJson,
  type NoteStatus,
} from '@/services/case-notes-store';

export default function CaseViewExpertNotesPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<NoteStatus>('draft');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadExpertNote(caseId)
      .then((note) => {
        if (cancelled) return;
        if (note) {
          setContent(note.content ?? '');
          setStatus(note.status ?? 'draft');
          setSavedAt(note.timestamp ?? null);
          setOffline(!note.synced);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const save = useCallback(async () => {
    const author =
      session?.user?.name ||
      session?.user?.email ||
      (session?.user as { username?: string })?.username ||
      'Analyst';
    try {
      await saveExpertNote({
        case_id: caseId,
        content,
        status,
        author: String(author),
        timestamp: Date.now(),
      });
      setSavedAt(Date.now());
      setOffline(false);
      toast.success(t('cases.view.expertNotes.saved'));
    } catch {
      setOffline(true);
      toast.error(t('cases.view.expertNotes.saveFailed'));
    }
  }, [caseId, content, session, status, t]);

  const handleExport = () => {
    const json = exportExpertNotesJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expert-notes-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('cases.view.expertNotes.exported'));
  };

  if (loading) {
    return <Text className="text-gray-500">{t('common.loading')}</Text>;
  }

  return (
    <div className="space-y-4">
      {offline ? <CaseViewDataBanner variant="offline" /> : null}
      <Text className="text-sm text-gray-600 dark:text-gray-400">
        {t('cases.view.expertNotes.storageNote')}
      </Text>
      <div className="rounded-lg border border-muted p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Title as="h6" className="text-sm font-semibold">
            {t('cases.view.tabs.expertNotes')}
          </Title>
          <Select
            className="w-36"
            value={status}
            onChange={(v: NoteStatus) => setStatus(v)}
            options={[
              { label: t('cases.view.expertNotes.draft'), value: 'draft' },
              { label: t('cases.view.expertNotes.final'), value: 'final' },
            ]}
            label={t('cases.view.expertNotes.statusLabel')}
          />
        </div>
        <Textarea
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('cases.view.expertNotes.placeholder')}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()}>
              {t('cases.view.expertNotes.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              {t('cases.view.expertNotes.export')}
            </Button>
          </div>
          {savedAt ? (
            <Text className="text-xs text-gray-500">
              {new Date(savedAt).toLocaleString()}
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
