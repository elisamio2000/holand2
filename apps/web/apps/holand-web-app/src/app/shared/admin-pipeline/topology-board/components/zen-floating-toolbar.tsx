'use client';

import { Button } from 'rizzui';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { PiArrowsOutBold, PiCornersOutBold, PiFloppyDiskBold } from 'react-icons/pi';

interface ZenFloatingToolbarProps {
  onSave?: () => void;
  onToggleZen: () => void;
  onToggleFullscreen: () => void;
}

export default function ZenFloatingToolbar({
  onSave,
  onToggleZen,
  onToggleFullscreen,
}: ZenFloatingToolbarProps) {
  const { t } = useTranslation();
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-wrap gap-1 rounded-lg border border-muted bg-white/90 p-1 shadow-lg backdrop-blur dark:bg-gray-900/90">
      <Button size="sm" variant="outline" onClick={() => zoomIn()}>
        +
      </Button>
      <Button size="sm" variant="outline" onClick={() => zoomOut()}>
        −
      </Button>
      <Button size="sm" variant="outline" onClick={() => fitView({ padding: 0.2 })}>
        {t('pipeline.topology.board.fit', 'Fit')}
      </Button>
      {onSave && (
        <Button size="sm" variant="outline" onClick={onSave}>
          <PiFloppyDiskBold className="h-4 w-4" />
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onToggleFullscreen}>
        <PiArrowsOutBold className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="solid" onClick={onToggleZen}>
        <PiCornersOutBold className="h-4 w-4" />
      </Button>
    </div>
  );
}
