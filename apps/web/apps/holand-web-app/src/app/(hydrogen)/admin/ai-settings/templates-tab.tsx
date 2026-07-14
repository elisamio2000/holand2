'use client';

import { useState, useEffect } from 'react';
import { PiPlus, PiPencil, PiTrash } from 'react-icons/pi';
import { Button, Input, Select, Switch, ActionIcon, Text, Title, Badge, Loader, Textarea } from 'rizzui';
import toast from 'react-hot-toast';
import adminLLMService from '@/services/admin-llm.service';
import type { LLMPromptTemplate, LLMPromptTemplateCreate } from '@/types/admin-llm.types';

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<LLMPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<LLMPromptTemplateCreate>>({
    template_type: 'holland',
    is_active: true,
    version: 1,
    generation_params: { temperature: 0.7, max_tokens: 2000, top_p: 0.9 },
  });

  useEffect(() => {
    void loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await adminLLMService.listTemplates();
      setTemplates(data);
    } catch (error: any) {
      toast.error(`خطا در بارگذاری: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.prompt_template) {
      toast.error('نام و متن template الزامی است');
      return;
    }

    try {
      await adminLLMService.createTemplate(formData as LLMPromptTemplateCreate);
      toast.success('Template ایجاد شد');
      setFormData({
        template_type: 'holland',
        is_active: true,
        version: 1,
        generation_params: { temperature: 0.7, max_tokens: 2000, top_p: 0.9 },
      });
      await loadTemplates();
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try {
      await adminLLMService.deleteTemplate(id);
      toast.success('Template حذف شد');
      await loadTemplates();
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
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
        <Title as="h3" className="mb-4">افزودن Template جدید</Title>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="نام"
              placeholder="e.g., holland_detailed_v1"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Select
              label="نوع Template"
              value={formData.template_type}
              onChange={(value: string) => setFormData({ ...formData, template_type: value as any })}
              options={[
                { value: 'holland', label: 'Holland Interpretation' },
                { value: 'mbti', label: 'MBTI Interpretation' },
                { value: 'combined', label: 'Combined Holland+MBTI' },
                { value: 'career_path', label: 'Career Path Planning' },
              ]}
            />
            <Input
              label="نسخه"
              type="number"
              value={formData.version || 1}
              onChange={(e) => setFormData({ ...formData, version: parseInt(e.target.value) || 1 })}
            />
          </div>

          <Textarea
            label="Prompt Template (با {{HOLLAND_CODE}}, {{MBTI_TYPE}}, {{AGE_BAND}})"
            placeholder="شما یک مشاور شغلی هستید. کاربر کد {{HOLLAND_CODE}} دارد..."
            rows={8}
            value={formData.prompt_template || ''}
            onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })}
          />

          <Textarea
            label="System Prompt (اختیاری)"
            placeholder="شما یک مشاور خبره هستید..."
            rows={3}
            value={formData.system_prompt || ''}
            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
          />

          <div className="flex items-center gap-4">
            <Switch
              label="فعال"
              checked={formData.is_active || false}
              onChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </div>
        <Button onClick={handleCreate} className="mt-4">
          <PiPlus className="h-4 w-4" />
          افزودن Template
        </Button>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        <Title as="h3">Templates موجود ({templates.length})</Title>
        {templates.map((template) => (
          <div
            key={template.id}
            className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Text className="font-semibold">{template.name}</Text>
                  <Badge>{template.template_type}</Badge>
                  <Badge color="secondary">v{template.version}</Badge>
                  {template.is_active && <Badge color="success">فعال</Badge>}
                </div>
                <Text className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {template.prompt_template.substring(0, 150)}...
                </Text>
                <Text className="mt-1 text-xs text-gray-500">
                  Params: temp={template.generation_params?.temperature}, max_tokens={template.generation_params?.max_tokens}
                </Text>
              </div>
              <div className="flex items-center gap-2">
                <ActionIcon
                  variant="text"
                  onClick={() => setEditingId(editingId === template.id ? null : template.id)}
                  title="ویرایش"
                >
                  <PiPencil className="h-4 w-4" />
                </ActionIcon>
                <ActionIcon
                  variant="text"
                  color="danger"
                  onClick={() => handleDelete(template.id)}
                  title="حذف"
                >
                  <PiTrash className="h-4 w-4" />
                </ActionIcon>
              </div>
            </div>

            {editingId === template.id && (
              <div className="mt-4 border-t pt-4">
                <pre className="rounded-md bg-gray-100 p-4 text-xs dark:bg-gray-800">
                  {template.prompt_template}
                </pre>
                {template.system_prompt && (
                  <div className="mt-2">
                    <Text className="text-sm font-medium">System Prompt:</Text>
                    <pre className="mt-1 rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
                      {template.system_prompt}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
