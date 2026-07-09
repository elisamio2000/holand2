// ============================================
// DecisionSimulatorTab — Simulate LLM model selection
// Test which model would be chosen for a given tool/role
// ============================================
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Switch,
  Text,
  Loader,
} from 'rizzui';
import {
  PiPlayBold,
  PiLightningBold,
  PiCheckCircleBold,
  PiArrowRightBold,
  PiFlowArrowBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';

import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { toApiToolId } from '@/utils/tool-id';
import { resolveLogicalId } from '../helpers/logical-model-options';
import type {
  LlmRoute,
  LlmModel,
  ToolRegistryEntry,
} from '@/types/pipeline-admin.types';
import SectionCard from '../components/section-card';

const LOG_TAG = '[DecisionSimulatorTab]';

function routeModelMatches(models: LlmModel[], routeModelName: string): boolean {
  return models.some(
    (m) =>
      m.is_active &&
      (m.name === routeModelName || resolveLogicalId(m) === routeModelName)
  );
}

function resolveDisplayModel(models: LlmModel[], routeModelName: string): string {
  const byLogical = models.find(
    (m) => m.is_active && resolveLogicalId(m) === routeModelName
  );
  if (byLogical) return resolveLogicalId(byLogical);
  const byName = models.find((m) => m.is_active && m.name === routeModelName);
  return byName ? resolveLogicalId(byName) : routeModelName;
}

interface SimulationResult {
  input: string;
  resolvedModel: string | null;
  routeKey: string | null;
  fallbackUsed: boolean;
  resolvedVia: 'route' | 'binding' | 'role' | 'none';
}

interface DecisionSimulatorTabProps {
  routes: LlmRoute[];
  models: LlmModel[];
  tools: ToolRegistryEntry[];
  initialRouteKey?: string | null;
}

/**
 * DecisionSimulatorTab — Test model resolution logic.
 *
 * Runs a local simulation matching the gateway routing algorithm:
 * 1. Check tool binding route (tool.{tool_id})
 * 2. Check exact route_key match
 * 3. Check prefix matches
 * 4. Fallback chain
 */
export default function DecisionSimulatorTab({
  routes,
  models,
  tools,
  initialRouteKey,
}: DecisionSimulatorTabProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialRouteKey ?? '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<SimulationResult[]>([]);

  useEffect(() => {
    if (initialRouteKey) {
      setInput(initialRouteKey);
    }
  }, [initialRouteKey]);

  const simulate = useCallback(
    async (query: string): Promise<SimulationResult> => {
      const normalized = toApiToolId(query.trim());

      // 1. Direct tool binding route
      const toolRoute = routes.find(
        (r) =>
          r.is_active &&
          (r.route_key === `tool.${normalized}` ||
            r.route_key === `tool.${query.trim()}`)
      );
      if (toolRoute) {
        const modelExists = routeModelMatches(models, toolRoute.model_name);
        if (modelExists) {
          return {
            input: query,
            resolvedModel: resolveDisplayModel(models, toolRoute.model_name),
            routeKey: toolRoute.route_key,
            fallbackUsed: false,
            resolvedVia: 'binding',
          };
        }
        if (toolRoute.fallback_model_name) {
          return {
            input: query,
            resolvedModel: toolRoute.fallback_model_name,
            routeKey: toolRoute.route_key,
            fallbackUsed: true,
            resolvedVia: 'binding',
          };
        }
      }

      // 2. Exact route key match
      const exactRoute = routes.find(
        (r) => r.is_active && r.route_key === query.trim()
      );
      if (exactRoute) {
        const modelExists = routeModelMatches(models, exactRoute.model_name);
        return {
          input: query,
          resolvedModel: modelExists
            ? resolveDisplayModel(models, exactRoute.model_name)
            : exactRoute.fallback_model_name || null,
          routeKey: exactRoute.route_key,
          fallbackUsed: !modelExists,
          resolvedVia: 'route',
        };
      }

      // 3. Role match (chat.*)
      const roleRoute = routes.find(
        (r) =>
          r.is_active && r.route_key.startsWith('chat.') && query.trim().startsWith('chat.')
      );
      if (roleRoute) {
        return {
          input: query,
          resolvedModel: roleRoute.model_name,
          routeKey: roleRoute.route_key,
          fallbackUsed: false,
          resolvedVia: 'role',
        };
      }

      // 4. Server-side suggestion
      try {
        const suggestion = await pipelineAdminService.suggestToolModel(
          query.trim()
        );
        if (suggestion?.model_name) {
          return {
            input: query,
            resolvedModel: suggestion.model_name,
            routeKey: suggestion.route_key || null,
            fallbackUsed: false,
            resolvedVia: 'binding',
          };
        }
      } catch {
        // Fallthrough
      }

      return {
        input: query,
        resolvedModel: null,
        routeKey: null,
        fallbackUsed: false,
        resolvedVia: 'none',
      };
    },
    [routes, models]
  );

  const handleRun = useCallback(async () => {
    if (!input.trim()) return;
    console.info(LOG_TAG, 'Simulating for:', input);
    setRunning(true);
    try {
      const sim = await simulate(input);
      setResult(sim);
      setHistory((prev) => [sim, ...prev.slice(0, 9)]);
      if (!sim.resolvedModel) {
        toast.error(t('pipeline.simulator.noResult'));
      }
    } catch (err) {
      console.error(LOG_TAG, 'Simulation error:', err);
      toast.error(t('common.error'));
    } finally {
      setRunning(false);
    }
  }, [input, simulate, t]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Panel */}
      <SectionCard
        title={t('pipeline.simulator.title')}
        icon={<PiLightningBold className="h-5 w-5 text-primary" />}
      >
        <Text className="mb-4 text-sm text-gray-500">
          {t('pipeline.simulator.description')}
        </Text>

        <div className="space-y-4">
          <div>
            <Text className="mb-1.5 text-sm font-medium">
              {t('pipeline.simulator.inputLabel')}
            </Text>
            <Input
              size="sm"
              placeholder={t('pipeline.simulator.inputPlaceholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            />
          </div>

          <Button
            size="sm"
            onClick={handleRun}
            disabled={running || !input.trim()}
            className="w-full gap-1"
          >
            {running ? (
              <Loader size="sm" />
            ) : (
              <PiPlayBold className="h-3.5 w-3.5" />
            )}
            {running
              ? t('pipeline.simulator.running')
              : t('pipeline.simulator.run')}
          </Button>

          {/* Quick Options: tool IDs from registry */}
          {tools.length > 0 && (
            <div className="space-y-1.5">
              <Text className="text-xs font-medium text-gray-400">
                {t('pipeline.tools.title')}
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {tools.slice(0, 8).map((tool) => (
                  <button
                    key={tool.tool_id}
                    type="button"
                    onClick={() => setInput(tool.tool_id)}
                    className="rounded-md border border-muted px-2 py-1 font-mono text-[10px] transition-colors hover:border-primary hover:text-primary"
                  >
                    {tool.tool_id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Result Panel */}
      <SectionCard
        title={t('pipeline.simulator.result')}
        icon={<PiFlowArrowBold className="h-5 w-5 text-primary" />}
      >
        {!result ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Text className="text-sm text-gray-400">
              {t('pipeline.simulator.description')}
            </Text>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Result */}
            <div
              className={cn(
                'rounded-lg border p-4',
                result.resolvedModel
                  ? 'border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-950/10'
                  : 'border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-950/10'
              )}
            >
              <div className="flex items-center gap-2">
                {result.resolvedModel ? (
                  <PiCheckCircleBold className="h-5 w-5 text-green-500" />
                ) : (
                  <PiWarningCircleBold className="h-5 w-5 text-red-500" />
                )}
                <Text className="font-semibold">
                  {t('pipeline.simulator.selectedModel')}
                </Text>
              </div>
              <Text
                className={cn(
                  'mt-2 font-mono text-lg',
                  result.resolvedModel
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-500'
                )}
              >
                {result.resolvedModel || t('pipeline.simulator.noResult')}
              </Text>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded bg-gray-50/50 px-3 py-2 dark:bg-gray-100/30">
                <Text className="text-xs text-gray-500">
                  {t('pipeline.simulator.resolvedVia')}
                </Text>
                <Badge variant="flat" size="sm">
                  {result.resolvedVia}
                </Badge>
              </div>
              {result.routeKey && (
                <div className="flex items-center justify-between rounded bg-gray-50/50 px-3 py-2 dark:bg-gray-100/30">
                  <Text className="text-xs text-gray-500">
                    {t('pipeline.simulator.routeUsed')}
                  </Text>
                  <Badge variant="outline" size="sm" className="font-mono">
                    {result.routeKey}
                  </Badge>
                </div>
              )}
              {result.fallbackUsed && (
                <div className="flex items-center gap-2 rounded bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
                  <PiWarningCircleBold className="h-4 w-4 text-amber-500" />
                  <Text className="text-xs text-amber-600 dark:text-amber-400">
                    {t('pipeline.simulator.fallbackUsed')}
                  </Text>
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 1 && (
              <div className="mt-4 border-t border-muted pt-3">
                <Text className="mb-2 text-xs font-medium text-gray-400">
                  {t('common.lastActivity')}
                </Text>
                <div className="space-y-1">
                  {history.slice(1, 6).map((h, i) => (
                    <div
                      key={`${h.input}-${i}`}
                      className="flex items-center gap-2 text-xs text-gray-500"
                    >
                      <PiArrowRightBold className="h-3 w-3 text-gray-300" />
                      <Text className="font-mono">{h.input}</Text>
                      <Text>→</Text>
                      <Text
                        className={cn(
                          'font-medium',
                          h.resolvedModel
                            ? 'text-green-600'
                            : 'text-red-400'
                        )}
                      >
                        {h.resolvedModel || '✗'}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
