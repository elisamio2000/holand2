// ============================================
// PluginSettingsView — API-based plugin configuration
// Fetches available tools from backend and saves preferences to API
// ============================================

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Checkbox, Empty, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  PiFilesDuotone,
  PiImageDuotone,
  PiMagnifyingGlassDuotone,
  PiSpeakerHighDuotone,
  PiMapPinDuotone,
  PiShieldCheckDuotone,
  PiSparkle,
  PiLightningDuotone,
  PiRocketLaunchDuotone,
  PiStackDuotone,
  PiCheckBold,
  PiXBold,
  PiWarningCircleDuotone,
  PiCloudSlashBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { caseImporterService } from '@/services/case-importer.service';
import type { PluginId, PluginInfo, PluginCategory, ImportToolInfo } from '@/types/case-importer.types';

// Import UI metadata (icons, Persian names, descriptions)
import {
  AVAILABLE_PLUGINS,
  CATEGORY_INFO,
  PRESETS,
  PLUGIN_CATEGORY_ORDER,
} from '@/app/shared/case-importer/plugin-selector';

// ==========================================
// Helper Functions
// ==========================================

/**
 * Extract error message from any error object.
 */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: {
        data?: { detail?: string; message?: string; error?: string };
      };
    };
    const data = axiosErr.response?.data;
    if (data?.detail) return String(data.detail);
    if (data?.message) return String(data.message);
    if (data?.error) return String(data.error);
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

/**
 * PluginSettingsView — API-based plugin configuration interface
 *
 * Features:
 * - Fetches available tools from backend (GET /import/tools)
 * - Loads user's saved preferences (GET /import/preferences)
 * - Multi-column grid layout for better space utilization
 * - Quick preset buttons (Fast/Standard/Full)
 * - Per-plugin toggles grouped by category
 * - Real-time summary with time estimates
 * - Saves preferences to backend (PUT /import/preferences)
 * - Save/Cancel actions
 *
 * NOTE: This replaces the localStorage-based system. All preferences
 * are now stored in PostgreSQL via backend API.
 *
 * @returns Full-page plugin settings view
 */
