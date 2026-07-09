// ================================================
// ImportToolPreferences — Backend-based tool allowlist management
// Replaces localStorage with API-persisted preferences
// ================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Empty, Loader, Text, Title } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PiGearBold, PiCheckCircleDuotone, PiWarningCircleDuotone } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { caseImporterService } from '@/services/case-importer.service';
import type { ImportToolInfo, CaseImporterPrefsResponse } from '@/types/case-importer.types';

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

interface ImportToolPreferencesProps {
  className?: string;
}

/**
 * ImportToolPreferences — API-based tool allowlist configuration
 *
 * Features:
 * - Fetches available tools from backend (GET /import/tools)
 * - Loads user's saved preferences (GET /import/preferences)
 * - Allows enabling/disabling individual tools
 * - Saves preferences to backend (PUT /import/preferences)
 * - Three presets: Default (null), None (empty array), All (all tool IDs)
 *
 * NOTE: This replaces the localStorage-based PluginSettingsView.
 * User preferences are stored in PostgreSQL via the backend API.
 *
 * @param className - Additional CSS classes
 * @returns Tool preferences management component
 */
export default function ImportToolPreferences({ className }: ImportToolPreferencesProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ImportToolInfo[]>([]);
  const [preferences, setPreferences] = useState<CaseImporterPrefsResponse | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch available tools and user preferences.
   */
  const loadData = useCallback(async () => {
    console.info('[ImportToolPreferences] Loading tools and preferences...');
    setIsLoading(true);
    setError(null);

    try {
      // Fetch tools and preferences in parallel
      const [toolsData, prefsData] = await Promise.all([
        caseImporterService.getImportTools(),
        caseImporterService.getUserPreferences(),
      ]);

      // WHY cast: Service transforms backend's object dictionary to array,
      // but the return type is union. After getImportTools(), tools is always ImportToolInfo[].
      const toolsArray = (toolsData.tools || []) as ImportToolInfo[];
      setTools(toolsArray);
      setPreferences(prefsData);

      // Initialize selected tools from preferences
      if (prefsData.tool_allowlist === null) {
        // null = use defaults (select all)
        setSelectedTools(new Set(toolsArray.map((t) => t.tool_id)));
      } else if (prefsData.tool_allowlist.length === 0) {
        // empty array = no tools enabled
        setSelectedTools(new Set());
      } else {
        // specific tools enabled
        setSelectedTools(new Set(prefsData.tool_allowlist));
      }

      console.info('[ImportToolPreferences] Data loaded:', {
        tools_count: toolsData.tools.length,
        allowlist: prefsData.tool_allowlist,
      });
    } catch (err) {
      const errorMsg = extractErrorMessage(err);
      console.error('[ImportToolPreferences] Failed to load data:', err);
      setError(errorMsg);
      toast.error(
        t('caseImporter.toolPrefs.toastLoadFailed', {
          defaultValue: 'Failed to load preferences: {{error}}',
          error: errorMsg,
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Toggle a tool on/off.
   */
  const toggleTool = useCallback((toolId: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  /**
   * Apply a preset configuration.
   */
  const applyPreset = useCallback(
    (preset: 'default' | 'none' | 'all') => {
      console.info('[ImportToolPreferences] Applying preset:', preset);
      if (preset === 'default') {
        // null = backend decides (usually all tools)
        setSelectedTools(new Set(tools.map((t) => t.tool_id)));
      } else if (preset === 'none') {
        // empty = no tools
        setSelectedTools(new Set());
      } else if (preset === 'all') {
        // all tools
        setSelectedTools(new Set(tools.map((t) => t.tool_id)));
      }
    },
    [tools]
  );

  /**
   * Save preferences to backend.
   */
  const savePreferences = useCallback(async () => {
    console.info('[ImportToolPreferences] Saving preferences...', {
      selected_count: selectedTools.size,
    });
    setIsSaving(true);

    try {
      // Determine tool_allowlist:
      // - If all tools selected → null (use defaults)
      // - If none selected → []
      // - Otherwise → array of selected tool IDs
      let tool_allowlist: string[] | null = null;
      if (selectedTools.size === 0) {
        tool_allowlist = [];
      } else if (selectedTools.size === tools.length) {
        tool_allowlist = null; // Use defaults
      } else {
        tool_allowlist = Array.from(selectedTools);
      }

      const result = await caseImporterService.updateUserPreferences({
        tool_allowlist,
      });

      setPreferences(result);
      toast.success(
        t('caseImporter.toolPrefs.toastSaved', 'Preferences saved successfully')
      );
      console.info('[ImportToolPreferences] Preferences saved:', {
        tool_allowlist: result.tool_allowlist,
      });
    } catch (err) {
      const errorMsg = extractErrorMessage(err);
      console.error('[ImportToolPreferences] Save failed:', err);
      toast.error(
        t('caseImporter.toolPrefs.toastSaveFailed', {
          defaultValue: 'Failed to save: {{error}}',
          error: errorMsg,
        })
      );
    } finally {
      setIsSaving(false);
    }
  }, [selectedTools, tools, t]);

  // Group tools by category
  const toolsByCategory = tools.reduce(
    (acc, tool) => {
      const category = tool.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tool);
      return acc;
    },
    {} as Record<string, ImportToolInfo[]>
  );

  return (
    <div className={cn('rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50', className)}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Title as="h3" className="mb-2 text-lg">
            <PiGearBold className="mr-2 inline h-6 w-6" />
            {t('caseImporter.toolPrefs.title', 'Import Tool Preferences')}
          </Title>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {t(
              'caseImporter.toolPrefs.description',
              'Configure which tools run during case import. Preferences are saved to your account.'
            )}
          </Text>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" variant="spinner" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-md border border-dashed border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <PiWarningCircleDuotone className="mb-2 h-8 w-8 text-red-600 dark:text-red-400" />
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button size="sm" className="mt-3" onClick={loadData}>
            {t('caseImporter.list.retry')}
          </Button>
        </div>
      )}

      {/* Preferences UI */}
      {!isLoading && !error && tools.length > 0 && (
        <>
          {/* Presets */}
          <div className="mb-6 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPreset('default')}>
              {t('caseImporter.toolPrefs.useDefaults', 'Use Defaults')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('all')}>
              {t('caseImporter.toolPrefs.selectAll', 'Select All')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('none')}>
              {t('caseImporter.toolPrefs.deselectAll', 'Deselect All')}
            </Button>
          </div>

          {/* Current Status */}
          {preferences && (
            <div className="mb-6 rounded-md bg-gray-100 p-4 dark:bg-gray-100">
              <Text className="mb-2 text-sm font-medium">
                {t('caseImporter.toolPrefs.currentConfig', 'Current Configuration')}
              </Text>
              <Text className="text-xs text-gray-600 dark:text-gray-400">
                {preferences.tool_allowlist === null && (
                  <>
                    <PiCheckCircleDuotone className="mr-1 inline h-4 w-4 text-green" />
                    {t('caseImporter.toolPrefs.usingDefaults', 'Using defaults (all tools enabled)')}
                  </>
                )}
                {preferences.tool_allowlist !== null && preferences.tool_allowlist.length === 0 && (
                  <>
                    <PiWarningCircleDuotone className="mr-1 inline h-4 w-4 text-orange-500" />
                    {t('caseImporter.toolPrefs.allDisabled', 'All tools disabled')}
                  </>
                )}
                {preferences.tool_allowlist !== null && preferences.tool_allowlist.length > 0 && (
                  <>
                    <PiCheckCircleDuotone className="mr-1 inline h-4 w-4 text-blue" />
                    {t('caseImporter.toolPrefs.enabledCount', {
                      defaultValue: '{{count}} tool(s) enabled',
                      count: preferences.tool_allowlist.length,
                    })}
                  </>
                )}
              </Text>
              {preferences.updated_at && (
                <Text className="mt-1 text-xs text-gray-500">
                  {t('caseImporter.toolPrefs.lastUpdated', 'Last updated')}: {new Date(preferences.updated_at * 1000).toLocaleString()}
                </Text>
              )}
            </div>
          )}

          {/* Tool Selection */}
          <div className="mb-6 space-y-6">
            {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
              <div key={category}>
                <Text className="mb-3 font-medium capitalize">
                  {t('caseImporter.toolPrefs.categoryTools', {
                    defaultValue: '{{category}} Tools',
                    category,
                  })}
                </Text>
                <div className="space-y-2">
                  {categoryTools.map((tool) => (
                    <div
                      key={tool.tool_id}
                      className="flex items-start rounded-md border border-muted bg-white p-3 dark:bg-gray-100"
                    >
                      <Checkbox
                        checked={selectedTools.has(tool.tool_id)}
                        onChange={() => toggleTool(tool.tool_id)}
                        className="mt-1"
                      />
                      <div className="ml-3 flex-1">
                        <Text className="font-medium">{tool.name || tool.tool_id}</Text>
                        {tool.description && (
                          <Text className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {tool.description}
                          </Text>
                        )}
                        <Text className="mt-1 text-xs text-gray-500">
                          {t('caseImporter.toolPrefs.toolId', 'Tool ID')}: <code className="font-mono text-xs">{tool.tool_id}</code>
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button onClick={savePreferences} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <Loader size="sm" variant="spinner" className="mr-2" />
                  {t('caseImporter.pluginSettings.saving')}
                </>
              ) : (
                <>
                  <PiCheckCircleDuotone className="mr-2 h-5 w-5" />
                  {t('caseImporter.toolPrefs.savePreferences', 'Save Preferences')}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={loadData} disabled={isSaving}>
              {t('caseImporter.pluginSettings.cancel')}
            </Button>
          </div>

          {/* Info Message */}
          <div className="mt-4 rounded-md border border-dashed border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
            <Text className="text-xs text-blue-600 dark:text-blue-400">
              <PiGearBold className="mr-1 inline h-3 w-3" />
              {t(
                'caseImporter.toolPrefs.info',
                'These preferences will apply to all your future imports. Changes are saved to your account.'
              )}
            </Text>
          </div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && tools.length === 0 && (
        <Empty
          text={t('caseImporter.toolPrefs.noTools', 'No tools available')}
          textClassName="text-gray-500"
        />
      )}
    </div>
  );
}
