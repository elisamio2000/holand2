// ============================================
// PluginSelector — Plugin selection UI for case import
// Allows users to enable/disable specific plugins for processing
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { Badge, Checkbox, Text, Title, Collapse } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiFilesDuotone,
  PiImageDuotone,
  PiMagnifyingGlassDuotone,
  PiSpeakerHighDuotone,
  PiMapPinDuotone,
  PiShieldCheckDuotone,
  PiGearBold,
  PiSparkle,
  PiLightningDuotone,
  PiRocketLaunchDuotone,
  PiStackDuotone,
  PiGraphDuotone,
  PiCubeDuotone,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { PluginId, PluginInfo, PluginCategory } from '@/types/case-importer.types';

// ==========================================
// Types
// ==========================================

interface PluginSelectorProps {
  /** Currently selected plugin IDs */
  selectedPlugins: PluginId[];
  /** Callback when selection changes */
  onChange: (plugins: PluginId[]) => void;
  /** Optional CSS class */
  className?: string;
}

interface PluginGroupProps {
  /** Category title */
  title: string;
  /** Category title (Persian) */
  titleFa: string;
  /** Category icon */
  icon: React.ReactNode;
  /** Plugins in this category */
  plugins: PluginInfo[];
  /** Selected plugin IDs */
  selectedPlugins: PluginId[];
  /** Toggle callback */
  onToggle: (pluginId: PluginId, checked: boolean) => void;
  /** Whether group is required (all plugins disabled) */
  required?: boolean;
}

// ==========================================
// Plugin Data (Static until backend implements GET /plugins)
// ==========================================

/**
 * Static plugin definitions.
 * TODO: Replace with API call to GET /plugins when backend implements it.
 *
 * @see documents/backend-requests/PLUGIN_SELECTION_SYSTEM.md
 */
