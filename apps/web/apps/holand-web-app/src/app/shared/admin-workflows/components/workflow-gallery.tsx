// ============================================
// WorkflowGallery — Enhanced gallery with categories, favorites, preview
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Input, Text, Title, ActionIcon, Loader } from 'rizzui';
import {
  PiPlusBold,
  PiFlowArrowBold,
  PiTrashBold,
  PiPencilBold,
  PiMagnifyingGlassBold,
  PiDownloadBold,
  PiLayoutBold,
  PiClockBold,
  PiHashBold,
  PiStarBold,
  PiStarFill,
  PiGridFourBold,
  PiListBold,
  PiTagBold,
  PiFunnelBold,
  PiPlayBold,
  PiCopyBold,
  PiEyeBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';

import { workflowService } from '@/services/workflow.service';
import type { WorkflowDefinition, WorkflowTemplate } from '@/types/workflow.types';

const LOG_TAG = '[WorkflowGallery]';

type ViewLayout = 'grid' | 'list';
type FilterCategory = 'all' | 'favorites' | 'active' | 'draft' | 'recent';

const FAVORITES_KEY = 'wf_favorites';
function loadFavorites(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(parsed as string[]);
  } catch {
    return new Set();
  }
}
function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

interface WorkflowGalleryProps {
  onEdit: (workflow: WorkflowDefinition) => void;
  onCreateNew: () => void;
  onUseTemplate: (template: WorkflowTemplate) => void;
}

