// ============================================
// Geo-Location Store — Zustand global state for geo data persistence
//
// WHY: React useState is lost when the component unmounts on navigation.
// This store keeps markers, stats, and filters alive across route changes
// so that returning to the geo-location page is instant (no re-fetch).
//
// Data lifecycle:
// - Populated on first load from /api/geo/* endpoints
// - Persists across SPA navigation (Zustand lives in module scope)
// - Cleared on page refresh (browser reload = new JS runtime)
// - Stale check: data older than STALE_THRESHOLD_MS triggers background refresh
// ============================================

import { create } from 'zustand';
import {
  DEFAULT_ADVANCED_FILTER,
  type GpsFileMinimal,
  type MongoGeoStats,
  type AdvancedGeoFilter,
  type MapViewState,
} from '@/types/geo-location.types';

/**
 * How long cached data is considered "fresh" (no re-fetch needed).
 * WHY 5 min: Matches the Redis TTL for filtered marker data.
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * GeoStore state shape — only data that should persist across navigation.
 * UI-only state (selection, sidebar tab, fullscreen) stays in component.
 */
interface GeoStoreState {
  // ---- Tier 1: marker data ----
  markers: GpsFileMinimal[];
  totalRecords: number;
  isFullyLoaded: boolean;
  currentPage: number;

  // ---- Stats ----
  mongoStats: MongoGeoStats | null;

  // ---- Filters ----
  filters: AdvancedGeoFilter;

  // ---- Map view ----
  mapView: MapViewState;

  // ---- Freshness ----
  lastUpdated: number | null;
  dbConnected: boolean | null;

  // ---- Actions ----
  setMarkers: (markers: GpsFileMinimal[]) => void;
  appendMarkers: (newMarkers: GpsFileMinimal[]) => void;
  setTotalRecords: (total: number) => void;
  setIsFullyLoaded: (done: boolean) => void;
  setCurrentPage: (page: number) => void;
  setMongoStats: (stats: MongoGeoStats | null) => void;
  setFilters: (filters: AdvancedGeoFilter) => void;
  setMapView: (view: Partial<MapViewState>) => void;
  setDbConnected: (connected: boolean | null) => void;
  markFresh: () => void;

  /** Check if stored data is still fresh (within STALE_THRESHOLD_MS). */
  isFresh: () => boolean;

  /** Full reset — called when filters change or user forces refresh. */
  reset: () => void;
}

/**
 * useGeoStore — Global Zustand store for geo-location data.
 *
 * Survives component unmount during SPA navigation.
 * Does NOT survive page refresh (intentional — Redis cache handles that).
 *
 * @example
 * ```tsx
 * const markers = useGeoStore((s) => s.markers);
 * const setMarkers = useGeoStore((s) => s.setMarkers);
 * ```
 */
export const useGeoStore = create<GeoStoreState>((set, get) => ({
  // ---- Initial state ----
  markers: [],
  totalRecords: 0,
  isFullyLoaded: false,
  currentPage: 0,
  mongoStats: null,
  filters: { ...DEFAULT_ADVANCED_FILTER },
  mapView: {
    center: [51.389, 35.6892],
    zoom: 5,
    style: 'light',
    clustering: true,
    heatmap: false,
  },
  lastUpdated: null,
  dbConnected: null,

  // ---- Actions ----
  setMarkers: (markers) => set({ markers }),

  appendMarkers: (newMarkers) =>
    set((state) => {
      const existingIds = new Set(state.markers.map((m) => m.id));
      const unique = newMarkers.filter((m) => !existingIds.has(m.id));
      return { markers: [...state.markers, ...unique] };
    }),

  setTotalRecords: (total) => set({ totalRecords: total }),
  setIsFullyLoaded: (done) => set({ isFullyLoaded: done }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setMongoStats: (stats) => set({ mongoStats: stats }),
  setFilters: (filters) => set({ filters }),
  setMapView: (partial) =>
    set((state) => ({ mapView: { ...state.mapView, ...partial } })),
  setDbConnected: (connected) => set({ dbConnected: connected }),
  markFresh: () => set({ lastUpdated: Date.now() }),

  isFresh: () => {
    const { lastUpdated, markers } = get();
    if (!lastUpdated || markers.length === 0) return false;
    return Date.now() - lastUpdated < STALE_THRESHOLD_MS;
  },

  reset: () =>
    set({
      markers: [],
      totalRecords: 0,
      isFullyLoaded: false,
      currentPage: 0,
      mongoStats: null,
      lastUpdated: null,
      dbConnected: null,
    }),
}));
