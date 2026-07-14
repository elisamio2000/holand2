'use client';

import { useState, useEffect } from 'react';
import { PiPlus, PiPencil, PiTrash, PiCheck, PiX, PiSpinner, PiLightning } from 'react-icons/pi';
import { Button, Input, Select, Switch, ActionIcon, Text, Title, Badge, Loader } from 'rizzui';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import adminLLMService from '@/services/admin-llm.service';
import type { AIProviderConfig, AIProviderCreate, AIProviderUpdate, DiscoveredModel, ModelDiscoveryResult } from '@/types/admin-llm.types';

export default function ProvidersTab() {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<AIProviderCreate>>({
    provider_type: 'vllm',
    is_active: false,
    is_primary: false,
  });
  const [discovering, setDiscovering] = useState<number | null>(null);
  const [checking, setChecking] = useState<number | null>(null);
  /** Per-provider discovered model lists, keyed by provider id. */
  const [discoveredModels, setDiscoveredModels] = useState<Record<number, DiscoveredModel[]>>({});

  useEffect(() => {
    void loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await adminLLMService.listProviders();
      setProviders(data);
    } catch (error: any) {
      toast.error(`خطا در بارگذاری: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.base_url) {
      toast.error('نام و آدرس پایه الزامی است');
      return;
    }

    try {
      await adminLLMService.createProvider(formData as AIProviderCreate);
      toast.success('Provider ایجاد شد');
      setFormData({ provider_type: 'vllm', is_active: false, is_primary: false });
      await loadProviders();
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
    }
  };

  const handleUpdate = async (id: number, updates: AIProviderUpdate) => {
    try {
      await adminLLMService.updateProvider(id, updates);
      toast.success('Provider به‌روز شد');
      await loadProviders();
      setEditingId(null);
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try {
      await adminLLMService.deleteProvider(id);
      toast.success('Provider حذف شد');
      await loadProviders();
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
    }
  };

  const handleDiscoverModels = async (id: number) => {
    try {
      setDiscovering(id);
      // Clear previous results for this provider while re-discovering
      setDiscoveredModels((prev) => ({ ...prev, [id]: [] }));
      const result = await adminLLMService.discoverModels(id);
      if (result.status === 'success' && result.models) {
        setDiscoveredModels((prev) => ({ ...prev, [id]: result.models! }));
        toast.success(`${result.models.length} مدل یافت شد`);
      } else {
        setDiscoveredModels((prev) => ({ ...prev, [id]: [] }));
        toast.error(result.message || 'خطا در کشف مدل‌ها');
      }
    } catch (error: any) {
      setDiscoveredModels((prev) => ({ ...prev, [id]: [] }));
      toast.error(`خطا: ${error.message}`);
    } finally {
      setDiscovering(null);
    }
  };

  const handleSetDefaultModel = async (providerId: number, modelId: string) => {
    try {
      await adminLLMService.updateProvider(providerId, { default_model: modelId });
      toast.success(`مدل پیش‌فرض: ${modelId}`);
      await loadProviders();
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
    }
  };

  const handleHealthCheck = async (id: number) => {
    try {
      setChecking(id);
      const result = await adminLLMService.healthCheck(id);
      if (result.status === 'success') {
        toast.success(`سلامت: ${result.health} (${result.latency_ms}ms)`);
      } else {
        // Categorize error for better diagnostics
        const health = result.health ?? 'offline';
        const labels: Record<string, string> = {
          timeout: 'اتصال: Timeout',
          degraded: 'خطای HTTP (احراز هویت یا سرور)',
          offline: 'عدم دسترسی به سرور',
        };
        toast.error(`${labels[health] ?? health}: ${result.message ?? ''}`);
      }
      await loadProviders();
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
    } finally {
      setChecking(null);
    }
  };

  const getHealthBadgeColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'offline':
      case 'timeout':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <Title as="h3" className="mb-4">افزودن Provider جدید</Title>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="نام"
            placeholder="e.g., vLLM Production"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Select
            label="نوع Provider"
            value={formData.provider_type}
            onChange={(value: string) => setFormData({ ...formData, provider_type: value as any })}
            options={[
              { value: 'vllm', label: 'vLLM (OpenAI-compatible)' },
              { value: 'ollama', label: 'Ollama' },
              { value: 'openai', label: 'OpenAI' },
            ]}
          />
          <Input
            label="Base URL"
            placeholder="http://localhost:18005"
            value={formData.base_url || ''}
            onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
          />
          <Input
            label="API Key (اختیاری)"
            type="password"
            placeholder="sk-..."
            value={formData.api_key || ''}
            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
          />
          <Input
            label="Default Model (اختیاری)"
            placeholder="e.g., llama-3-8b"
            value={formData.default_model || ''}
            onChange={(e) => setFormData({ ...formData, default_model: e.target.value })}
          />
          <div className="flex items-center gap-4">
            <Switch
              label="فعال"
              checked={formData.is_active || false}
              onChange={(e: any) => {
                const val = typeof e === 'boolean' ? e : Boolean(e?.target?.checked);
                setFormData({ ...formData, is_active: val });
              }}
            />
            <Switch
              label="اصلی"
              checked={formData.is_primary || false}
              onChange={(e: any) => {
                const val = typeof e === 'boolean' ? e : Boolean(e?.target?.checked);
                setFormData({ ...formData, is_primary: val });
              }}
            />
          </div>
        </div>
        <Button onClick={handleCreate} className="mt-4">
          <PiPlus className="h-4 w-4" />
          افزودن Provider
        </Button>
      </div>

      {/* Providers List */}
      <div className="space-y-4">
        <Title as="h3">Providers موجود ({providers.length})</Title>
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={cn(
              'rounded-lg border p-4',
              provider.is_primary ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Text className="font-semibold">{provider.name}</Text>
                  {provider.is_primary && <Badge>اصلی</Badge>}
                  {provider.is_active && <Badge color="success">فعال</Badge>}
                  {provider.health_status && (
                    <Badge color={getHealthBadgeColor(provider.health_status)}>
                      {provider.health_status}
                    </Badge>
                  )}
                </div>
                <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {provider.provider_type} • {provider.base_url}
                </Text>
                {provider.default_model && (
                  <Text className="mt-1 text-xs text-gray-500">
                    Model: {provider.default_model}
                  </Text>
                )}
                {provider.last_health_check && (
                  <Text className="mt-1 text-xs text-gray-500">
                    آخرین بررسی: {new Date(provider.last_health_check).toLocaleString('fa-IR')}
                  </Text>
                )}
                {/* Discovered models panel — visible after clicking Discover */}
                {discoveredModels[provider.id] && discoveredModels[provider.id].length > 0 && (
                  <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <Text className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      مدل‌های کشف‌شده ({discoveredModels[provider.id].length})
                    </Text>
                    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                      {discoveredModels[provider.id].map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Text className="truncate text-xs text-gray-700 dark:text-gray-300">
                            {model.id}
                            {model.size ? ` · ${(model.size / 1e9).toFixed(1)}GB` : ''}
                          </Text>
                          <Button
                            size="sm"
                            variant={provider.default_model === model.id ? 'solid' : 'outline'}
                            className="ml-2 shrink-0 text-xs"
                            onClick={() => handleSetDefaultModel(provider.id, model.id)}
                          >
                            {provider.default_model === model.id ? '✓ پیش‌فرض' : 'انتخاب'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ActionIcon
                  variant="text"
                  onClick={() => handleHealthCheck(provider.id)}
                  disabled={checking === provider.id}
                  title="بررسی سلامت"
                >
                  {checking === provider.id ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiCheck className="h-4 w-4" />}
                </ActionIcon>
                <ActionIcon
                  variant="text"
                  onClick={() => handleDiscoverModels(provider.id)}
                  disabled={discovering === provider.id}
                  title="کشف مدل‌ها"
                >
                  {discovering === provider.id ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiLightning className="h-4 w-4" />}
                </ActionIcon>
                <ActionIcon
                  variant="text"
                  onClick={() => setEditingId(editingId === provider.id ? null : provider.id)}
                  title="ویرایش"
                >
                  <PiPencil className="h-4 w-4" />
                </ActionIcon>
                <ActionIcon
                  variant="text"
                  color="danger"
                  onClick={() => handleDelete(provider.id)}
                  title="حذف"
                >
                  <PiTrash className="h-4 w-4" />
                </ActionIcon>
              </div>
            </div>

            {editingId === provider.id && (
              <div className="mt-4 space-y-4 border-t pt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="نام"
                    defaultValue={provider.name}
                    onBlur={(e) => handleUpdate(provider.id, { name: e.target.value })}
                  />
                  <Input
                    label="Base URL"
                    defaultValue={provider.base_url}
                    onBlur={(e) => handleUpdate(provider.id, { base_url: e.target.value })}
                  />
                  <Input
                    label="Default Model"
                    defaultValue={provider.default_model || ''}
                    onBlur={(e) => handleUpdate(provider.id, { default_model: e.target.value })}
                  />
                  <div className="flex items-center gap-4">
                    <Switch
                      label="فعال"
                      defaultChecked={provider.is_active}
                      onChange={(e: any) => {
                        const val = typeof e === 'boolean' ? e : Boolean(e?.target?.checked);
                        handleUpdate(provider.id, { is_active: val });
                      }}
                    />
                    <Switch
                      label="اصلی"
                      defaultChecked={provider.is_primary}
                      onChange={(e: any) => {
                        const val = typeof e === 'boolean' ? e : Boolean(e?.target?.checked);
                        handleUpdate(provider.id, { is_primary: val });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