export default function PluginSettingsView() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isRTL = i18n.language === 'fa';

  // ==========================================
  // State Management
  // ==========================================

  const [availableTools, setAvailableTools] = useState<ImportToolInfo[]>([]);
  const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialSelection, setInitialSelection] = useState<Set<string>>(new Set());

  // ==========================================
  // Data Loading
  // ==========================================

  /**
   * Fetch available tools and user preferences from backend.
   */
  const loadData = useCallback(async () => {
    console.info('[PluginSettingsView] Loading tools and preferences...');
    setIsLoading(true);
    setError(null);

    try {
      // Fetch tools and preferences in parallel
      const [toolsData, prefsData] = await Promise.all([
        caseImporterService.getImportTools(),
        caseImporterService.getUserPreferences(),
      ]);

      console.info('[PluginSettingsView] Received tools data:', {
        ok: toolsData.ok,
        count: toolsData.count,
        toolsLength: Array.isArray(toolsData.tools) ? toolsData.tools.length : 'not array',
        toolsType: typeof toolsData.tools,
      });

      // Service layer already transforms to array, but double-check
      const tools = Array.isArray(toolsData.tools) ? toolsData.tools : [];
      setAvailableTools(tools);

      // Initialize selected tools from preferences
      let selected: Set<string>;
      if (prefsData.tool_allowlist === null) {
        // null = use defaults (select all)
        selected = new Set(tools.map((t) => t.tool_id));
      } else if (prefsData.tool_allowlist.length === 0) {
        // empty array = no tools enabled
        selected = new Set();
      } else {
        // specific tools enabled
        selected = new Set(prefsData.tool_allowlist);
      }

      setSelectedPlugins(selected);
      setInitialSelection(new Set(selected)); // Track initial state for "has changes" detection

      console.info('[PluginSettingsView] Data loaded:', {
        tools_count: tools.length,
        selected_count: selected.size,
        allowlist: prefsData.tool_allowlist,
      });
    } catch (err) {
      const errorMsg = extractErrorMessage(err);
      console.error('[PluginSettingsView] Failed to load data:', err);
      setError(errorMsg);
      toast.error(`${t('caseImporter.pluginSettings.loadError')}: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================
  // Merge Backend Tools with UI Metadata
  // ==========================================

  /**
   * Merge backend tool IDs with frontend UI metadata.
   * Backend provides tool_id, frontend provides rich UI data (Persian names, icons, etc.).
   */
  const mergedPlugins: PluginInfo[] = availableTools.map((tool) => {
    const metadata = AVAILABLE_PLUGINS.find((p) => p.id === tool.tool_id);
    if (metadata) {
      return metadata;
    }
    const backendCategory = tool.category as PluginCategory | undefined;
    const uiCategory =
      backendCategory && backendCategory in CATEGORY_INFO
        ? backendCategory
        : 'file';
    return {
      id: tool.tool_id as PluginId,
      name: tool.name || tool.tool_id,
      name_fa: tool.name || tool.tool_id,
      description: tool.description || 'No description available',
      description_fa: tool.description || 'توضیحات موجود نیست',
      category: uiCategory,
      required: tool.default_enabled || false,
      ai_powered: false,
      estimated_time_per_file: 0.1,
    };
  });

  // Log merged plugins with categories for debugging
  if (mergedPlugins.length > 0) {
    const categoryCounts = mergedPlugins.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.info('[PluginSettingsView] Merged plugins by category:', categoryCounts);
  }

  // ==========================================
  // User Actions
  // ==========================================

  /**
   * Toggle individual plugin.
   */
  const handleToggle = useCallback((pluginId: PluginId, checked: boolean) => {
    console.info('[PluginSettingsView] Toggling plugin:', { pluginId, checked });
    setSelectedPlugins((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(pluginId);
      } else {
        next.delete(pluginId);
      }
      return next;
    });
    setHasChanges(true);
  }, []);

  /**
   * Apply preset configuration.
   */
  const applyPreset = useCallback((presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      console.info('[PluginSettingsView] Applying preset:', { presetKey, plugins: preset.plugins });
      setSelectedPlugins(new Set(preset.plugins));
      setHasChanges(true);
    }
  }, []);

  /**
   * Save preferences to backend.
   */
  const handleSave = useCallback(async () => {
    console.info('[PluginSettingsView] Saving preferences...', {
      selected_count: selectedPlugins.size,
    });
    setIsSaving(true);

    try {
      // Determine tool_allowlist:
      // - If all tools selected → null (use defaults)
      // - If none selected → []
      // - Otherwise → array of selected tool IDs
      let tool_allowlist: string[] | null = null;
      if (selectedPlugins.size === 0) {
        tool_allowlist = [];
      } else if (selectedPlugins.size === mergedPlugins.length) {
        tool_allowlist = null; // Use defaults
      } else {
        tool_allowlist = Array.from(selectedPlugins);
      }

      const result = await caseImporterService.updateUserPreferences({
        tool_allowlist,
      });

      setInitialSelection(new Set(selectedPlugins)); // Update initial state
      setHasChanges(false);

      toast.success(t('settings.saveSuccess'));
      console.info('[PluginSettingsView] Preferences saved:', {
        tool_allowlist: result.tool_allowlist,
      });

      // Go back after short delay
      setTimeout(() => router.back(), 500);
    } catch (err) {
      const errorMsg = extractErrorMessage(err);
      console.error('[PluginSettingsView] Save failed:', err);
      toast.error(`${t('settings.saveFailed')}: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedPlugins, mergedPlugins.length, t, router]);

  /**
   * Cancel and go back.
   */
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      const confirmed = confirm(
        isRTL
          ? 'تغییرات ذخیره نشده‌اند. آیا مطمئن هستید؟'
          : 'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) return;
    }
    router.back();
  }, [hasChanges, isRTL, router]);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="@container">
      {/* Loading State */}
      {isLoading && (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader size="lg" variant="spinner" />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
          <PiWarningCircleDuotone className="mx-auto mb-4 h-12 w-12 text-red-600 dark:text-red-400" />
          <Title as="h3" className="mb-2 text-red-600 dark:text-red-400">
            {t('caseImporter.pluginSettings.loadError')}
          </Title>
          <Text className="mb-4 text-red-600 dark:text-red-400">{error}</Text>
          <Button size="sm" onClick={loadData}>
            {t('caseImporter.pluginSettings.retry')}
          </Button>
        </div>
      )}

      {/* Backend Not Available State */}
      {!isLoading && !error && availableTools.length === 0 && (
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-8 text-center dark:border-orange-800 dark:bg-orange-950/30">
          <PiCloudSlashBold className="mx-auto mb-4 h-12 w-12 text-orange-600 dark:text-orange-400" />
          <Title as="h3" className="mb-2">
            {t('caseImporter.pluginSettings.backendUnavailable')}
          </Title>
          <Text>
            {t('caseImporter.pluginSettings.backendUnavailableHint')}
          </Text>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && availableTools.length > 0 && (() => {
        // ==========================================
        // UI Helpers (calculated only when data is ready)
        // ==========================================

        /**
         * Group merged plugins by category.
         */
        const pluginsByCategory = mergedPlugins.reduce(
          (acc, plugin) => {
            if (!acc[plugin.category]) acc[plugin.category] = [];
            acc[plugin.category].push(plugin);
            return acc;
          },
          {} as Record<PluginCategory, PluginInfo[]>
        );

        /**
         * Calculate estimated processing time.
         */
        const estimatedTimeSeconds = Array.from(selectedPlugins).reduce((sum, pluginId) => {
          const plugin = mergedPlugins.find((p) => p.id === pluginId);
          return sum + (plugin?.estimated_time_per_file || 0);
        }, 0);

        const formatEstimatedTime = (seconds: number, fileCount: number = 100) => {
          const total = seconds * fileCount;
          if (total < 60) return `~${Math.ceil(total)}s`;
          if (total < 3600) return `~${Math.ceil(total / 60)}m`;
          return `~${Math.ceil(total / 3600)}h`;
        };

        /**
         * Check if current selection matches a preset.
         */
        const getActivePreset = (): string | null => {
          for (const [key, preset] of Object.entries(PRESETS)) {
            const presetIds = new Set(preset.plugins);
            if (presetIds.size === selectedPlugins.size && 
                Array.from(presetIds).every(id => selectedPlugins.has(id))) {
              return key;
            }
          }
          return null;
        };

        const activePreset = getActivePreset();

        return (
        <>
          {/* Quick Presets Section */}
          <div className="mb-6">
            <Title
              as="h5"
              className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-700"
            >
              {t('caseImporter.pluginSettings.quickPresets')}
            </Title>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(PRESETS).map(([key, preset]) => {
                const isActive = activePreset === key;
                const pluginCount = preset.plugins.length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
                      isActive
                        ? 'border-primary bg-primary-lighter/20'
                        : 'border-muted bg-gray-0 hover:border-gray-300 dark:bg-gray-50 dark:hover:border-gray-200'
                    )}
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-primary">
                      {React.cloneElement(preset.icon as React.ReactElement, {
                        className: 'h-7 w-7',
                      })}
                    </div>
                    <div>
                      <Text className="font-semibold text-gray-900 dark:text-gray-700">
                        {t(`caseImporter.pluginSettings.presets.${key}.label`)}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400">
                        {t('caseImporter.pluginSettings.toolCount', { count: pluginCount })}
                        {' - '}
                        {t(`caseImporter.pluginSettings.presets.${key}.hint`)}
                      </Text>
                      <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {t(`caseImporter.pluginSettings.presets.${key}.description`)}
                      </Text>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plugin Groups — 2 Column Grid */}
          <div className="mb-6 grid gap-6 @2xl:grid-cols-2">
            {(PLUGIN_CATEGORY_ORDER.filter(
              (category) => (pluginsByCategory[category]?.length ?? 0) > 0
            ) as PluginCategory[]).map((category) => {
              const categoryData = CATEGORY_INFO[category];
              
              if (!categoryData) {
                console.warn('[PluginSettingsView] Unknown category:', { category, plugin_count: pluginsByCategory[category].length });
                return null;
              }
              
              const plugins = pluginsByCategory[category];
              const isRequired = plugins.every((p) => p.required);

              return (
                <div
                  key={category}
                  className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50"
                >
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {categoryData.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Text as="span" className="font-semibold">
                          {isRTL ? categoryData.titleFa : categoryData.title}
                        </Text>
                        {isRequired && (
                          <Badge size="sm" variant="flat" color="info">
                            {t('caseImporter.pluginSettings.required')}
                          </Badge>
                        )}
                      </div>
                      <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('caseImporter.pluginSettings.toolCount', {
                          count: plugins.length,
                        })}
                      </Text>
                    </div>
                  </div>

                  {/* Plugin Checkboxes */}
                  <div className="space-y-3">
                    {plugins.map((plugin) => {
                      const isSelected = selectedPlugins.has(plugin.id);
                      const isDisabled = plugin.required;

                      return (
                        <label
                          key={plugin.id}
                          className={cn(
                            'flex items-start gap-3 rounded-md border border-muted p-3 transition-colors',
                            !isDisabled && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-100/50',
                            isDisabled && 'opacity-60',
                            isSelected &&
                              !isDisabled &&
                              'border-primary/30 bg-primary/5 dark:bg-primary/10'
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={(e) => handleToggle(plugin.id, e.target.checked)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Text as="span" className="text-sm font-medium">
                                {isRTL ? plugin.name_fa : plugin.name}
                              </Text>
                              {plugin.ai_powered && (
                                <Badge
                                  size="sm"
                                  variant="flat"
                                  color="info"
                                  className="flex items-center gap-1"
                                >
                                  <PiSparkle className="h-3 w-3" />
                                  <span>AI</span>
                                </Badge>
                              )}
                            </div>
                            <Text className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                              {isRTL ? plugin.description_fa : plugin.description}
                            </Text>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary & Actions — Sticky Bottom Bar */}
          <div className="sticky bottom-0 z-10 rounded-lg border border-muted bg-white p-6 shadow-lg dark:bg-gray-50">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              {/* Summary */}
              <div>
                <Text as="span" className="text-sm font-semibold">
                  {t('caseImporter.pluginSettings.summary')}
                </Text>
                <div className="mt-1 flex items-center gap-4">
                  <Text className="text-xs text-gray-600 dark:text-gray-400">
                    {t('caseImporter.pluginSettings.pluginsSelected', {
                      count: selectedPlugins.size,
                    })}
                  </Text>
                  <Text className="text-xs text-gray-600 dark:text-gray-400">•</Text>
                  <Text className="text-xs text-gray-600 dark:text-gray-400">
                    {t('caseImporter.pluginSettings.estimatedTimeLabel')}
                    <Text as="span" className="ml-1 font-semibold text-primary">
                      {formatEstimatedTime(estimatedTimeSeconds)}
                    </Text>
                  </Text>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="w-24"
                  disabled={isSaving}
                >
                  <PiXBold className="mr-1 h-4 w-4" />
                  {t('caseImporter.pluginSettings.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="w-24"
                >
                  <PiCheckBold className="mr-1 h-4 w-4" />
                  {isSaving
                    ? t('caseImporter.pluginSettings.saving')
                    : t('caseImporter.pluginSettings.save')}
                </Button>
              </div>
            </div>
          </div>
        </>
      );
    })()}

    </div>
  );
}