export const AVAILABLE_PLUGINS: PluginInfo[] = [
  // File Processing (Required)
  {
    id: 'file.identify',
    name: 'File Identification',
    name_fa: 'شناسایی نوع فایل',
    description: 'Detect file types and formats',
    description_fa: 'تشخیص نوع و فرمت فایل‌ها',
    category: 'file',
    required: true,
    ai_powered: false,
    estimated_time_per_file: 0.01,
  },
  {
    id: 'file.meta',
    name: 'File Metadata',
    name_fa: 'اطلاعات پایه فایل',
    description: 'Extract basic file metadata (size, dates, etc.)',
    description_fa: 'استخراج اطلاعات پایه (اندازه، تاریخ و غیره)',
    category: 'file',
    required: true,
    ai_powered: false,
    estimated_time_per_file: 0.02,
  },
  {
    id: 'file.secure',
    name: 'Security Scan',
    name_fa: 'اسکن امنیتی',
    description: 'Check for malware and security threats',
    description_fa: 'بررسی بدافزار و تهدیدات امنیتی',
    category: 'security',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.5,
  },
  // Image Processing
  {
    id: 'image.meta',
    name: 'Image Metadata',
    name_fa: 'اطلاعات تصویر',
    description: 'Extract EXIF, GPS, camera info',
    description_fa: 'استخراج EXIF، GPS و اطلاعات دوربین',
    category: 'image',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.05,
  },
  {
    id: 'image.faces',
    name: 'Face Detection',
    name_fa: 'تشخیص چهره',
    description: 'Detect and extract faces from images',
    description_fa: 'شناسایی و استخراج چهره‌ها از تصاویر',
    category: 'image',
    required: false,
    ai_powered: true,
    estimated_time_per_file: 0.8,
  },
  {
    id: 'image.describe',
    name: 'Image Description',
    name_fa: 'توصیف تصویر',
    description: 'Generate AI descriptions of images',
    description_fa: 'تولید توصیف هوشمند از تصاویر',
    category: 'image',
    required: false,
    ai_powered: true,
    estimated_time_per_file: 1.0,
  },
  // Search & Indexing
  {
    id: 'image.search',
    name: 'Image Embedding',
    name_fa: 'برداربرداری تصویر',
    description: 'Generate image embedding for visual similarity search (DINOv2)',
    description_fa: 'تولید برداربرداری تصویر برای جستجوی بصری',
    category: 'embed',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.3,
  },
  {
    id: 'text.search',
    name: 'Graph Extract',
    name_fa: 'استخراج گراف دانش',
    description: 'Extract entities and relationships from text for knowledge graph',
    description_fa: 'استخراج موجودیت و رابطه از متن برای گراف دانش',
    category: 'graph',
    required: false,
    ai_powered: true,
    estimated_time_per_file: 0.5,
  },
  {
    id: 'face.search',
    name: 'Face Clustering',
    name_fa: 'خوشه‌بندی چهره',
    description: 'Cluster faces by visual similarity to identify individuals',
    description_fa: 'خوشه‌بندی چهره‌ها برای شناسایی افراد',
    category: 'analysis',
    required: false,
    ai_powered: true,
    estimated_time_per_file: 0.9,
  },
  // Audio Processing
  {
    id: 'audio.transcribe',
    name: 'Audio Transcription',
    name_fa: 'رونویسی صوتی',
    description: 'Convert speech to text',
    description_fa: 'تبدیل گفتار به متن',
    category: 'audio',
    required: false,
    ai_powered: true,
    estimated_time_per_file: 2.0,
  },
  {
    id: 'audio.voiceprints',
    name: 'Speaker Diarization',
    name_fa: 'تفکیک گوینده',
    description: 'Identify speakers and generate voice signatures',
    description_fa: 'شناسایی گویندگان و تولید امضای صوتی',
    category: 'audio',
    required: false,
    ai_powered: true,
    estimated_time_per_file: 1.5,
  },
  // Embedding / Indexing
  {
    id: 'embed.face',
    name: 'Face Embedding',
    name_fa: 'برداربرداری چهره',
    description: 'Generate face embedding for similarity search (ArcFace)',
    description_fa: 'تولید برداربرداری چهره برای جستجوی شباهت',
    category: 'embed',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.4,
  },
  {
    id: 'embed.text',
    name: 'Text Embedding',
    name_fa: 'برداربرداری متن',
    description: 'Generate text embeddings via BGE-M3',
    description_fa: 'تولید برداربرداری متن (BGE-M3)',
    category: 'embed',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.2,
  },
  {
    id: 'embed.imagetext',
    name: 'Cross-Modal Embedding',
    name_fa: 'برداربرداری چندوجهی',
    description: 'SigLIP embeddings for image↔text search',
    description_fa: 'برداربرداری SigLIP برای جستجوی تصویر↔متن',
    category: 'embed',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.3,
  },
  // Location Analysis
  {
    id: 'analysis.geo_location',
    name: 'Geo Location Analysis',
    name_fa: 'تحلیل موقعیت جغرافیایی',
    description: 'Extract and analyze GPS coordinates',
    description_fa: 'استخراج و تحلیل مختصات GPS',
    category: 'analysis',
    required: false,
    ai_powered: false,
    estimated_time_per_file: 0.1,
  },
];

/**
 * Category metadata for UI display.
 */
export const CATEGORY_INFO: Record<
  PluginCategory,
  { title: string; titleFa: string; icon: React.ReactNode }
> = {
  file: {
    title: 'File Processing',
    titleFa: 'پردازش فایل',
    icon: <PiFilesDuotone className="h-5 w-5" />,
  },
  image: {
    title: 'Image Processing',
    titleFa: 'پردازش تصویر',
    icon: <PiImageDuotone className="h-5 w-5" />,
  },
  search: {
    title: 'Search & Indexing',
    titleFa: 'جستجو و فهرست‌سازی',
    icon: <PiMagnifyingGlassDuotone className="h-5 w-5" />,
  },
  audio: {
    title: 'Audio Processing',
    titleFa: 'پردازش صوتی',
    icon: <PiSpeakerHighDuotone className="h-5 w-5" />,
  },
  analysis: {
    title: 'Location Analysis',
    titleFa: 'تحلیل موقعیت',
    icon: <PiMapPinDuotone className="h-5 w-5" />,
  },
  security: {
    title: 'Security',
    titleFa: 'امنیت',
    icon: <PiShieldCheckDuotone className="h-5 w-5" />,
  },
  graph: {
    title: 'Graph & Knowledge',
    titleFa: 'گراف و دانش',
    icon: <PiGraphDuotone className="h-5 w-5" />,
  },
  embed: {
    title: 'Embeddings & Indexing',
    titleFa: 'برداربرداری و فهرست‌سازی',
    icon: <PiCubeDuotone className="h-5 w-5" />,
  },
};

