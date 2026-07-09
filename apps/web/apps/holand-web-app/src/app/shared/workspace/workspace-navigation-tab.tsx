'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { PiEyeBold, PiEyeSlashBold, PiStarBold, PiStarFill } from 'react-icons/pi';
import { ActionIcon, Button, Input, Select, Switch, Text, Title } from 'rizzui';
import WorkspaceSettingsStickyFooter from '@/app/shared/workspace/components/workspace-settings-sticky-footer';
import cn from '@core/utils/class-names';
import { SortableList } from '@core/components/dnd/dnd-sortable-list';
import { DragHandle, SortableItem } from '@core/components/dnd/dnd-sortable-item';
import { MENU_CATALOG } from '@/lib/menu-catalog';
import { buildDefaultTeamPreset } from '@/lib/menu-catalog-utils';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import { WORKSPACE_NAV_TEMPLATES } from '@/lib/workspace-nav-templates';
import { resolveWorkspaceMenuItems } from '@/lib/resolve-workspace-menu';
import { workspaceService } from '@/services/workspace.service';
import type {
  WorkspaceNavTemplateId,
  WorkspaceTeamNavPreset,
  WorkspaceUserNavOverlay,
} from '@/types/workspace-nav.types';

export type WorkspaceNavigationMode = 'full' | 'member';

interface WorkspaceNavigationTabProps {
  workspaceId: string;
  mode?: WorkspaceNavigationMode;
  userRole?: string | null;
}

const TEMPLATE_OPTIONS = (
  Object.keys(WORKSPACE_NAV_TEMPLATES) as WorkspaceNavTemplateId[]
).map((id) => ({
  value: id,
  label: WORKSPACE_NAV_TEMPLATES[id].labelKey,
}));

type SortableNavRow = {
  id: string;
  nameKey: string;
  visible: boolean;
  order: number;
};

