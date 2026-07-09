// ============================================
// Case View — Analysis Results panel (live from files.tools)
// ============================================

'use client';

import { useMemo } from 'react';
import { Badge, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { CaseFile } from '@/types/case-importer.types';
import type { CaseViewDataContext } from '@/hooks/use-case-view-data';

type ToolGroup = {
  toolId: string;
  count: number;
  okCount: number;
  sampleFile?: string;
};

function groupTools(files: CaseFile[]): ToolGroup[] {
  const map = new Map<string, ToolGroup>();
  for (const f of files) {
    if (!Array.isArray(f.tools)) continue;
    for (const tr of f.tools) {
      const id = tr.tool_id || 'unknown';
      const prev = map.get(id) ?? { toolId: id, count: 0, okCount: 0 };
      prev.count += 1;
      if (tr.ok) prev.okCount += 1;
      if (!prev.sampleFile) prev.sampleFile = f.relative_path || f.artifact_id;
      map.set(id, prev);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function channelForTool(toolId: string): 'metadata' | 'rawdata' | 'embed' | 'other' {
  const id = toolId.toLowerCase();
  if (id.includes('embed') || id.includes('vector')) return 'embed';
  if (id.includes('meta') || id.includes('extract')) return 'metadata';
  if (id.includes('ocr') || id.includes('raw') || id.includes('text')) return 'rawdata';
  return 'other';
}

export default function CaseViewAnalysisPanel({ data }: { data: CaseViewDataContext }) {
  const { t } = useTranslation();
  const { detail } = data;

  const tools = useMemo(() => {
    const files = Array.isArray(detail?.files) ? detail!.files : [];
    return groupTools(files);
  }, [detail]);

  const channelLabel = (ch: ReturnType<typeof channelForTool>) => {
    switch (ch) {
      case 'metadata':
        return t('cases.view.analysis.channelMetadata');
      case 'rawdata':
        return t('cases.view.analysis.channelRawdata');
      case 'embed':
        return t('cases.view.analysis.channelEmbed');
      default:
        return t('cases.view.analysis.toolsRun');
    }
  };

  if (!detail) return null;

  if (tools.length === 0) {
    return <Text className="text-gray-500">{t('cases.view.analysis.empty')}</Text>;
  }

  const byChannel = tools.reduce<Record<string, ToolGroup[]>>((acc, tool) => {
    const ch = channelForTool(tool.toolId);
    if (!acc[ch]) acc[ch] = [];
    acc[ch].push(tool);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(byChannel).map(([channel, items]) => (
        <div key={channel}>
          <Title as="h6" className="mb-3 text-sm font-semibold">
            {channelLabel(channel as ReturnType<typeof channelForTool>)}
          </Title>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((tool) => (
              <div
                key={tool.toolId}
                className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50"
              >
                <Text className="font-mono text-sm font-medium">{tool.toolId}</Text>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="flat" size="sm">
                    {tool.count} files
                  </Badge>
                  <Badge variant="flat" color="success" size="sm">
                    {tool.okCount} ok
                  </Badge>
                </div>
                {tool.sampleFile ? (
                  <Text className="mt-2 truncate text-xs text-gray-500" title={tool.sampleFile}>
                    e.g. {tool.sampleFile}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
