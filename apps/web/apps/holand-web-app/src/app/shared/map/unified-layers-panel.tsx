// ============================================
// UnifiedLayersPanel — one flat list for every map layer source.
// Add layer via AddLayerWizard (personal / shared / remote).
// ============================================
'use client';

import type { PmtilesStyleUrls } from '@/lib/map-storage-url';

import { useState, useEffect } from 'react';
import { Popover, Text, Badge } from 'rizzui';
import { SortableList } from '@core/components/dnd/dnd-sortable-list';
import { verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  PiPlusBold,
  PiDotsThreeOutlineVerticalFill,
  PiDotsSixVerticalBold,
  PiTrashBold,
  PiGlobeBold,
  PiMapPinLineBold,
  PiStackBold,
  PiX,
} from 'react-icons/pi';
import cn from '@/lib/cn';
import type { MapCoreRef, CustomLayerConfig } from '@/app/shared/map';
import type { RasterLayer } from '@/app/shared/map/raster-layers-panel';
import LayerVisibilityPill from '@/app/shared/map/layer-visibility-pill';
import LayerScopeDot from '@/app/shared/map/layer-scope-dot';
import AddLayerWizard from '@/app/shared/map/add-layer-wizard';
import { usePermissions } from '@/hooks/use-permissions';
import { useUnifiedLayers, type LayerStackControls } from '@/hooks/use-unified-layers';
import { MAP_LAYERS_IMPORT_SHARED } from '@/services/geo-location.service';
import type { UnifiedLayerItem, UnifiedLayerSource } from '@/app/shared/map/unified-layers.types';

interface UnifiedLayersPanelProps {
  mapHandle: MapCoreRef | null;
  customLayers: CustomLayerConfig[];
  onCustomLayersChange: (layers: CustomLayerConfig[]) => void;
  rasterLayers: RasterLayer[];
  onRasterLayersChange: (layers: RasterLayer[]) => void;
  vectorOverlay: boolean;
  onVectorOverlayChange: (visible: boolean) => void;
  /** @deprecated Unused — panel visibility is catalogVisibleIds. */
  baseMapVisible?: boolean;
  /** @deprecated Unused */
  onBaseMapToggle?: (visible: boolean) => void;
  streetViewFolders: string[];
  onStreetViewFoldersChange: (folders: string[] | ((prev: string[]) => string[])) => void;
  streetViewLayerIds: string[];
  onStreetViewLayerIdsChange: (ids: string[] | ((prev: string[]) => string[])) => void;
  showStreetView: boolean;
  onShowStreetViewChange: (visible: boolean) => void;
  onPmtilesStyleChanged?: (urls: PmtilesStyleUrls | null) => void;
  /** @deprecated use onPmtilesStyleChanged */
  onBasemapChanged?: (urls: PmtilesStyleUrls) => void;
  onStackControlsReady?: (controls: LayerStackControls) => void;
  className?: string;
}

const SOURCE_ICON: Record<UnifiedLayerSource, React.ReactNode> = {
  basemap: <PiMapPinLineBold className="h-3.5 w-3.5" />,
  'vector-overlay': <PiStackBold className="h-3.5 w-3.5" />,
  satellite: <PiGlobeBold className="h-3.5 w-3.5" />,
  catalog: <PiStackBold className="h-3.5 w-3.5" />,
  'catalog-basemap': <PiMapPinLineBold className="h-3.5 w-3.5" />,
  custom: <PiStackBold className="h-3.5 w-3.5" />,
  streetview: <PiMapPinLineBold className="h-3.5 w-3.5" />,
  chat: <PiStackBold className="h-3.5 w-3.5" />,
};