export default function WorkspaceNavigationTab({
  workspaceId,
  mode = 'full',
  userRole,
}: WorkspaceNavigationTabProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? 'anonymous';
  const showTeamPreset = mode === 'full';

  const [teamPreset, setTeamPreset] = useState<WorkspaceTeamNavPreset>(() =>
    buildDefaultTeamPreset(menuItems)
  );
  const [userOverlay, setUserOverlay] = useState<WorkspaceUserNavOverlay>({
    schemaVersion: 1,
    pinnedIds: [],
    hiddenIds: [],
    orderOverrides: {},
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analystHintShown, setAnalystHintShown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [navSubTab, setNavSubTab] = useState<'team' | 'shortcuts' | 'preview'>('team');

  const catalogLinks = useMemo(() => MENU_CATALOG.filter((c) => c.type === 'link'), []);

  const sectionHeaders = useMemo(
    () => MENU_CATALOG.filter((c) => c.type === 'section').map((c) => c.id),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [team, user] = await Promise.all([
        workspaceService.getTeamNavPreset(workspaceId),
        workspaceService.getUserNavOverlay(userId, workspaceId),
      ]);
      const resolvedTeam = team ?? buildDefaultTeamPreset(menuItems);
      setTeamPreset(resolvedTeam);
      setUserOverlay(
        user ?? { schemaVersion: 1, pinnedIds: [], hiddenIds: [], orderOverrides: {} }
      );

      if (
        showTeamPreset &&
        userRole === 'analyst' &&
        !analystHintShown &&
        (!team || team.templateId === 'custom')
      ) {
        setAnalystHintShown(true);
        toast(t('workspace.nav.analystTemplateHint'), { icon: 'ðŸ’¡', duration: 5000 });
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userId, showTeamPreset, userRole, analystHintShown]);

  useEffect(() => {
    load();
  }, [load]);

  const orderedItems = useMemo((): SortableNavRow[] => {
    const map = new Map(teamPreset.items.map((i) => [i.id, i]));
    return catalogLinks
      .map((link, idx) => {
        const ref = map.get(link.id);
        return {
          id: link.id,
          nameKey: link.nameKey,
          visible: ref?.visible ?? true,
          order: ref?.order ?? idx,
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [teamPreset, catalogLinks]);

  const preview = useMemo(
    () =>
      resolveWorkspaceMenuItems(
        menuItems,
        teamPreset,
        userOverlay,
        userOverlay.pinnedIds
      ),
    [teamPreset, userOverlay]
  );

  const handleTeamDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.findIndex((i) => i.id === active.id);
    const newIndex = orderedItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setTeamPreset((prev) => ({
      ...prev,
      items: reordered.map((item, order) => ({
        id: item.id,
        visible: item.visible,
        order,
      })),
    }));
  };

  const toggleVisible = (id: string) => {
    setTeamPreset((prev) => ({
      ...prev,
      items: prev.items.some((i) => i.id === id)
        ? prev.items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i))
        : [...prev.items, { id, visible: false, order: prev.items.length }],
    }));
  };

  const toggleSectionHidden = (sectionId: string) => {
    setTeamPreset((prev) => {
      const hidden = new Set(prev.hiddenSections ?? []);
      if (hidden.has(sectionId)) hidden.delete(sectionId);
      else hidden.add(sectionId);
      return { ...prev, hiddenSections: Array.from(hidden) };
    });
  };

  const applyTemplate = (templateId: WorkspaceNavTemplateId) => {
    if (templateId === 'custom') return;
    setTeamPreset(WORKSPACE_NAV_TEMPLATES[templateId].preset);
  };

  const togglePin = (id: string) => {
    setUserOverlay((prev) => {
      const pinned = prev.pinnedIds.includes(id)
        ? prev.pinnedIds.filter((p) => p !== id)
        : [...prev.pinnedIds, id];
      return { ...prev, pinnedIds: pinned };
    });
  };

  const toggleHideForMe = (id: string) => {
    setUserOverlay((prev) => {
      const hidden = prev.hiddenIds.includes(id)
        ? prev.hiddenIds.filter((h) => h !== id)
        : [...prev.hiddenIds, id];
      return { ...prev, hiddenIds: hidden };
    });
  };

  const resetUserOverlay = () => {
    setUserOverlay({
      schemaVersion: 1,
      pinnedIds: [],
      hiddenIds: [],
      orderOverrides: {},
    });
  };

  const saveTeam = async () => {
    setSaving(true);
    try {
      await workspaceService.saveTeamNavPreset(workspaceId, teamPreset);
      window.dispatchEvent(
        new CustomEvent('Holand:workspace-nav-changed', { detail: { workspaceId } })
      );
      toast.success(t('workspace.nav.teamSaved'));
    } catch {
      toast.error(t('workspace.nav.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async () => {
    setSaving(true);
    try {
      await workspaceService.saveUserNavOverlay(userId, workspaceId, userOverlay);
      window.dispatchEvent(
        new CustomEvent('Holand:workspace-nav-changed', { detail: { workspaceId } })
      );
      toast.success(t('workspace.nav.userSaved'));
    } catch {
      toast.error(t('workspace.nav.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const resetTeamDefault = () => {
    setTeamPreset(buildDefaultTeamPreset(menuItems));
  };

  if (loading) return null;

  const hiddenSections = new Set(teamPreset.hiddenSections ?? []);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (nameKey: string) =>
    !normalizedSearch || t(nameKey).toLowerCase().includes(normalizedSearch);
  const filteredTeamItems = orderedItems.filter((item) => matchesSearch(item.nameKey));
  const filteredShortcutLinks = catalogLinks.filter((link) => matchesSearch(link.nameKey));

  const previewPanel = (
    <div className="rounded-lg border border-muted bg-gray-50/80 p-3 dark:bg-gray-100/40">
      <Title as="h5" className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t('workspace.nav.preview')}
      </Title>
      {preview.pinnedLinks.length > 0 && (
        <div className="mb-2 border-b border-muted pb-2">
          <Text className="mb-1 text-[10px] font-semibold text-primary">
            {t('workspace.nav.favorites')}
          </Text>
          {preview.pinnedLinks.map((p) => (
            <div key={p.name} className="truncate py-0.5 text-xs">
              {t(p.name)}
            </div>
          ))}
        </div>
      )}
      <div className="max-h-80 space-y-0.5 overflow-y-auto">
        {preview.menuItems
          .filter((i) => i.href)
          .map((i) => (
            <div key={i.name} className="truncate py-0.5 text-xs text-gray-700">
              {t(i.name)}
            </div>
          ))}
      </div>
    </div>
  );

  const teamPanel = showTeamPreset ? (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t('workspace.nav.template')}
          options={TEMPLATE_OPTIONS.map((o) => ({
            value: o.value,
            label: t(o.label),
          }))}
          value={{
            value: teamPreset.templateId ?? 'custom',
            label: t(
              WORKSPACE_NAV_TEMPLATES[teamPreset.templateId ?? 'custom'].labelKey
            ),
          }}
          onChange={(opt: { value?: WorkspaceNavTemplateId } | null) => {
            if (opt?.value) applyTemplate(opt.value);
          }}
          className="min-w-[200px] flex-1"
        />
        <Input
          placeholder={t('workspace.nav.searchItems')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-[200px] flex-1"
        />
      </div>

      <div className="rounded-lg border border-muted p-3">
        <Text className="mb-2 text-xs font-medium text-gray-600">
          {t('workspace.nav.sections')}
        </Text>
        <div className="grid gap-2 sm:grid-cols-2">
          {sectionHeaders.map((sectionId) => (
            <div
              key={sectionId}
              className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-100/50"
            >
              <span className="truncate text-xs font-medium">{t(sectionId)}</span>
              <Switch
                size="sm"
                checked={!hiddenSections.has(sectionId)}
                onChange={() => toggleSectionHidden(sectionId)}
                aria-label={t(sectionId)}
              />
            </div>
          ))}
        </div>
      </div>

      <SortableList items={filteredTeamItems} onChange={handleTeamDragEnd}>
        <ul className="max-h-80 divide-y divide-muted overflow-y-auto rounded-lg border border-muted">
          {filteredTeamItems.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              <li className="flex items-center gap-2 bg-white px-3 py-2 text-sm dark:bg-gray-50">
                <DragHandle className="cursor-grab text-gray-400" />
                <span className="min-w-0 flex-1 truncate">{t(item.nameKey)}</span>
                <Switch
                  size="sm"
                  checked={item.visible}
                  onChange={() => toggleVisible(item.id)}
                  aria-label={t(item.nameKey)}
                />
              </li>
            </SortableItem>
          ))}
        </ul>
      </SortableList>
    </section>
  ) : null;

  const shortcutsPanel = (
    <section className="space-y-4">
      <Input
        placeholder={t('workspace.nav.searchItems')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <ul className="max-h-80 divide-y divide-muted overflow-y-auto rounded-lg border border-muted">
        {filteredShortcutLinks.map((link) => {
          const pinned = userOverlay.pinnedIds.includes(link.id);
          const hidden = userOverlay.hiddenIds.includes(link.id);
          return (
            <li key={link.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{t(link.nameKey)}</span>
              <ActionIcon
                size="sm"
                variant={pinned ? 'solid' : 'outline'}
                onClick={() => togglePin(link.id)}
                title={t('workspace.nav.pin')}
              >
                {pinned ? (
                  <PiStarFill className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <PiStarBold className="h-3.5 w-3.5" />
                )}
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="outline"
                onClick={() => toggleHideForMe(link.id)}
                title={t('workspace.nav.hideForMe')}
              >
                {hidden ? (
                  <PiEyeSlashBold className="h-3.5 w-3.5" />
                ) : (
                  <PiEyeBold className="h-3.5 w-3.5" />
                )}
              </ActionIcon>
            </li>
          );
        })}
      </ul>
    </section>
  );

  if (!showTeamPreset) {
    return (
      <div className="space-y-4">
        <Text className="text-xs text-gray-500">{t('workspace.nav.myShortcutsHint')}</Text>
        <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          {shortcutsPanel}
        </div>
      </div>
    );
  }

  const subTabs: { id: typeof navSubTab; label: string }[] = [
    { id: 'team', label: t('workspace.nav.tabTeam') },
    { id: 'shortcuts', label: t('workspace.nav.tabShortcuts') },
    { id: 'preview', label: t('workspace.nav.preview') },
  ];

  return (
    <div className="space-y-4">
      <Text className="text-xs text-gray-500">{t('workspace.nav.teamPresetHint')}</Text>

      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-200/70">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setNavSubTab(tab.id)}
            className={cn(
              'rounded-md px-3 py-2 text-xs font-medium transition-colors',
              navSubTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-50'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
        {navSubTab === 'team' && teamPanel}
        {navSubTab === 'shortcuts' && shortcutsPanel}
        {navSubTab === 'preview' && previewPanel}
      </div>

      {navSubTab === 'team' && (
        <WorkspaceSettingsStickyFooter hint={t('workspace.nav.teamPresetHint')}>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={resetTeamDefault}>
              {t('workspace.nav.resetPlatform')}
            </Button>
            <Button onClick={saveTeam} isLoading={saving}>
              {t('workspace.nav.saveTeam')}
            </Button>
          </div>
        </WorkspaceSettingsStickyFooter>
      )}

      {navSubTab === 'shortcuts' && (
        <WorkspaceSettingsStickyFooter hint={t('workspace.nav.shortcutsHint')}>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={resetUserOverlay}>
              {t('workspace.nav.resetTeamDefault')}
            </Button>
            <Button onClick={saveUser} isLoading={saving}>
              {t('workspace.nav.saveMyShortcuts')}
            </Button>
          </div>
        </WorkspaceSettingsStickyFooter>
      )}
    </div>
  );
}

