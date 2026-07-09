// ============================================
// ToolsPanel — Available AI tools/capabilities display
// Shows categorized tools from GET /tools endpoint
// ============================================

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiGear,
  PiCaretDown,
  PiCaretRight,
  PiWarningCircle,
  PiImage,
  PiTextAa,
  PiMusicNote,
  PiMagnifyingGlass,
  PiCode,
  PiChartBar,
  PiCube,
  PiLightning,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { Loader } from 'rizzui';
import { chatService } from '@/services/chat.service';
import type { ToolInfo } from '@/types/chat.types';
import { isHttpStatusError } from '@/app/shared/ai-chat/utils/http-error';
import BackendUnavailableBanner from '@/app/shared/ai-chat/components/backend-unavailable-banner';
import { TOOLS_FALLBACK_CATALOG } from '@/app/shared/ai-chat/config/tools-fallback-catalog';
import type { ChatApiEndpointStatus } from '@/hooks/use-chat-api-health';

/**
 * Icon mapping for tool categories.
 * Falls back to PiGear for unknown categories.
 */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  image: <PiImage className="h-4 w-4" />,
  vision: <PiImage className="h-4 w-4" />,
  text: <PiTextAa className="h-4 w-4" />,
  audio: <PiMusicNote className="h-4 w-4" />,
  search: <PiMagnifyingGlass className="h-4 w-4" />,
  code: <PiCode className="h-4 w-4" />,
  analysis: <PiChartBar className="h-4 w-4" />,
  file: <PiCube className="h-4 w-4" />,
  general: <PiLightning className="h-4 w-4" />,
};

/**
 * Get the icon for a tool category.
 */
function getCategoryIcon(category: string): React.ReactNode {
  const normalized = category.toLowerCase();
  return CATEGORY_ICONS[normalized] ?? <PiGear className="h-4 w-4" />;
}

interface ToolsPanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Probed tools API availability */
  toolsApiStatus?: ChatApiEndpointStatus;
  /** Opens dev requirements panel (dev only) */
  onOpenDevPanel?: () => void;
}

/**
 * ToolsPanel — Collapsible panel showing available AI tools/capabilities.
 *
 * Fetches tools from GET /tools API endpoint and displays them
 * grouped by category. Shows tool name, description, and capabilities.
 *
 * @requires chatService — for listTools() API call
 *
 * @example
 * ```tsx
 * <ToolsPanel isOpen={showTools} onClose={() => setShowTools(false)} />
 * ```
 */
export default function ToolsPanel({
  isOpen,
  onClose,
  toolsApiStatus = 'unknown',
  onOpenDevPanel,
}: ToolsPanelProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const apiUnavailable = toolsApiStatus === 'unavailable';

  const fallbackTools: ToolInfo[] = useMemo(
    () =>
      TOOLS_FALLBACK_CATALOG.map((item) => ({
        id: item.id,
        category: item.category,
        name: t(`chatPage.tools.fallback.${item.i18nKey}.name`),
        description: t(`chatPage.tools.fallback.${item.i18nKey}.description`),
        capabilities: item.capabilities,
      })),
    [t]
  );

  const displayTools = apiUnavailable ? fallbackTools : tools;

  /**
   * Fetch tools from API on mount or when panel opens.
   */
  const loadTools = useCallback(async () => {
    console.info('[ToolsPanel] Loading tools...');
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.listTools();
      setTools(data);
      console.info('[ToolsPanel] Tools loaded:', { count: data.length });

      // Auto-expand all categories initially
      const categories = new Set(data.map((t) => t.category ?? 'general'));
      setExpandedCategories(categories);
    } catch (err: unknown) {
      console.error('[ToolsPanel] Failed to load tools:', err);
      setError(
        isHttpStatusError(err, 404)
          ? t('chatPage.tools.backendUnavailable')
          : t('toolsPanel.errorLoad')
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen && !apiUnavailable && tools.length === 0 && !isLoading) {
      loadTools();
    }
    if (isOpen && apiUnavailable) {
      const categories = new Set(fallbackTools.map((tool) => tool.category ?? 'general'));
      setExpandedCategories(categories);
    }
  }, [isOpen, tools.length, isLoading, loadTools, apiUnavailable, fallbackTools]);

  /**
   * Toggle category expansion.
   */
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Group tools by category
  const toolsByCategory = displayTools.reduce<Record<string, ToolInfo[]>>((acc, tool) => {
    const cat = tool.category ?? 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 mx-auto max-w-3xl">
      <div className="rounded-xl border border-muted bg-gray-0 p-4 shadow-lg dark:bg-gray-50">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiGear className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              {t('toolsPanel.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/20"
            aria-label={t('toolsPanel.close')}
          >
            <PiCaretDown className="h-4 w-4" />
          </button>
        </div>

        {apiUnavailable && (
          <div className="mb-3 space-y-2">
            <BackendUnavailableBanner
              message={t('chatPage.tools.backendUnavailable')}
              onOpenDevPanel={onOpenDevPanel}
            />
            <p className="text-center text-[10px] text-gray-400">
              {t('chatPage.tools.fallbackNotice')}
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !apiUnavailable && (
          <div className="flex items-center justify-center py-8">
            <Loader variant="spinner" size="md" />
          </div>
        )}

        {/* Error state */}
        {error && !apiUnavailable && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-600 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
            <PiWarningCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tools list grouped by category */}
        {!isLoading && (!error || apiUnavailable) && Object.keys(toolsByCategory).length > 0 && (
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
              <div key={category} className="rounded-lg border border-muted">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start transition-colors hover:bg-gray-50 dark:hover:bg-gray-200/10"
                >
                  <span className="text-gray-500">
                    {getCategoryIcon(category)}
                  </span>
                  <span className="flex-1 text-sm font-medium capitalize text-gray-700">
                    {category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {categoryTools.length} {categoryTools.length !== 1 ? t('toolsPanel.toolPlural') : t('toolsPanel.toolSingular')}
                  </span>
                  {expandedCategories.has(category) ? (
                    <PiCaretDown className="h-3 w-3 text-gray-400" />
                  ) : (
                    <PiCaretRight className="h-3 w-3 text-gray-400" />
                  )}
                </button>

                {/* Tools in this category */}
                {expandedCategories.has(category) && (
                  <div className="border-t border-muted px-3 py-1">
                    {categoryTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="py-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <PiLightning className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary/60" />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-700">
                              {tool.name ?? tool.id}
                            </span>
                            {tool.description && (
                              <p className="text-xs leading-tight text-gray-400 dark:text-gray-500">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && !apiUnavailable && tools.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">
            {t('toolsPanel.empty')}
          </p>
        )}

        {/* Summary count */}
        {displayTools.length > 0 && (
          <div className="mt-2 text-center text-xs text-gray-400">
            {displayTools.length} {t('toolsPanel.summaryAcross')}{' '}
            {Object.keys(toolsByCategory).length} {t('toolsPanel.summaryCategories')}
            {apiUnavailable && ` — ${t('chatPage.tools.fallbackNotice')}`}
          </div>
        )}
      </div>
    </div>
  );
}