/** Stable render order for settings / selector category groups */
export const PLUGIN_CATEGORY_ORDER: PluginCategory[] = [
  'file',
  'security',
  'image',
  'audio',
  'embed',
  'graph',
  'analysis',
  'search',
];

/**
 * Quick preset configurations.
 */
export const PRESETS: Record<string, { label: string; labelFa: string; plugins: PluginId[]; icon: React.ReactNode }> = {
  fast: {
    label: 'Fast Import',
    labelFa: 'ایمپورت سریع',
    plugins: ['file.identify', 'file.meta'],
    icon: <PiLightningDuotone className="h-4 w-4" />,
  },
  standard: {
    label: 'Standard',
    labelFa: 'استاندارد',
    plugins: ['file.identify', 'file.meta', 'image.meta', 'text.search'],
    icon: <PiStackDuotone className="h-4 w-4" />,
  },
  full: {
    label: 'Full Analysis',
    labelFa: 'آنالیز کامل',
    plugins: AVAILABLE_PLUGINS.map((p) => p.id),
    icon: <PiRocketLaunchDuotone className="h-4 w-4" />,
  },
};

// ==========================================
// Plugin Group Component
// ==========================================

/**
 * Display a group of plugins with checkboxes.
 */
function PluginGroup({
  title,
  titleFa,
  icon,
  plugins,
  selectedPlugins,
  onToggle,
  required = false,
}: PluginGroupProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'fa';

  return (
    <div className="space-y-2">
      {/* Group Header */}
      <div className="flex items-center gap-2">
        <div className="text-gray-600 dark:text-gray-400">{icon}</div>
        <Text as="span" className="text-sm font-semibold">
          {isRTL ? titleFa : title}
        </Text>
        {required && (
          <Badge size="sm" color="secondary" className="text-xs">
            {isRTL ? 'اجباری' : 'Required'}
          </Badge>
        )}
        <Badge size="sm" variant="outline" className="text-xs">
          {plugins.length}
        </Badge>
      </div>

      {/* Plugin List */}
      <div className="space-y-2 pl-7">
        {plugins.map((plugin) => (
          <label
            key={plugin.id}
            className={cn(
              'flex items-start gap-3 rounded-lg p-2 transition-colors',
              'hover:bg-gray-50 dark:hover:bg-gray-100/50',
              plugin.required && 'opacity-70'
            )}
          >
            <Checkbox
              checked={selectedPlugins.includes(plugin.id)}
              onChange={(e) => onToggle(plugin.id, e.target.checked)}
              disabled={plugin.required}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Text className="text-sm font-medium">
                  {isRTL ? plugin.name_fa : plugin.name}
                </Text>
                {plugin.ai_powered && (
                  <Badge size="sm" color="primary" className="text-xs">
                    <PiSparkle className="h-3 w-3" />
                    AI
                  </Badge>
                )}
              </div>
              <Text className="text-xs text-gray-600 dark:text-gray-400">
                {isRTL ? plugin.description_fa : plugin.description}
              </Text>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Plugin Selector Component
// ==========================================

/**
 * PluginSelector — Advanced plugin selection UI.
 *
 * Features:
 * - Group plugins by category
 * - Show required plugins (disabled checkboxes)
 * - Quick presets (Fast, Standard, Full)
 * - Badge showing selection count
 * - Saves to localStorage
 *
 * @example
 * ```tsx
 * <PluginSelector
 *   selectedPlugins={selectedPlugins}
 *   onChange={setSelectedPlugins}
 * />
 * ```
 */
export default function PluginSelector({
  selectedPlugins,
  onChange,
  className,
}: PluginSelectorProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'fa';

  // Group plugins by category
  const pluginsByCategory = AVAILABLE_PLUGINS.reduce(
    (acc, plugin) => {
      if (!acc[plugin.category]) acc[plugin.category] = [];
      acc[plugin.category].push(plugin);
      return acc;
    },
    {} as Record<PluginCategory, PluginInfo[]>
  );

  // Toggle individual plugin
  const handleToggle = (pluginId: PluginId, checked: boolean) => {
    console.info('[PluginSelector] Toggling plugin:', { pluginId, checked });
    const updated = checked
      ? [...selectedPlugins, pluginId]
      : selectedPlugins.filter((id) => id !== pluginId);
    onChange(updated);
  };

  // Apply preset
  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      console.info('[PluginSelector] Applying preset:', { presetKey, plugins: preset.plugins });
      onChange(preset.plugins);
    }
  };

  // Calculate estimated time
  const estimatedTimeSeconds = selectedPlugins.reduce((sum, pluginId) => {
    const plugin = AVAILABLE_PLUGINS.find((p) => p.id === pluginId);
    return sum + (plugin?.estimated_time_per_file || 0);
  }, 0);

  const formatEstimatedTime = (seconds: number, fileCount: number = 100) => {
    const total = seconds * fileCount;
    if (total < 60) return `~${Math.ceil(total)}s`;
    if (total < 3600) return `~${Math.ceil(total / 60)}m`;
    return `~${Math.ceil(total / 3600)}h`;
  };

  return (
    <div className={cn('rounded-lg border border-muted bg-gray-0 dark:bg-gray-50', className)}>
      <Collapse
        header={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/50"
          >
            <div className="flex items-center gap-3">
              <PiGearBold className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div className="text-left">
                <Text as="span" className="font-semibold">
                  {t('caseImporter.pluginSettings.advancedSettings')}
                </Text>
                <Text className="block text-xs text-gray-600 dark:text-gray-400">
                  {t('caseImporter.pluginSettings.selectToolsHint')}
                </Text>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {t('caseImporter.pluginSettings.toolCount', {
                count: selectedPlugins.length,
              })}
            </Badge>
          </button>
        )}
      >
        <div className="space-y-6 p-4">
            {/* Quick Presets */}
            <div>
              <Text className="mb-3 text-sm font-semibold">
                {t('caseImporter.pluginSettings.quickPresets')}
              </Text>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all',
                      'hover:border-primary hover:bg-primary/5',
                      'border-muted bg-gray-0 dark:bg-gray-100'
                    )}
                  >
                    {preset.icon}
                    <span>{t(`caseImporter.pluginSettings.presets.${key}.label`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Plugin Groups */}
            <div className="space-y-4">
              {(PLUGIN_CATEGORY_ORDER.filter(
                (category) => (pluginsByCategory[category]?.length ?? 0) > 0
              ) as PluginCategory[]).map((category) => {
                const categoryData = CATEGORY_INFO[category];
                const plugins = pluginsByCategory[category];
                const isRequired = plugins.every((p) => p.required);

                return (
                  <PluginGroup
                    key={category}
                    title={categoryData.title}
                    titleFa={categoryData.titleFa}
                    icon={categoryData.icon}
                    plugins={plugins}
                    selectedPlugins={selectedPlugins}
                    onToggle={handleToggle}
                    required={isRequired}
                  />
                );
              })}
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-muted bg-gray-50 p-4 dark:bg-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <Text as="span" className="text-sm font-semibold">
                    {t('caseImporter.pluginSettings.summary')}
                  </Text>
                  <Text className="text-xs text-gray-600 dark:text-gray-400">
                    {t('caseImporter.pluginSettings.pluginsSelected', {
                      count: selectedPlugins.length,
                    })}
                  </Text>
                </div>
                <div className="text-right">
                  <Text className="text-xs text-gray-600 dark:text-gray-400">
                    {t('caseImporter.pluginSettings.estimatedTimeLabel')}
                  </Text>
                  <Text as="span" className="text-lg font-semibold text-primary">
                    {formatEstimatedTime(estimatedTimeSeconds)}
                  </Text>
                </div>
              </div>
            </div>
          </div>
      </Collapse>
    </div>
  );
}
