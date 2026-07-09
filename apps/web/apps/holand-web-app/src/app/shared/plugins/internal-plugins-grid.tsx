// ============================================
// InternalPluginsGrid — Grid/List view for internal plugins (GET /tools via gateway)
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Title, Text, Badge, Loader, Button, Input, ActionIcon } from 'rizzui';
import {
  PiPlugDuotone,
  PiMagnifyingGlassBold,
  PiArrowClockwiseBold,
  PiPlayBold,
  PiEyeBold,
  PiCubeBold,
  PiGridFourBold,
  PiListBold,
  PiTagBold,
  PiGearSixBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';
import { pluginsService } from '@/services/plugins.service';
import { hasNativeRenderer } from '@/app/shared/plugins/plugin-registry';
import { routes } from '@/config/routes';
import type { PluginInfo } from '@/types/plugins.types';

export default function InternalPluginsGrid() {
  const { t } = useTranslation();
  const router = useRouter();

  const [tools, setTools] = useState<PluginInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchData = useCallback(async () => {
    console.info('[InternalPluginsGrid] Fetching tools and categories...');
    setLoading(true);
    setError(null);
    try {
      const toolsData = await pluginsService.listTools();
      const toolsArr = Array.isArray(toolsData) ? toolsData : [];

      let catsData: string[] = [];
      try {
        catsData = await pluginsService.listCategories();
      } catch (catErr) {
        console.warn(
          '[InternalPluginsGrid] GET /tools/categories failed — deriving categories from tools list',
          catErr
        );
        catsData = Array.from(
          new Set(toolsArr.map((x) => x.category).filter((c): c is string => Boolean(c)))
        );
      }

      setTools(toolsArr);
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load plugins';
      console.error('[InternalPluginsGrid] Fetch failed:', err);
      setError(errorMsg);
      toast.error(t('errors.loadPlugins'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = Array.isArray(tools) ? tools : [];

    if (selectedCategory !== 'all') {
      result = pluginsService.filterByCategory(result, selectedCategory);
    }

    if (search.trim()) {
      result = pluginsService.searchPlugins(result, search);
    }

    return result;
  }, [tools, search, selectedCategory]);

  const stats = useMemo(() => {
    const toolsArray = Array.isArray(tools) ? tools : [];
    const uniqueCategories = new Set(toolsArray.map((x) => x.category).filter(Boolean));
    const active = toolsArray.filter((x) => x.is_active !== false).length;
    return {
      total: toolsArray.length,
      categories: uniqueCategories.size,
      active,
    };
  }, [tools]);

  const handleViewPlugin = (toolId: string) => {
    router.push(routes.plugins.detail(toolId));
  };

  const getCategoryColor = pluginsService.getCategoryColor;

  const rowKey = (tool: PluginInfo, index: number) =>
    tool.tool_id || tool.id || `tool-${index}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('plugins.stats.totalTools')}
          metric={stats.total}
          icon={<PiCubeBold className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
        />
        <MetricCard
          title={t('plugins.stats.categories')}
          metric={stats.categories}
          icon={<PiTagBold className="h-6 w-6 text-blue-500" />}
          iconClassName="bg-blue-100 dark:bg-blue-900/30"
        />
        <MetricCard
          title={t('plugins.stats.active')}
          metric={stats.active}
          icon={<PiGearSixBold className="h-6 w-6 text-green-500" />}
          iconClassName="bg-green-100 dark:bg-green-900/30"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        <div className="flex flex-1 items-center gap-3">
          <Input
            placeholder={t('plugins.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm"
            prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />}
          />
          {categories.length > 0 && (
            <div className="hidden flex-wrap gap-1.5 lg:flex">
              <Badge
                variant={selectedCategory === 'all' ? 'solid' : 'outline'}
                color="primary"
                className="cursor-pointer"
                onClick={() => setSelectedCategory('all')}
              >
                {t('plugins.allPlugins')}
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={String(cat)}
                  variant={selectedCategory === String(cat) ? 'solid' : 'outline'}
                  color={getCategoryColor(String(cat))}
                  className="cursor-pointer capitalize"
                  onClick={() => setSelectedCategory(String(cat))}
                >
                  {String(cat)}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t('common.refresh')}>
            <ActionIcon variant="outline" onClick={fetchData}>
              <PiArrowClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <div className="flex rounded-lg border border-muted">
            <ActionIcon
              variant={viewMode === 'grid' ? 'solid' : 'text'}
              onClick={() => setViewMode('grid')}
              className="rounded-e-none"
            >
              <PiGridFourBold className="h-4 w-4" />
            </ActionIcon>
            <ActionIcon
              variant={viewMode === 'list' ? 'solid' : 'text'}
              onClick={() => setViewMode('list')}
              className="rounded-s-none"
            >
              <PiListBold className="h-4 w-4" />
            </ActionIcon>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">
            {t('common.refresh')}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center dark:border-gray-600">
          <PiPlugDuotone className="mx-auto h-14 w-14 text-gray-300 dark:text-gray-500" />
          <Title as="h5" className="mt-4 text-gray-500">
            {t('plugins.noPlugins')}
          </Title>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tool, index) => (
            <div
              key={rowKey(tool, index)}
              className="group flex flex-col rounded-lg border border-muted bg-gray-0 p-5 transition-shadow hover:shadow-lg dark:bg-gray-50"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <PiCubeBold className="h-6 w-6 text-primary" />
                </div>
                {tool.category && (
                  <Badge
                    variant="flat"
                    color={getCategoryColor(tool.category)}
                    size="sm"
                    className="capitalize"
                  >
                    {tool.category}
                  </Badge>
                )}
              </div>

              <Title as="h6" className="mb-1 font-semibold">
                {tool.name || tool.tool_id || tool.id}
              </Title>
              <Text className="mb-1 font-mono text-xs text-gray-400">
                {tool.tool_id || tool.id}
              </Text>
              <Text className="mb-3 line-clamp-2 flex-1 text-sm text-gray-500">
                {tool.description || t('errors.noDescription')}
              </Text>

              <div className="mb-3 flex flex-wrap gap-1">
                {hasNativeRenderer(tool.tool_id || tool.id || '') ? (
                  <Badge variant="flat" color="success" size="sm">
                    {t('plugins.badges.nativeUi')}
                  </Badge>
                ) : (
                  <Badge variant="flat" color="warning" size="sm">
                    {t('plugins.badges.inDevelopment')}
                  </Badge>
                )}
                <Badge variant="outline" color="info" size="sm">
                  {t('plugins.badges.backend')}
                </Badge>
              </div>

              {tool.mime_types && tool.mime_types.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {tool.mime_types.slice(0, 3).map((mime) => (
                    <Badge key={String(mime)} variant="outline" size="sm" className="text-xs">
                      {String(mime)}
                    </Badge>
                  ))}
                  {tool.mime_types.length > 3 && (
                    <Badge variant="outline" size="sm" className="text-xs">
                      +{tool.mime_types.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-muted pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() =>
                    handleViewPlugin(String(tool.tool_id || tool.id || ''))
                  }
                >
                  <PiEyeBold className="h-3.5 w-3.5" />
                  {t('plugins.details')}
                </Button>
                <Button
                  variant="solid"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() =>
                    router.push(
                      routes.plugins.detail(String(tool.tool_id || tool.id || ''))
                    )
                  }
                >
                  <PiPlayBold className="h-3.5 w-3.5" />
                  {t('plugins.run')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-muted">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-100">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('common.name')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 sm:table-cell">
                  {t('common.category')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                  {t('common.description')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {filtered.map((tool, index) => (
                <tr
                  key={rowKey(tool, index)}
                  className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                >
                  <td className="px-4 py-3">
                    <Text className="font-medium">{tool.name || tool.tool_id || tool.id}</Text>
                    <Text className="font-mono text-xs text-gray-400">
                      {tool.tool_id || tool.id}
                    </Text>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {tool.category && (
                      <Badge
                        variant="flat"
                        color={getCategoryColor(tool.category)}
                        size="sm"
                        className="capitalize"
                      >
                        {tool.category}
                      </Badge>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Text className="line-clamp-1 text-gray-500">{tool.description || '—'}</Text>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Tooltip content={t('plugins.details')}>
                        <ActionIcon
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleViewPlugin(String(tool.tool_id || tool.id || ''))
                          }
                        >
                          <PiEyeBold className="h-4 w-4" />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip content={t('plugins.run')}>
                        <ActionIcon
                          variant="solid"
                          size="sm"
                          onClick={() =>
                            router.push(
                              routes.plugins.detail(String(tool.tool_id || tool.id || ''))
                            )
                          }
                        >
                          <PiPlayBold className="h-4 w-4" />
                        </ActionIcon>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
