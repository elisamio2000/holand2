/**
 * Admin LLM Configuration Types
 * Provider configs, prompt templates, AI reports
 */

export interface AIProviderConfig {
  id: number;
  name: string;
  provider_type: 'vllm' | 'ollama' | 'openai';
  base_url: string;
  api_key_set: boolean; // API key exists but value is masked
  default_model?: string;
  config_json: Record<string, any>;
  is_active: boolean;
  is_primary: boolean;
  health_status?: 'healthy' | 'degraded' | 'offline' | 'unknown' | 'timeout';
  last_health_check?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface AIProviderCreate {
  name: string;
  provider_type: 'vllm' | 'ollama' | 'openai';
  base_url: string;
  api_key?: string;
  default_model?: string;
  config_json?: Record<string, any>;
  is_active: boolean;
  is_primary: boolean;
}

export interface AIProviderUpdate {
  name?: string;
  provider_type?: 'vllm' | 'ollama' | 'openai';
  base_url?: string;
  api_key?: string;
  default_model?: string;
  config_json?: Record<string, any>;
  is_active?: boolean;
  is_primary?: boolean;
}

export interface LLMPromptTemplate {
  id: number;
  name: string;
  template_type: 'holland' | 'mbti' | 'combined' | 'career_path';
  prompt_template: string;
  system_prompt?: string;
  generation_params: Record<string, any>; // { temperature: 0.7, max_tokens: 2000, ... }
  is_active: boolean;
  version: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface LLMPromptTemplateCreate {
  name: string;
  template_type: 'holland' | 'mbti' | 'combined' | 'career_path';
  prompt_template: string;
  system_prompt?: string;
  generation_params?: Record<string, any>;
  is_active: boolean;
  version: number;
}

export interface LLMPromptTemplateUpdate {
  name?: string;
  template_type?: 'holland' | 'mbti' | 'combined' | 'career_path';
  prompt_template?: string;
  system_prompt?: string;
  generation_params?: Record<string, any>;
  is_active?: boolean;
}

export interface DiscoveredModel {
  id: string;
  name?: string;
  size?: number;
  modified_at?: string;
  created?: number;
}

export interface ModelDiscoveryResult {
  status: 'success' | 'error';
  provider_type?: 'vllm' | 'ollama';
  models?: DiscoveredModel[];
  message?: string;
}

export interface HealthCheckResult {
  status: 'success' | 'error';
  health?: 'healthy' | 'degraded' | 'offline' | 'timeout';
  latency_ms?: number;
  message?: string;
}

export interface GenerateAIReportRequest {
  template_id?: number; // Auto-select if omitted
  provider_id?: number; // Use primary if omitted
}

export interface GenerateAIReportResponse {
  status: 'success' | 'error' | 'fallback';
  report_id: number;
  message: string;
  generation_time_ms?: number;
}
