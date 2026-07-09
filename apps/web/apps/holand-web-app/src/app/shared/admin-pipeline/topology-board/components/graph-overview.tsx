'use client';

import { Badge, Button, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { EntityCatalogEntry } from '../helpers/topology-catalog';

interface Props {
  placedCount: number;
  catalogCount: number;
  edgeCount: number;
  unboundCatalog: EntityCatalogEntry[];
  unboundToolsCount?: number;
  onFixUnboundInTable?: () => void;
  onFixUnboundInGraph?: () => void;
}

export default function GraphOverview({
  placedCount,
  catalogCount,
  edgeCount,
  unboundCatalog,
  unboundToolsCount,
  onFixUnboundInTable,
  onFixUnboundInGraph,
}: Props) {
  const { t } = useTranslation();
  const unboundTools = unboundToolsCount ?? unboundCatalog.filter((e) => e.kind === 'tool').length;

  return (
    <div className="space-y-3 p-4">
      <Text className="text-sm font-semibold">
        {t('pipeline.topology.board.graphOverview', 'Topology overview')}
      </Text>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <Text className="text-gray-500">{t('pipeline.topology.board.onCanvas', 'On canvas')}</Text>
          <Badge>{placedCount}</Badge>
        </div>
        <div>
          <Text className="text-gray-500">{t('pipeline.topology.board.inCatalog', 'In catalog')}</Text>
          <Badge>{catalogCount}</Badge>
        </div>
        <div>
          <Text className="text-gray-500">{t('pipeline.topology.board.edges', 'Connections')}</Text>
          <Badge>{edgeCount}</Badge>
        </div>
        <div>
          <Text className="text-gray-500">{t('pipeline.topology.board.unboundTools', 'Unbound tools')}</Text>
          <Badge color={unboundTools ? 'warning' : 'success'}>{unboundTools}</Badge>
        </div>
      </div>

      {unboundTools > 0 && (onFixUnboundInTable || onFixUnboundInGraph) && (
        <div className="flex flex-col gap-2">
          {onFixUnboundInTable && (
            <Button size="sm" variant="outline" onClick={onFixUnboundInTable}>
              {t('pipeline.topology.board.fixInTable', 'Fix in Table')}
            </Button>
          )}
          {onFixUnboundInGraph && (
            <Button size="sm" variant="outline" onClick={onFixUnboundInGraph}>
              {t('pipeline.topology.board.fixInGraph', 'Highlight on Graph')}
            </Button>
          )}
        </div>
      )}

      <Text className="text-xs text-gray-500">
        {t(
          'pipeline.topology.board.inspectorEmpty',
          'Select a node or edge to view settings.'
        )}
      </Text>
    </div>
  );
}
