import type { ToolInfo } from '@/types/chat.types';

export interface ToolsFallbackCatalogItem extends ToolInfo {
  i18nKey: string;
}

/** Static placeholder tools when GET /tools route is unavailable. */
export const TOOLS_FALLBACK_CATALOG: ToolsFallbackCatalogItem[] = [
  {
    id: 'web_search',
    category: 'search',
    i18nKey: 'webSearch',
    capabilities: ['search'],
  },
  {
    id: 'code_interpreter',
    category: 'code',
    i18nKey: 'codeInterpreter',
    capabilities: ['execute'],
  },
  {
    id: 'file_read',
    category: 'file',
    i18nKey: 'fileRead',
    capabilities: ['read'],
  },
  {
    id: 'data_analysis',
    category: 'analysis',
    i18nKey: 'dataAnalysis',
    capabilities: ['analyze'],
  },
  {
    id: 'image_gen',
    category: 'image',
    i18nKey: 'imageGen',
    capabilities: ['generate'],
  },
  {
    id: 'translate',
    category: 'text',
    i18nKey: 'translate',
    capabilities: ['translate'],
  },
];
