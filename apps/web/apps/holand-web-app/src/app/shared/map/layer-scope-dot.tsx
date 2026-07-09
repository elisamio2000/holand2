// Small scope indicator dot (global / personal / AI) with hover tooltip.
'use client';

import { Tooltip } from '@/components/tooltip';
import cn from '@/lib/cn';
import type { LayerScopeDot } from '@/app/shared/map/unified-layers.types';

const SCOPE_CONFIG: Record<
  LayerScopeDot,
  { label: string; className: string }
> = {
  'global-ok': {
    label: 'سراسری (در دسترس)',
    className: 'bg-emerald-500',
  },
  'global-blocked': {
    label: 'سراسری (در دسترس نیست)',
    className: 'bg-red-500',
  },
  personal: {
    label: 'شخصی',
    className: 'bg-blue-500',
  },
  ai: {
    label: 'هوش مصنوعی',
    className: 'bg-violet-500',
  },
};

export default function LayerScopeDot({ scope }: { scope: LayerScopeDot }) {
  const cfg = SCOPE_CONFIG[scope];
  return (
    <Tooltip content={cfg.label} placement="top">
      <span
        className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', cfg.className)}
        aria-label={cfg.label}
      />
    </Tooltip>
  );
}