export default function UnifiedLayersPanel(props: UnifiedLayersPanelProps) {
  const { className, mapHandle, customLayers, onCustomLayersChange } = props;
  const { hasPermission } = usePermissions();
  const canImportShared = hasPermission(MAP_LAYERS_IMPORT_SHARED);
  const {
    items,
    loading,
    error,
    handleLayerAdded,
    toggle,
    setOpacity,
    remove,
    reorderDragEnd,
    stackControls,
  } = useUnifiedLayers({
    ...props,
    onPmtilesStyleChanged:
      props.onPmtilesStyleChanged ??
      ((urls) => {
        if (urls) props.onBasemapChanged?.(urls);
        else props.onBasemapChanged?.({ main: '' });
      }),
  });

  useEffect(() => {
    props.onStackControlsReady?.(stackControls);
  }, [props, stackControls]);

  const [showAdd, setShowAdd] = useState(false);
  const visibleCount = items.filter((i) => i.visible).length;

  return (
    <div className={cn('flex flex-col gap-2 p-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Text className="text-sm font-semibold text-gray-900">لایه‌ها</Text>
          <Badge size="sm" variant="flat" color="primary">
            {visibleCount}/{items.length}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            showAdd
              ? 'bg-gray-200 text-gray-700'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
        >
          {showAdd ? <PiX className="h-3.5 w-3.5" /> : <PiPlusBold className="h-3.5 w-3.5" />}
          {showAdd ? 'بستن' : 'افزودن لایه'}
        </button>
      </div>

      {showAdd && (
        <AddLayerWizard
          mapHandle={mapHandle}
          customLayers={customLayers}
          onCustomLayersChange={onCustomLayersChange}
          canImportShared={canImportShared}
          onAdded={(result) => {
            setShowAdd(false);
            void handleLayerAdded(result);
          }}
        />
      )}

      {error && <Text className="text-xs text-red-500">{error}</Text>}

      <div className="max-h-[min(460px,52vh)] overflow-auto rounded-lg border border-muted p-1">
        {loading && items.length === 0 ? (
          <Text className="px-2 py-6 text-center text-xs text-gray-400">در حال بارگذاری…</Text>
        ) : items.length === 0 ? (
          <Text className="px-2 py-6 text-center text-xs text-gray-400">
            لایه‌ای موجود نیست. با «افزودن لایه» شروع کنید.
          </Text>
        ) : (
          <ul className="flex flex-col gap-1">
            <SortableList
              items={items}
              onChange={reorderDragEnd}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableList.Item
                  key={item.id}
                  id={item.id}
                  as="li"
                  disabled={!item.canReorder}
                  className="list-none"
                >
                  <LayerRow
                    item={item}
                    onToggle={() => toggle(item)}
                    onOpacity={(v) => setOpacity(item, v)}
                    onRemove={() => remove(item)}
                  />
                </SortableList.Item>
              ))}
            </SortableList>
          </ul>
        )}
      </div>
    </div>
  );
}

function LayerRow({
  item,
  onToggle,
  onOpacity,
  onRemove,
}: {
  item: UnifiedLayerItem;
  onToggle: () => void;
  onOpacity: (value: number) => void;
  onRemove: () => void;
}) {
  const hasMenu = item.canOpacity || item.canDelete;

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 overflow-hidden rounded-md border border-muted bg-gray-50/80 py-1.5 pe-2 transition-all dark:bg-gray-100/40',
        item.canReorder ? 'ps-7 hover:ps-8' : 'ps-2'
      )}
    >
      {item.canReorder && (
        <SortableList.DragHandle
          className={cn(
            'absolute inset-y-0 start-0 flex h-full w-5 items-center justify-center text-gray-400 transition-all',
            '-translate-x-6 group-hover:translate-x-0.5 hover:text-gray-700',
            '[&>svg]:h-[18px] [&>svg]:w-[18px]'
          )}
        >
          <PiDotsSixVerticalBold />
        </SortableList.DragHandle>
      )}
      <span className="shrink-0 text-gray-400">{SOURCE_ICON[item.source]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <LayerScopeDot scope={item.scopeDot} />
          <Text className="truncate text-xs font-medium text-gray-800" title={item.name}>
            {item.name}
          </Text>
        </div>
        <Text className="text-[10px] uppercase tracking-wide text-gray-400">
          {item.kindLabel}
        </Text>
      </div>

      <LayerVisibilityPill visible={item.visible} onToggle={onToggle} />

      {hasMenu && (
        <Popover placement="bottom-end" shadow="md">
          <Popover.Trigger>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="گزینه‌ها"
            >
              <PiDotsThreeOutlineVerticalFill className="h-4 w-4" />
            </button>
          </Popover.Trigger>
          <Popover.Content className="z-[9999] w-56 p-1.5 dark:bg-gray-100">
            {({ setOpen }) => (
              <div className="flex flex-col gap-1">
                {item.canOpacity && (
                  <div className="px-1 py-1">
                    <div className="mb-1 flex items-center justify-between">
                      <Text className="text-[10px] text-gray-500">شفافیت</Text>
                      <Text className="text-[10px] font-medium text-gray-700">
                        {Math.round((item.opacity ?? 1) * 100)}%
                      </Text>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={item.opacity ?? 1}
                      onChange={(e) => onOpacity(parseFloat(e.target.value))}
                      className="h-1 w-full cursor-pointer accent-primary"
                    />
                  </div>
                )}

                {item.canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemove();
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    <PiTrashBold className="h-3.5 w-3.5" /> حذف
                  </button>
                )}
              </div>
            )}
          </Popover.Content>
        </Popover>
      )}
      {item.canDelete && !hasMenu && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          aria-label="حذف لایه"
          title="حذف"
        >
          <PiTrashBold className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
