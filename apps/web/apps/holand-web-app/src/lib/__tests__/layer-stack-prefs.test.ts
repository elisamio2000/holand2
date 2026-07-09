import { describe, expect, it, vi } from 'vitest';
import {
  applyLayerStackPrefs,
  buildDefaultOrder,
} from '@/lib/layer-stack-prefs';
import { LAYER_KEY } from '@/lib/map-layer-stack-contract';
import type { MapCatalogLayer } from '@/types/map-layers.types';

describe('buildDefaultOrder', () => {
  const catalog: MapCatalogLayer[] = [
    {
      id: 'g1',
      name: 'Global',
      layer_kind: 'raster_pmtiles',
      sort_order: 1,
      owner_user_id: 'other',
    },
    {
      id: 'p1',
      name: 'Personal',
      layer_kind: 'raster_pmtiles',
      sort_order: 10,
      owner_user_id: 'me',
    },
  ];

  it('orders catalog by stack role: basemap above imagery (top-first list)', () => {
    const mixed: MapCatalogLayer[] = [
      {
        id: 'sat',
        name: 'Sat Imagery',
        layer_kind: 'raster_sas_sqlite',
        sas_role: 'satellite_imagery',
        sort_order: 100,
        owner_user_id: 'other',
      },
      {
        id: 'vec',
        name: 'Vector Basemap',
        layer_kind: 'vector_pmtiles',
        sort_order: 1,
        owner_user_id: 'other',
      },
    ];
    const order = buildDefaultOrder({
      catalogLayers: mixed,
      currentUserId: 'me',
      customLayerIds: [],
      rasterLayerIds: [],
      chatLayerIds: [],
      hasStreetView: false,
      hasVectorOverlay: false,
    });
    expect(order.indexOf(LAYER_KEY.catalog('vec'))).toBeLessThan(
      order.indexOf(LAYER_KEY.catalog('sat'))
    );
  });
});

describe('applyLayerStackPrefs', () => {
  it('restores custom layer def into parent state', () => {
    const onCustomLayersChange = vi.fn();
    applyLayerStackPrefs({
      prefs: {
        version: 1,
        order: [LAYER_KEY.custom('c1')],
        layers: {
          [LAYER_KEY.custom('c1')]: {
            visible: true,
            opacity: 0.7,
            def: { type: 'geojson', name: 'Saved', url: 'https://example.com/a.geojson' },
          },
        },
      },
      mapHandle: null,
      customLayers: [],
      rasterLayers: [],
      onCustomLayersChange,
      onRasterLayersChange: vi.fn(),
      onStreetViewFoldersChange: vi.fn(),
      onShowStreetViewChange: vi.fn(),
    });
    expect(onCustomLayersChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'c1',
        name: 'Saved',
        type: 'geojson',
        url: 'https://example.com/a.geojson',
        visible: true,
        opacity: 0.7,
      }),
    ]);
  });

  it('restores raster and streetview prefs', () => {
    const onRasterLayersChange = vi.fn();
    const onStreetViewFoldersChange = vi.fn();
    const onShowStreetViewChange = vi.fn();
    applyLayerStackPrefs({
      prefs: {
        version: 1,
        order: [LAYER_KEY.raster('sat1'), LAYER_KEY.streetview],
        layers: {
          [LAYER_KEY.raster('sat1')]: {
            visible: true,
            source: 'sas-both',
            type: 'sas',
          },
          [LAYER_KEY.streetview]: {
            visible: true,
            folders: ['new3'],
          },
        },
      },
      mapHandle: null,
      customLayers: [],
      rasterLayers: [],
      onCustomLayersChange: vi.fn(),
      onRasterLayersChange,
      onStreetViewFoldersChange,
      onShowStreetViewChange,
    });
    expect(onRasterLayersChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'sat1', source: 'sas-both', type: 'sas' }),
    ]);
    expect(onStreetViewFoldersChange).toHaveBeenCalledWith(['new3']);
    expect(onShowStreetViewChange).toHaveBeenCalledWith(true);
  });
});
