'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Loader,
  Select,
  Text,
  Title,
} from 'rizzui';
import {
  PiArrowRightBold,
  PiMagnifyingGlassBold,
  PiPlugsBold,
  PiSparkleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import type { LlmModel, LogicalCatalogEntry, ToolBinding, ToolRegistryEntry } from '@/types/pipeline-admin.types';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { toApiToolId } from '@/utils/tool-id';
import ToolBindingPatchPanel from '@/app/shared/admin-pipeline/components/tool-binding-patch-panel';
import LogicalModelSelect from '@/app/shared/admin-pipeline/components/logical-model-select';
import { normalizeBindingModelId } from '@/app/shared/admin-pipeline/helpers/logical-model-options';

interface ToolBindingMasterDetailProps {
  tools: ToolRegistryEntry[];
  models: LlmModel[];
  logicalCatalog?: LogicalCatalogEntry[];
  bindingsMap?: Record<string, string>;
  initialToolId?: string | null;
  showPatchPanelDefault?: boolean;
  onSaved?: () => void;
}

function sortTools(list: ToolRegistryEntry[]) {
  return [...list].sort((a, b) => {
    if (Boolean(a.uses_llm) !== Boolean(b.uses_llm)) {
      return a.uses_llm ? -1 : 1;
    }
    if (Boolean(a.is_bound) !== Boolean(b.is_bound)) {
      return a.is_bound ? -1 : 1;
    }
    return a.tool_id.localeCompare(b.tool_id);
  });
}

export default function ToolBindingMasterDetail({
  tools,
  models,
  logicalCatalog = [],
  bindingsMap = {},
  initialToolId,
  showPatchPanelDefault: _showPatchPanelDefault = false,
  onSaved,
}: ToolBindingMasterDetailProps) {
  const { t } = useTranslation();
  const [toolSearch, setToolSearch] = useState('');
  const [llmOnlyFilter, setLlmOnlyFilter] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolRegistryEntry | null>(null);
  const [binding, setBinding] = useState<ToolBinding>({ model: '' });
  const [bindingLoading, setBindingLoading] = useState(false);

  const filteredTools = useMemo(() => {
    let list = tools;
    if (llmOnlyFilter) list = list.filter((tool) => tool.uses_llm);
    const q = toolSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tool) =>
          tool.tool_id.toLowerCase().includes(q) ||
          (tool.description ?? '').toLowerCase().includes(q) ||
          (tool.category ?? '').toLowerCase().includes(q) ||
          (tool.bound_model ?? '').toLowerCase().includes(q)
      );
    }
    return sortTools(list);
  }, [tools, toolSearch, llmOnlyFilter]);

  const llmFilterIneffective = useMemo(() => {
    if (!llmOnlyFilter || tools.length === 0) return false;
    return tools.every((tool) => tool.uses_llm !== false);
  }, [llmOnlyFilter, tools]);

  const catalogModels = useMemo(() => {
    const api = binding.api ?? selectedTool?.llm_api ?? 'chat';
    const taskForApi =
      api === 'embed' ? 'embed' : api === 'image' ? 'image' : 'chat';
    return models
      .filter(
        (m) =>
          m.is_active &&
          (m.task === taskForApi || m.task === 'chat') &&
          (m.health == null || m.health.healthy !== false)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models, binding.api, selectedTool?.llm_api]);

  const openToolBinding = async (tool: ToolRegistryEntry) => {
    setSelectedTool(tool);
    setBindingLoading(true);
    try {
      const existing = await pipelineAdminService.getToolBinding(tool.tool_id);
      const profile = tool.llm_profile as
        | { input_modalities?: string[]; output_modalities?: string[]; api?: string }
        | null
        | undefined;
      setBinding(
        existing ?? {
          model: tool.bound_model ?? '',
          fallback_model: tool.bound_fallback_model ?? null,
          input_modalities: profile?.input_modalities ?? ['text'],
          output_modalities: profile?.output_modalities ?? ['text'],
          api: profile?.api ?? tool.llm_api ?? 'chat',
        }
      );
    } finally {
      setBindingLoading(false);
    }
  };

  useEffect(() => {
    if (!initialToolId || selectedTool) return;
    const tool = tools.find((t) => t.tool_id === initialToolId);
    if (tool) void openToolBinding(tool);
  }, [initialToolId, tools, selectedTool]);

  const applySuggestion = async () => {
    if (!selectedTool) return;
    const suggestion = await pipelineAdminService.suggestToolModel(selectedTool.tool_id);
    const profile = suggestion?.suggested_profile as
      | { input_modalities?: string[]; output_modalities?: string[]; api?: string }
      | undefined;
    const next =
      suggestion?.suggested ??
      (profile
        ? {
            model: binding.model,
            api: profile.api ?? binding.api,
            input_modalities: profile.input_modalities,
            output_modalities: profile.output_modalities,
          }
        : null);
    if (!next) return;
    setBinding((b) => ({ ...b, ...next }));
  };

  const saveToolBinding = async () => {
    if (!selectedTool || !binding.model?.trim()) return;
    setBindingLoading(true);
    try {
      const payload: ToolBinding = {
        ...binding,
        model: normalizeBindingModelId(models, binding.model),
        fallback_model: binding.fallback_model
          ? normalizeBindingModelId(models, binding.fallback_model)
          : null,
      };
      await pipelineAdminService.setToolBinding(selectedTool.tool_id, payload);
      onSaved?.();
    } finally {
      setBindingLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <Input
          prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
          placeholder={t('llmPage.tools.searchPlaceholder')}
          value={toolSearch}
          onChange={(e) => setToolSearch(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <Text>
            {t('llmPage.tools.registryCount', {
              shown: filteredTools.length,
              total: tools.length,
            })}
          </Text>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={llmOnlyFilter}
              onChange={(e) => setLlmOnlyFilter(e.target.checked)}
              className="rounded border-muted"
            />
            {t('llmPage.tools.llmOnlyFilter')}
          </label>
        </div>
        {llmFilterIneffective && (
          <Text className="text-xs text-amber-600 dark:text-amber-400">
            {t('llmPage.tools.llmOnlyFilterHint')}
          </Text>
        )}
        <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-xl border border-muted p-2">
          {filteredTools.map((tool) => (
            <button
              key={tool.tool_id}
              type="button"
              onClick={() => openToolBinding(tool)}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-start transition-colors',
                selectedTool?.tool_id === tool.tool_id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-100/40'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Text className="font-mono text-xs font-semibold">{tool.tool_id}</Text>
                {tool.uses_llm ? (
                  <Badge
                    size="sm"
                    color={tool.is_bound || bindingsMap[toApiToolId(tool.tool_id)] ? 'success' : 'warning'}
                    variant="flat"
                  >
                    {tool.bound_model ??
                      bindingsMap[toApiToolId(tool.tool_id)] ??
                      t('llmPage.tools.noBinding')}
                  </Badge>
                ) : (
                  <Badge size="sm" variant="flat" color="secondary">
                    {t('llmPage.tools.noLlm')}
                  </Badge>
                )}
              </div>
              <Text className="line-clamp-2 text-xs text-gray-500">{tool.description}</Text>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-muted bg-gray-0 p-5 lg:col-span-3 dark:bg-gray-50">
        {!selectedTool ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-gray-400">
            <PiPlugsBold className="mb-2 h-10 w-10" />
            <Text>{t('llmPage.tools.selectTool')}</Text>
          </div>
        ) : bindingLoading && !binding.model ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader variant="spinner" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Title className="font-mono text-base">{selectedTool.tool_id}</Title>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void applySuggestion()}>
                  <PiSparkleBold className="me-1 h-4 w-4" />
                  {t('llmPage.tools.suggestModel')}
                </Button>
                <Button onClick={() => void saveToolBinding()} disabled={bindingLoading} size="sm">
                  {t('llmPage.tools.saveBinding')}
                </Button>
              </div>
            </div>
            <ToolBindingPatchPanel
              tools={filteredTools}
              selectedToolId={selectedTool.tool_id}
              selectedTool={selectedTool}
              binding={binding}
              bindingsMap={bindingsMap}
              models={catalogModels}
              onBindingChange={setBinding}
              onToolSelect={(toolId) => {
                const tool = tools.find((item) => item.tool_id === toolId);
                if (tool) void openToolBinding(tool);
              }}
            />
            <LogicalModelSelect
              label={t('llmPage.tools.modelLabel')}
              value={binding.model || ''}
              models={catalogModels.length ? catalogModels : models}
              catalog={logicalCatalog}
              onChange={(v) => setBinding((b) => ({ ...b, model: v }))}
            />
            <LogicalModelSelect
              label={t('llmPage.tools.fallbackModelLabel')}
              value={binding.fallback_model ?? ''}
              models={catalogModels.length ? catalogModels : models}
              catalog={logicalCatalog}
              includeEmpty
              onChange={(v) => setBinding((b) => ({ ...b, fallback_model: v || null }))}
            />
            <Select
              label={t('llmPage.tools.apiLabel')}
              value={binding.api ?? 'chat'}
              onChange={(v: { value: string }) =>
                setBinding((b) => ({ ...b, api: v.value }))
              }
              options={[
                { label: 'chat', value: 'chat' },
                { label: 'embed', value: 'embed' },
                { label: 'image', value: 'image' },
              ]}
            />
            <Text className="flex items-center gap-1 text-xs text-gray-400">
              <PiArrowRightBold />
              {t('llmPage.tools.routeKeyHint', { toolId: selectedTool.tool_id })}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
