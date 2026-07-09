'use client';

import { useTranslation } from 'react-i18next';
import StatusDot from './status-dot';
import { HEALTH_LEGEND } from '../helpers/topology-visual-tokens';

export default function TopologyHealthLegend({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-xs text-gray-500 ${className ?? ''}`}
      role="list"
      aria-label={t('pipeline.topology.healthLegend.title', 'Health legend')}
    >
      {HEALTH_LEGEND.map((item) => (
        <span key={item.color} className="inline-flex items-center gap-1.5" role="listitem">
          <StatusDot
            color={item.color}
            size="sm"
            ariaLabel={t(item.labelKey, item.fallback)}
          />
          <span>{t(item.labelKey, item.fallback)}</span>
        </span>
      ))}
    </div>
  );
}