export default function WorkflowGallery({
  onEdit,
  onCreateNew,
  onUseTemplate,
}: WorkflowGalleryProps) {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [layout, setLayout] = useState<ViewLayout>('grid');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [previewWf, setPreviewWf] = useState<WorkflowDefinition | null>(null);

  const templates = useMemo(
    () => workflowService.getBuiltinTemplates(),
    []
  );

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const list = await workflowService.listWorkflows();
      setWorkflows(list);
    } catch (err) {
      console.error(LOG_TAG, 'Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const filtered = useMemo(() => {
    let result = [...workflows];

    if (category === 'favorites') {
      result = result.filter((w) => favorites.has(w.id));
    } else if (category === 'active') {
      result = result.filter((w) => w.is_active !== false);
    } else if (category === 'draft') {
      result = result.filter((w) => w.is_active === false);
    } else if (category === 'recent') {
      result.sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() -
          new Date(a.updated_at ?? 0).getTime()
      );
      result = result.slice(0, 6);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description?.toLowerCase().includes(q) ||
          w.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [workflows, search, category, favorites]);

  const handleDelete = useCallback(
    async (wf: WorkflowDefinition) => {
      if (!confirm(t('workflow.gallery.deleteConfirm'))) return;
      console.info(LOG_TAG, 'Deleting workflow:', wf.id);
      setDeleting(wf.id);
      try {
        await workflowService.deleteWorkflow(wf.id);
        toast.success(`${wf.name} deleted`);
        loadWorkflows();
      } catch (err) {
        console.error(LOG_TAG, 'Delete failed:', err);
        toast.error(t('common.error'));
      } finally {
        setDeleting(null);
      }
    },
    [loadWorkflows, t]
  );

  const handleDuplicate = useCallback(
    async (wf: WorkflowDefinition) => {
      const copy: WorkflowDefinition = {
        ...wf,
        id: '',
        name: `${wf.name} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      try {
        await workflowService.createWorkflow(copy);
        toast.success('Workflow duplicated');
        loadWorkflows();
      } catch {
        toast.error('Duplicate failed');
      }
    },
    [loadWorkflows]
  );

  const categoryTabs: { key: FilterCategory; label: string; count?: number }[] =
    [
      { key: 'all', label: t('workflow.gallery.filterAll'), count: workflows.length },
      { key: 'favorites', label: t('workflow.gallery.filterFavorites'), count: workflows.filter((w) => favorites.has(w.id)).length },
      { key: 'active', label: t('workflow.gallery.filterActive') },
      { key: 'draft', label: t('workflow.gallery.filterDraft') },
      { key: 'recent', label: t('workflow.gallery.filterRecent') },
    ];

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <PiMagnifyingGlassBold className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            size="sm"
            placeholder={t('workflow.gallery.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
            inputClassName="ps-9"
          />
        </div>

        {/* Layout toggle */}
        <div className="flex rounded-lg border border-muted">
          <button
            type="button"
            onClick={() => setLayout('grid')}
            className={cn(
              'rounded-s-lg px-2 py-1.5 transition-colors',
              layout === 'grid'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <PiGridFourBold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setLayout('list')}
            className={cn(
              'rounded-e-lg px-2 py-1.5 transition-colors',
              layout === 'list'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <PiListBold className="h-4 w-4" />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTemplates(!showTemplates)}
          className="gap-1"
        >
          <PiLayoutBold className="h-3.5 w-3.5" />
          {t('workflow.gallery.fromTemplate')}
        </Button>

        <Button size="sm" onClick={onCreateNew} className="gap-1">
          <PiPlusBold className="h-3.5 w-3.5" />
          {t('workflow.gallery.newWorkflow')}
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-muted">
        {categoryTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategory(tab.key)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              category === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px]',
                  category === tab.key
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-200'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Templates Section */}
      {showTemplates && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <Text className="text-sm font-semibold">
                {t('workflow.templates.title')}
              </Text>
              <Text className="text-xs text-gray-500">
                {t('workflow.templates.description')}
              </Text>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="group rounded-lg border border-muted bg-white p-3 transition-all hover:border-primary/30 hover:shadow-sm dark:bg-gray-50"
              >
                {/* Category badge */}
                {tpl.category && (
                  <Badge
                    variant="flat"
                    size="sm"
                    className="mb-2 text-[9px]"
                  >
                    {tpl.category}
                  </Badge>
                )}
                <Text className="font-medium">{tpl.name}</Text>
                <Text className="mb-2 text-xs text-gray-500">
                  {tpl.description}
                </Text>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm">
                    {tpl.definition.nodes.length} nodes
                  </Badge>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUseTemplate(tpl)}
                    className="gap-1"
                  >
                    <PiPlusBold className="h-3 w-3" />
                    {t('workflow.templates.useTemplate')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Grid/List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted p-12 text-center">
          <PiFlowArrowBold className="mx-auto h-12 w-12 text-gray-300" />
          <Title as="h5" className="mt-3 text-gray-500">
            {category === 'favorites'
              ? t('workflow.gallery.noFavorites')
              : t('workflow.gallery.noWorkflows')}
          </Title>
          {category !== 'favorites' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateNew}
              className="mt-4 gap-1"
            >
              <PiPlusBold className="h-3.5 w-3.5" />
              {t('workflow.gallery.newWorkflow')}
            </Button>
          )}
        </div>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((wf) => (
            <WorkflowCard
              key={wf.id}
              wf={wf}
              isFavorite={favorites.has(wf.id)}
              onToggleFavorite={() => toggleFavorite(wf.id)}
              onEdit={() => onEdit(wf)}
              onDelete={() => handleDelete(wf)}
              onDuplicate={() => handleDuplicate(wf)}
              onPreview={() => setPreviewWf(wf)}
              deleting={deleting === wf.id}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((wf) => (
            <WorkflowListItem
              key={wf.id}
              wf={wf}
              isFavorite={favorites.has(wf.id)}
              onToggleFavorite={() => toggleFavorite(wf.id)}
              onEdit={() => onEdit(wf)}
              onDelete={() => handleDelete(wf)}
              deleting={deleting === wf.id}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Quick Preview Modal */}
      {previewWf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setPreviewWf(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-xl overflow-auto rounded-2xl border border-muted bg-white p-6 shadow-2xl dark:bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <Title as="h5">{previewWf.name}</Title>
              <Button
                variant="text"
                size="sm"
                onClick={() => setPreviewWf(null)}
              >
                Close
              </Button>
            </div>
            {previewWf.description && (
              <Text className="mb-3 text-sm text-gray-500">
                {previewWf.description}
              </Text>
            )}
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="flat" size="sm">
                {previewWf.nodes.length} nodes
              </Badge>
              <Badge variant="flat" size="sm">
                {previewWf.edges.length} edges
              </Badge>
              {previewWf.version && (
                <Badge variant="outline" size="sm">
                  v{previewWf.version}
                </Badge>
              )}
            </div>
            {previewWf.tags && previewWf.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {previewWf.tags.map((tag) => (
                  <Badge key={tag} variant="outline" size="sm" className="text-[10px]">
                    <PiTagBold className="me-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-100">
              <Text className="mb-2 text-[10px] font-semibold uppercase text-gray-400">
                Node List
              </Text>
              <div className="space-y-1">
                {previewWf.nodes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="font-medium">{n.data.label}</span>
                    <span className="text-gray-400">({n.data.kind})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewWf(null);
                  onEdit(previewWf);
                }}
                className="gap-1"
              >
                <PiPencilBold className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Grid card component */
function WorkflowCard({
  wf,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  deleting,
  t,
}: {
  wf: WorkflowDefinition;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  deleting: boolean;
  t: (k: string) => string;
}) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border border-muted bg-white p-4 transition-all',
        'hover:border-primary/30 hover:shadow-md',
        'dark:bg-gray-50'
      )}
    >
      {/* Favorite button */}
      <button
        type="button"
        onClick={onToggleFavorite}
        className="absolute end-3 top-3 text-gray-300 transition-colors hover:text-amber-400"
      >
        {isFavorite ? (
          <PiStarFill className="h-4 w-4 text-amber-400" />
        ) : (
          <PiStarBold className="h-4 w-4 opacity-0 group-hover:opacity-100" />
        )}
      </button>

      {/* Header */}
      <div className="mb-3 pe-6">
        <Text className="truncate font-semibold text-gray-800 dark:text-gray-200">
          {wf.name}
        </Text>
        {wf.description && (
          <Text className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            {wf.description}
          </Text>
        )}
      </div>

      {/* Stats */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <PiFlowArrowBold className="h-3 w-3" />
          {wf.nodes.length} nodes
        </div>
        {wf.version && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <PiHashBold className="h-3 w-3" />
            v{wf.version}
          </div>
        )}
        {wf.updated_at && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <PiClockBold className="h-3 w-3" />
            {new Date(wf.updated_at).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="mb-3">
        <Badge variant="flat" size="sm" color={wf.is_active !== false ? 'success' : 'secondary'}>
          {wf.is_active !== false ? 'Active' : 'Draft'}
        </Badge>
      </div>

      {/* Tags */}
      {wf.tags && wf.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {wf.tags.map((tag) => (
            <Badge key={tag} variant="outline" size="sm" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 border-t border-muted pt-3">
        <Tooltip content="Preview">
          <ActionIcon variant="text" size="sm" onClick={onPreview}>
            <PiEyeBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content="Duplicate">
          <ActionIcon variant="text" size="sm" onClick={onDuplicate}>
            <PiCopyBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('workflow.editor.export')}>
          <ActionIcon
            variant="text"
            size="sm"
            onClick={() => {
              const json = workflowService.exportToJson(wf);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${wf.name.replace(/\s+/g, '_')}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <PiDownloadBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('common.delete')}>
          <ActionIcon
            variant="text"
            color="danger"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader size="sm" />
            ) : (
              <PiTrashBold className="h-4 w-4" />
            )}
          </ActionIcon>
        </Tooltip>
        <Button size="sm" onClick={onEdit} className="ms-1 gap-1">
          <PiPencilBold className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    </div>
  );
}

/** List view row component */
function WorkflowListItem({
  wf,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
  deleting,
  t,
}: {
  wf: WorkflowDefinition;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  t: (k: string) => string;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-muted bg-white px-4 py-3 transition-all',
        'hover:border-primary/30 hover:shadow-sm',
        'dark:bg-gray-50'
      )}
    >
      {/* Favorite */}
      <button type="button" onClick={onToggleFavorite}>
        {isFavorite ? (
          <PiStarFill className="h-4 w-4 text-amber-400" />
        ) : (
          <PiStarBold className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
        )}
      </button>

      {/* Name */}
      <div className="min-w-0 flex-1">
        <Text className="truncate font-semibold text-gray-800 dark:text-gray-200">
          {wf.name}
        </Text>
        {wf.description && (
          <Text className="truncate text-xs text-gray-500">{wf.description}</Text>
        )}
      </div>

      {/* Stats */}
      <div className="hidden items-center gap-3 text-xs text-gray-500 md:flex">
        <span className="flex items-center gap-1">
          <PiFlowArrowBold className="h-3 w-3" />
          {wf.nodes.length}
        </span>
        {wf.updated_at && (
          <span className="flex items-center gap-1">
            <PiClockBold className="h-3 w-3" />
            {new Date(wf.updated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <Badge variant="flat" size="sm" color={wf.is_active !== false ? 'success' : 'secondary'}>
        {wf.is_active !== false ? 'Active' : 'Draft'}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <ActionIcon variant="text" color="danger" size="sm" onClick={onDelete} disabled={deleting}>
          {deleting ? <Loader size="sm" /> : <PiTrashBold className="h-4 w-4" />}
        </ActionIcon>
        <Button size="sm" onClick={onEdit} className="gap-1">
          <PiPencilBold className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    </div>
  );
}
