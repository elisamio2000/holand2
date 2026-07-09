'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Text } from 'rizzui';
import { adminService } from '@/services/admin.service';
import { isWorkspaceMockEnabled } from '@/app/shared/workspace/config/workspace-data-source';
import { MOCK_PERMISSION_SECTIONS } from '@/app/shared/workspace/config/mock-permission-sections';
import type { SectionInfo } from '@/types/auth.types';

interface WorkspaceModulePickerProps {
  value: string;
  onChange: (moduleId: string, label?: string) => void;
  excludeIds?: string[];
}

export default function WorkspaceModulePicker({
  value,
  onChange,
  excludeIds = [],
}: WorkspaceModulePickerProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [usedMock, setUsedMock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await adminService.getPermissionSections();
      if (data.length > 0) {
        setSections(data);
        setUsedMock(false);
      } else if (isWorkspaceMockEnabled()) {
        setSections(MOCK_PERMISSION_SECTIONS);
        setUsedMock(true);
      } else {
        setSections([]);
        setLoadError(true);
      }
    } catch {
      if (isWorkspaceMockEnabled()) {
        setSections(MOCK_PERMISSION_SECTIONS);
        setUsedMock(true);
      } else {
        setSections([]);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exclude = new Set(excludeIds);
  const options = sections
    .filter((s) => s.id && !exclude.has(s.id))
    .map((s) => ({
      value: s.id,
      label: s.description ? `${s.name} — ${s.description}` : s.name || s.id,
    }));

  if (loadError && !loading) {
    return (
      <div className="max-w-md space-y-3 rounded-lg border border-muted bg-gray-50/80 p-4 dark:bg-gray-100/40">
        <Text className="text-sm text-gray-600">{t('workspace.modules.catalogUnavailable')}</Text>
        <Button size="sm" variant="outline" onClick={load}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Select
        label={t('workspace.pickers.module')}
        placeholder={loading ? t('common.loading') : t('workspace.pickers.modulePlaceholder')}
        options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(opt: { value?: string; label?: string } | null) =>
          onChange(opt?.value ?? '', opt?.label)
        }
        className="max-w-md"
      />
      {usedMock && (
        <Text className="text-[10px] text-amber-600">{t('workspace.modules.mockCatalog')}</Text>
      )}
      {value && (
        <Text className="text-xs text-gray-500">
          {t('workspace.pickers.selectedId', { id: value })}
        </Text>
      )}
    </div>
  );
}
