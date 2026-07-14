/**
 * Admin LLM Configuration Service
 * API client for provider/template management, model discovery, AI report generation
 */

import { gatewayClient } from '@/lib/api-client';
import type {
  AIProviderConfig,
  AIProviderCreate,
  AIProviderUpdate,
  LLMPromptTemplate,
  LLMPromptTemplateCreate,
  LLMPromptTemplateUpdate,
  ModelDiscoveryResult,
  HealthCheckResult,
  GenerateAIReportRequest,
  GenerateAIReportResponse,
} from '@/types/admin-llm.types';

class AdminLLMService {
  // ==========================================
  // Provider Management
  // ==========================================

  async listProviders(): Promise<AIProviderConfig[]> {
    const { data } = await gatewayClient.get<AIProviderConfig[]>('/admin/llm/providers');
    return data;
  }

  async getProvider(providerId: number): Promise<AIProviderConfig> {
    const { data } = await gatewayClient.get<AIProviderConfig>(`/admin/llm/providers/${providerId}`);
    return data;
  }

  async createProvider(payload: AIProviderCreate): Promise<AIProviderConfig> {
    const { data } = await gatewayClient.post<AIProviderConfig>('/admin/llm/providers', payload);
    return data;
  }

  async updateProvider(providerId: number, payload: AIProviderUpdate): Promise<AIProviderConfig> {
    const { data } = await gatewayClient.patch<AIProviderConfig>(`/admin/llm/providers/${providerId}`, payload);
    return data;
  }

  async deleteProvider(providerId: number): Promise<void> {
    await gatewayClient.delete(`/admin/llm/providers/${providerId}`);
  }

  async discoverModels(providerId: number): Promise<ModelDiscoveryResult> {
    const { data } = await gatewayClient.post<ModelDiscoveryResult>(
      `/admin/llm/providers/${providerId}/discover-models`
    );
    return data;
  }

  async healthCheck(providerId: number): Promise<HealthCheckResult> {
    const { data } = await gatewayClient.post<HealthCheckResult>(`/admin/llm/providers/${providerId}/health-check`);
    return data;
  }

  // ==========================================
  // Prompt Template Management
  // ==========================================

  async listTemplates(): Promise<LLMPromptTemplate[]> {
    const { data } = await gatewayClient.get<LLMPromptTemplate[]>('/admin/llm/templates');
    return data;
  }

  async getTemplate(templateId: number): Promise<LLMPromptTemplate> {
    const { data } = await gatewayClient.get<LLMPromptTemplate>(`/admin/llm/templates/${templateId}`);
    return data;
  }

  async createTemplate(payload: LLMPromptTemplateCreate): Promise<LLMPromptTemplate> {
    const { data } = await gatewayClient.post<LLMPromptTemplate>('/admin/llm/templates', payload);
    return data;
  }

  async updateTemplate(templateId: number, payload: LLMPromptTemplateUpdate): Promise<LLMPromptTemplate> {
    const { data } = await gatewayClient.patch<LLMPromptTemplate>(`/admin/llm/templates/${templateId}`, payload);
    return data;
  }

  async deleteTemplate(templateId: number): Promise<void> {
    await gatewayClient.delete(`/admin/llm/templates/${templateId}`);
  }

  // ==========================================
  // AI Report Generation
  // ==========================================

  async generateAIReport(sessionId: string, payload: GenerateAIReportRequest): Promise<GenerateAIReportResponse> {
    const { data } = await gatewayClient.post<GenerateAIReportResponse>(
      `/admin/llm/sessions/${sessionId}/generate-ai-report`,
      payload
    );
    return data;
  }
}

// Export singleton instance
export const adminLLMService = new AdminLLMService();
export default adminLLMService;
