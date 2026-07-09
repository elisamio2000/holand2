'use client';

import { Badge, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useTopologyBoardStore } from '../store/topology-board-store';
import { modelHealthKind } from '@/utils/model-health';
import type { LlmModel } from '@/types/pipeline-admin.types';

export default function TopologyStatsBar() {
  const { t } = useTranslation();
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const edges = useTopologyBoardStore((s) => s.edges);
  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);

  const unhealthyEdges = edges.filter((e) => {
    const target = nodes.find((n) => n.id === e.target);
    if (target?.data.kind !== 'model') return false;
    const model = pipelineData?.models.find((m) => m.name === target.data.entityId);
    return model ? modelHealthKind(model as LlmModel) === 'unhealthy' : false;
  }).length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-muted bg-gray-50/80 px-3 py-1.5 text-xs dark:bg-gray-100/40">
      <Badge variant="flat" size="sm">
        {t('pipeline.topology.board.stats.nodes', { count: nodes.length, defaultValue: '{{count}} nodes' })}
      </Badge>
      <Badge variant="flat" size="sm">
        {t('pipeline.topology.board.stats.edges', { count: edges.length, defaultValue: '{{count}} edges' })}
      </Badge>
      {unhealthyEdges > 0 && (
        <Badge variant="flat" size="sm" color="danger">
          {t('pipeline.topology.board.stats.unhealthy', {
            count: unhealthyEdges,
            defaultValue: '{{count}} unhealthy',
          })}
        </Badge>
      )}
      <Text className="ml-auto text-[10px] text-gray-400">
        {t('pipeline.topology.board.stats.hint', '2D board is authoritative for wiring')}
      </Text>
    </div>
  );
}
