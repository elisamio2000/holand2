'use client';

import { Badge, Button, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { TopologyNode } from '../helpers/topology-board-types';

interface Props {
  nodes: TopologyNode[];
  onClear: () => void;
  onGroup?: () => void;
}

export default function MultiSelectSummary({ nodes, onClear, onGroup }: Props) {
  const { t } = useTranslation();
  const byKind = nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.data.kind] = (acc[n.data.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3 p-4">
      <Text className="text-sm font-semibold">
        {t('pipeline.topology.board.multiSelect', '{{count}} items selected', {
          count: nodes.length,
        })}
      </Text>
      <div className="flex flex-wrap gap-1">
        {Object.entries(byKind).map(([kind, count]) => (
          <Badge key={kind} variant="outline" size="sm">
            {count} {kind}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {onGroup && nodes.length >= 2 && (
          <Button size="sm" variant="outline" onClick={onGroup}>
            {t('pipeline.topology.board.context.group', 'Group selection')}
          </Button>
        )}
        <Button size="sm" variant="text" onClick={onClear}>
          {t('common.clear', 'Clear')}
        </Button>
      </div>
    </div>
  );
}
