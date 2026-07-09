// ============================================
// ExternalPluginsGrid — Grid/List view for external/local plugins
// External plugins come from D:\UI_V4_1\UI_V4_1\Plugins folder
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Title, Text, Badge, Loader, Button, Input, ActionIcon } from 'rizzui';
import {
  PiFolderOpenDuotone,
  PiMagnifyingGlassBold,
  PiArrowClockwiseBold,
  PiPlayBold,
  PiEyeBold,
  PiCubeBold,
  PiGridFourBold,
  PiListBold,
  PiTagBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiGearSixBold,
  PiDesktopTowerBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';
import { externalPluginsService } from '@/services/external-plugins.service';
import type { ExternalPluginInfo } from '@/types/plugins.types';

import { toApiToolId } from '@/utils/tool-id';

/**
 * ExternalPluginsGrid — Grid/List view for external/local plugins.
 *
 * These plugins are stored in D:\UI_V4_1\UI_V4_1\Plugins folder and
 * run via Plugin Executor Server (localhost:8100).
 *
 * @requires externalPluginsService
 */

interface ExternalPluginsGridProps {
  /** Callback when a plugin is selected for execution */
  onSelectPlugin?: (plugin: ExternalPluginInfo) => void;
}

export default function ExternalPluginsGrid({ onSelectPlugin }: ExternalPluginsGridProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [plugins, setPlugins] = useState<ExternalPluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [executorAvailable, setExecutorAvailable] = useState<boolean | null>(null);

  // ==========================================
  // Data Fetching
  // ==========================================

  const fetchData = useCallback(async () => {
    console.info('[ExternalPluginsGrid] Fetching external plugins...');
    setLoading(true);
    setError(null);
    try {
      // Check executor availability
      const isAvailable = await externalPluginsService.isExecutorAvailable();
      setExecutorAvailable(isAvailable);

      // Fetch plugins
      const pluginsData = await externalPluginsService.listPlugins();

      console.info('[ExternalPluginsGrid] Data loaded:', {
        plugins: pluginsData.length,
        executorAvailable: isAvailable,
      });

      setPlugins(pluginsData);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load external plugins';
      console.error('[ExternalPluginsGrid] Fetch failed:', err);
      setError(errorMsg);
      toast.error(t('errors.loadPlugins'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // Computed Values
  // ==========================================

  const categories = useMemo(() => {
    return Array.from(new Set(plugins.map((p) => p.category)));
  }, [plugins]);

  const filtered = useMemo(() => {
    let result = plugins;

    if (selectedCategory !== 'all') {
      result = externalPluginsService.filterByCategory(result, selectedCategory);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const ck = toApiToolId(p.id);
        const name = t(`plugins.executorCatalog.${ck}.name`, { defaultValue: p.name });
        const desc = t(`plugins.executorCatalog.${ck}.description`, {
          defaultValue: p.description,
        });
        return (
          name.toLowerCase().includes(q) ||
          desc.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.name_en?.toLowerCase().includes(q) ?? false) ||
          (p.description_en?.toLowerCase().includes(q) ?? false) ||
          (p.capabilities?.some((c) => c.toLowerCase().includes(q)) ?? false)
        );
      });
    }

    return result;
  }, [plugins, search, selectedCategory, t]);

  const stats = useMemo(() => {
    const uniqueCategories = new Set(plugins.map((p) => p.category));
    const available = plugins.filter((p) => p.is_available !== false).length;
    return {
      total: plugins.length,
      categories: uniqueCategories.size,
      available,
    };
  }, [plugins]);

  const handleSelectPlugin = (plugin: ExternalPluginInfo) => {
    // WHY hyphen: URL paths must use hyphens instead of dots for
    // clean routing and browser compatibility. Plugin IDs internally
    // use dots (file.meta) but URLs use hyphens (file-meta).
    const urlSlug = plugin.id.replace(/\./g, '-');
    console.info('[ExternalPluginsGrid] Plugin selected:', { pluginId: plugin.id, urlSlug });
    if (onSelectPlugin) {
      onSelectPlugin(plugin);
    } else {
      router.push(`/plugins/external-plugins/${urlSlug}`);
    }
  };

  const getCategoryColor = externalPluginsService.getCategoryColor;

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Executor Status Banner */}
      {executorAvailable === false && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <PiWarningCircleBold className="h-6 w-6 flex-shrink-0 text-orange-500" />
          <div className="flex-1">
            <Text className="font-medium text-orange-700 dark:text-orange-400">
              {t('plugins.executorNotAvailable')}
            </Text>
            <Text className="text-sm text-orange-600 dark:text-orange-500">
              {t('plugins.executorBanner.offlineDetail')}
            </Text>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-600 dark:border-orange-700"
            onClick={fetchData}
          >
            {t('common.refresh')}
          </Button>
        </div>
      )}

      {executorAvailable === true && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <PiCheckCircleBold className="h-6 w-6 flex-shrink-0 text-green-500" />
          <div className="flex-1">
            <Text className="font-medium text-green-700 dark:text-green-400">
              {t('plugins.executorAvailable')}
            </Text>
            <Text className="text-sm text-green-600 dark:text-green-500">
              {t('plugins.executorBanner.onlineDetail')}
            </Text>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('plugins.stats.totalPlugins')}
          metric={stats.total}
          icon={<PiFolderOpenDuotone className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
        />
        <MetricCard
          title={t('plugins.stats.categories')}
          metric={stats.categories}
          icon={<PiTagBold className="h-6 w-6 text-blue-500" />}
          iconClassName="bg-blue-100 dark:bg-blue-900/30"
        />
        <MetricCard
          title={t('plugins.stats.available')}
          metric={stats.available}
          icon={<PiCheckCircleBold className="h-6 w-6 text-green-500" />}
          iconClassName="bg-green-100 dark:bg-green-900/30"
        />
      </div>

      {/* Toolbar */}
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
                  key={cat}
                  variant={selectedCategory === cat ? 'solid' : 'outline'}
                  color={getCategoryColor(cat)}
                  className="cursor-pointer capitalize"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {t(`plugins.executorCategories.${cat}`, { defaultValue: cat })}
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

      {/* Content */}
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
          <PiFolderOpenDuotone className="mx-auto h-14 w-14 text-gray-300 dark:text-gray-500" />
          <Title as="h5" className="mt-4 text-gray-500">
            {t('plugins.noExternalPlugins')}
          </Title>
          <Text className="mt-2 text-sm text-gray-400">
            {t('plugins.noExternalPluginsDesc')}
          </Text>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((plugin) => {
            const ck = toApiToolId(plugin.id);
            const displayName = t(`plugins.executorCatalog.${ck}.name`, {
              defaultValue: plugin.name,
            });
            const displayDescription = t(`plugins.executorCatalog.${ck}.description`, {
              defaultValue: plugin.description,
            });
            const categoryLabel = t(`plugins.executorCategories.${plugin.category}`, {
              defaultValue: plugin.category,
            });
            return (
            <div
              key={plugin.id}
              className="group flex flex-col rounded-lg border border-muted bg-gray-0 p-5 transition-shadow hover:shadow-lg dark:bg-gray-50"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <PiDesktopTowerBold className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  {plugin.is_available ? (
                    <PiCheckCircleBold className="h-4 w-4 text-green-500" />
                  ) : (
                    <PiWarningCircleBold className="h-4 w-4 text-orange-500" />
                  )}
                  <Badge
                    variant="flat"
                    color={getCategoryColor(plugin.category)}
                    size="sm"
                    className="capitalize"
                  >
                    {categoryLabel}
                  </Badge>
                </div>
              </div>

              <Title as="h6" className="mb-1 font-semibold">
                {displayName}
              </Title>
              <Text className="mb-1 font-mono text-xs text-gray-400">{plugin.id}</Text>
              <Text className="mb-3 line-clamp-2 flex-1 text-sm text-gray-500">
                {displayDescription}
              </Text>

              {/* Version & Update */}
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" size="sm">
                  v{plugin.version}
                </Badge>
                {plugin.has_ui && (
                  <Badge variant="outline" size="sm" color="info">
                    {t('plugins.hasUiBadge')}
                  </Badge>
                )}
              </div>

              {/* Capabilities */}
              {plugin.capabilities && plugin.capabilities.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {plugin.capabilities.slice(0, 2).map((cap) => (
                    <Badge key={cap} variant="outline" size="sm" className="text-xs">
                      {cap}
                    </Badge>
                  ))}
                  {plugin.capabilities.length > 2 && (
                    <Badge variant="outline" size="sm" className="text-xs">
                      +{plugin.capabilities.length - 2}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-muted pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => handleSelectPlugin(plugin)}
                >
                  <PiEyeBold className="h-3.5 w-3.5" />
                  {t('plugins.details')}
                </Button>
                <Button
                  variant="solid"
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={!plugin.is_available || executorAvailable === false}
                  onClick={() => handleSelectPlugin(plugin)}
                >
                  <PiPlayBold className="h-3.5 w-3.5" />
                  {t('plugins.run')}
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        /* List View */
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
                  {t('common.version')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {filtered.map((plugin) => {
                const ck = toApiToolId(plugin.id);
                const displayName = t(`plugins.executorCatalog.${ck}.name`, {
                  defaultValue: plugin.name,
                });
                const categoryLabel = t(`plugins.executorCategories.${plugin.category}`, {
                  defaultValue: plugin.category,
                });
                return (
                <tr
                  key={plugin.id}
                  className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                >
                  <td className="px-4 py-3">
                    <Text className="font-medium">{displayName}</Text>
                    <Text className="font-mono text-xs text-gray-400">{plugin.id}</Text>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge
                      variant="flat"
                      color={getCategoryColor(plugin.category)}
                      size="sm"
                      className="capitalize"
                    >
                      {categoryLabel}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Badge variant="outline" size="sm">
                      v{plugin.version}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {plugin.is_available ? (
                      <Badge variant="flat" color="success" size="sm">
                        {t('plugins.statusAvailable')}
                      </Badge>
                    ) : (
                      <Badge variant="flat" color="warning" size="sm">
                        {t('plugins.statusUnavailable')}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Tooltip content={t('plugins.details')}>
                        <ActionIcon
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectPlugin(plugin)}
                        >
                          <PiEyeBold className="h-4 w-4" />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip content={t('plugins.run')}>
                        <ActionIcon
                          variant="solid"
                          size="sm"
                          disabled={!plugin.is_available || executorAvailable === false}
                          onClick={() => handleSelectPlugin(plugin)}
                        >
                          <PiPlayBold className="h-4 w-4" />
                        </ActionIcon>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
