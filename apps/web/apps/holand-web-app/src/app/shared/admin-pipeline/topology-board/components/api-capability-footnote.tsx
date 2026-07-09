'use client';

import { useEffect, useState } from 'react';
import { Badge, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { probeApiCapabilities, type ApiCapability } from '../helpers/api-capabilities';

export default function ApiCapabilityFootnote() {
  const { t } = useTranslation();
  const [caps, setCaps] = useState<ApiCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    probeApiCapabilities()
      .then(setCaps)
      .catch(() => setCaps([]))
      .finally(() => setLoading(false));
  }, []);

  const gaps = caps.filter((c) => c.status === 'unavailable');

  if (loading) {
    return (
      <div className="border-t border-muted px-4 py-2 text-xs text-gray-400">
        {t('pipeline.topology.board.apiProbe', 'Checking API capabilities…')}
      </div>
    );
  }

  return (
    <div className="border-t border-muted bg-gray-50/80 px-4 py-3 dark:bg-gray-100/30">
      <Text className="text-xs font-semibold text-gray-600">
        {t('pipeline.topology.board.apiStatus', 'API status')}
      </Text>
      <div className="mt-2 flex flex-wrap gap-1">
        {caps.map((c) => (
          <Badge key={c.id} variant="flat" size="sm">
            {c.label} ({c.status})
          </Badge>
        ))}
      </div>
      {gaps.length > 0 && (
        <div className="mt-3 space-y-1 text-[11px] text-gray-500">
          <Text className="font-medium text-amber-700">
            {t('pipeline.topology.board.backendGaps', 'Backend gaps (UI continues with local layout):')}
          </Text>
          {gaps.map((g) => (
            <div key={g.id}>
              <code className="text-[10px]">{g.method} {g.path}</code>
              {g.note === 'backend_gap' && (
                <span> — {t('pipeline.topology.board.layoutGap', 'See admin-pipeline-topology-backend-gaps.md')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
