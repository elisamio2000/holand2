// ============================================
// ExternalFrontendPluginsGrid â€” Curated in-app tools (i18n; no hardcoded copy)
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Title, Text, Badge, Button, Input, ActionIcon } from 'rizzui';
import {
  PiMagnifyingGlassBold,
  PiPlayBold,
  PiEyeBold,
  PiCubeBold,
  PiGridFourBold,
  PiListBold,
  PiTagBold,
  PiCheckCircleBold,
  PiSparkleBold,
  PiMapPinBold,
  PiGlobeHemisphereWestBold,
  PiWaveSineBold,
} from 'react-icons/pi';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';

type FrontendCategory = 'analysis' | 'visualization' | 'utility';

type FrontendPluginStatic = {
  id: string;
  /** i18n key base: plugins.frontendCatalog.items.<key> */
  catalogKey: string;
  category: FrontendCategory;
  href: string;
  icon: IconType;
  ready: boolean;
};

const FRONTEND_PLUGINS_STATIC: FrontendPluginStatic[] = [
  {
    id: 'analysis.geo_location',
    catalogKey: 'analysis_geo_location',
    category: 'analysis',
    href: '/plugins/external-plugins/geo-location',
    icon: PiMapPinBold,
    ready: true,
  },
  {
    id: 'map.offline_vector',
    catalogKey: 'offline_map',
    category: 'visualization',
    href: '/plugins/external-plugins/offline-map',
    icon: PiGlobeHemisphereWestBold,
    ready: true,
  },
  {
    id: 'audio.tts',
    catalogKey: 'tts_native',
    category: 'utility',
    href: '/plugins/external-plugins/TTS',
    icon: PiWaveSineBold,
    ready: true,
  },
];

type ResolvedFrontendPlugin = FrontendPluginStatic & {
  name: string;
  description: string;
  capabilities: string[];
  categoryLabel: string;
};

export default function ExternalFrontendPluginsGrid() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const resolvedPlugins = useMemo((): ResolvedFrontendPlugin[] => {
    return FRONTEND_PLUGINS_STATIC.map((p) => {
      const base = `plugins.frontendCatalog.items.${p.catalogKey}`;
      return {
        ...p,
        name: t(`${base}.name`),
        description: t(`${base}.description`),
        capabilities: [t(`${base}.cap0`), t(`${base}.cap1`), t(`${base}.cap2`)],
        categoryLabel: t(`plugins.frontendCatalog.categories.${p.category}`),
      };
    });
  }, [t]);

  const categories = useMemo(
    () => Array.from(new Set(FRONTEND_PLUGINS_STATIC.map((p) => p.category))),
    []
  );

  const filtered = useMemo(() => {
    let result = resolvedPlugins;
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    }
    return result;
  }, [resolvedPlugins, search, selectedCategory]);

  const stats = useMemo(
    () => ({
      total: FRONTEND_PLUGINS_STATIC.length,
      categories: new Set(FRONTEND_PLUGINS_STATIC.map((p) => p.category)).size,
      ready: FRONTEND_PLUGINS_STATIC.filter((p) => p.ready).length,
    }),
    []
  );

  const getCategoryColor = (cat: string): 'primary' | 'info' | 'success' | 'warning' => {
    if (cat === 'analysis') return 'primary';
    if (cat === 'visualization') return 'info';
    if (cat === 'utility') return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('plugins.stats.totalPlugins')}
          metric={stats.total}
          icon={<PiSparkleBold className="h-6 w-6 text-primary" />}
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
          metric={stats.ready}
          icon={<PiCheckCircleBold className="h-6 w-6 text-green-500" />}
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
                  key={cat}
                  variant={selectedCategory === cat ? 'solid' : 'outline'}
                  color={getCategoryColor(cat)}
                  className="cursor-pointer capitalize"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {t(`plugins.frontendCatalog.categories.${cat}`)}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center dark:border-gray-600">
          <PiCubeBold className="mx-auto h-14 w-14 text-gray-300 dark:text-gray-500" />
          <Title as="h5" className="mt-4 text-gray-500">
            {t('plugins.noPlugins')}
          </Title>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((plugin) => {
            const Icon = plugin.icon;
            return (
              <div
                key={plugin.id}
                className="group flex flex-col rounded-lg border border-muted bg-gray-0 p-5 transition-shadow hover:shadow-lg dark:bg-gray-50"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge
                    variant="flat"
                    color={getCategoryColor(plugin.category)}
                    size="sm"
                    className="capitalize"
                  >
                    {plugin.categoryLabel}
                  </Badge>
                </div>

                <Title as="h6" className="mb-1 font-semibold">
                  {plugin.name}
                </Title>
                <Text className="mb-1 font-mono text-xs text-gray-400">{plugin.id}</Text>
                <Text className="mb-3 line-clamp-2 flex-1 text-sm text-gray-500">
                  {plugin.description}
                </Text>

                <div className="mb-3 flex flex-wrap gap-1">
                  <Badge variant="outline" size="sm" color="success">
                    {t('plugins.badges.frontend')}
                  </Badge>
                  {plugin.ready ? (
                    <Badge variant="outline" size="sm" color="info">
                      {t('plugins.badges.ready')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" color="warning">
                      {t('plugins.badges.inDevelopment')}
                    </Badge>
                  )}
                  {plugin.capabilities.slice(0, 2).map((cap) => (
                    <Badge key={cap} variant="outline" size="sm" className="text-xs">
                      {cap}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-2 border-t border-muted pt-3">
                  <Link href={plugin.href} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <PiEyeBold className="h-3.5 w-3.5" />
                      {t('plugins.details')}
                    </Button>
                  </Link>
                  <Link href={plugin.href} className="flex-1">
                    <Button variant="solid" size="sm" className="w-full gap-1" disabled={!plugin.ready}>
                      <PiPlayBold className="h-3.5 w-3.5" />
                      {t('plugins.run')}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
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
              {filtered.map((plugin) => (
                <tr
                  key={plugin.id}
                  className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                >
                  <td className="px-4 py-3">
                    <Text className="font-medium">{plugin.name}</Text>
                    <Text className="font-mono text-xs text-gray-400">{plugin.id}</Text>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge
                      variant="flat"
                      color={getCategoryColor(plugin.category)}
                      size="sm"
                      className="capitalize"
                    >
                      {plugin.categoryLabel}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Text className="line-clamp-1 text-gray-500">{plugin.description}</Text>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Tooltip content={t('plugins.details')}>
                        <Link href={plugin.href}>
                          <ActionIcon variant="outline" size="sm">
                            <PiEyeBold className="h-4 w-4" />
                          </ActionIcon>
                        </Link>
                      </Tooltip>
                      <Tooltip content={t('plugins.run')}>
                        <Link href={plugin.href}>
                          <ActionIcon variant="solid" size="sm" disabled={!plugin.ready}>
                            <PiPlayBold className="h-4 w-4" />
                          </ActionIcon>
                        </Link>
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


