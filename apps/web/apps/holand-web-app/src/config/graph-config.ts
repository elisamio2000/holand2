// ============================================
// Graph Explorer — Visual Configuration
// Entity type colors, relation type colors, community palette
// ============================================

import type {
  EntityType,
  RelationType,
  EntityConfig,
  RelationConfig,
} from '@/types/graph-explorer.types';

// ─── Community Colors ─────────────────────────────────────────────────────────

/** Color palette for community clusters (up to 8 + null fallback) */
const COMMUNITY_COLORS: Record<string | number, string> = {
  0: '#3b82f6', // blue
  1: '#f97316', // orange
  2: '#22c55e', // green
  3: '#eab308', // yellow
  4: '#a855f7', // purple
  5: '#ec4899', // pink
  6: '#ef4444', // red
  7: '#84cc16', // lime
  null: '#6b7280', // gray for null community
};

/**
 * Get the display color for a community cluster.
 *
 * @param communityId - Community ID (nullable)
 * @returns Hex color string
 */
export function getCommunityColor(communityId: number | null): string {
  if (communityId === null) return COMMUNITY_COLORS['null'];
  return (
    COMMUNITY_COLORS[communityId % Object.keys(COMMUNITY_COLORS).length] ??
    '#6b7280'
  );
}

// ─── Entity Type Config ───────────────────────────────────────────────────────

/** Visual configuration for each entity type */
export const ENTITY_TYPE_CONFIG: Record<string, EntityConfig> = {
  person: {
    color: '#60a5fa',
    bgColor: 'rgba(59,130,246,0.15)',
    icon: 'UserBold',
    label: 'Person',
  },
  organization: {
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.15)',
    icon: 'BuildingsBold',
    label: 'Organization',
  },
  location: {
    color: '#34d399',
    bgColor: 'rgba(52,211,153,0.15)',
    icon: 'MapPinBold',
    label: 'Location',
  },
  financial_entity: {
    color: '#fbbf24',
    bgColor: 'rgba(251,191,36,0.15)',
    icon: 'CurrencyDollarBold',
    label: 'Financial',
  },
  event: {
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.15)',
    icon: 'CalendarBlankBold',
    label: 'Event',
  },
  document: {
    color: '#94a3b8',
    bgColor: 'rgba(148,163,184,0.15)',
    icon: 'FileTextBold',
    label: 'Document',
  },
  product: {
    color: '#f472b6',
    bgColor: 'rgba(244,114,182,0.15)',
    icon: 'PackageBold',
    label: 'Product',
  },
  project: {
    color: '#22d3ee',
    bgColor: 'rgba(34,211,238,0.15)',
    icon: 'FolderBold',
    label: 'Project',
  },
  vehicle: {
    color: '#fb7185',
    bgColor: 'rgba(251,113,133,0.15)',
    icon: 'CarBold',
    label: 'Vehicle',
  },
  phone: {
    color: '#38bdf8',
    bgColor: 'rgba(56,189,248,0.15)',
    icon: 'PhoneBold',
    label: 'Phone',
  },
  phone_number: {
    color: '#38bdf8',
    bgColor: 'rgba(56,189,248,0.15)',
    icon: 'PhoneBold',
    label: 'Phone',
  },
  email: {
    color: '#c084fc',
    bgColor: 'rgba(192,132,252,0.15)',
    icon: 'EnvelopeSimpleBold',
    label: 'Email',
  },
  unknown: {
    color: '#6b7280',
    bgColor: 'rgba(107,114,128,0.15)',
    icon: 'QuestionBold',
    label: 'Unknown',
  },
};

/**
 * Get visual config for an entity type with fallback to 'unknown'.
 *
 * @param type - Entity type string
 * @returns EntityConfig with color, bgColor, icon, label
 */
export function getEntityConfig(type: string): EntityConfig {
  return ENTITY_TYPE_CONFIG[type] ?? ENTITY_TYPE_CONFIG.unknown;
}

// ─── Relation Type Config ─────────────────────────────────────────────────────

/** Visual configuration for each relationship type */
export const RELATION_TYPE_CONFIG: Record<string, RelationConfig> = {
  KNOWS: { color: '#60a5fa', label: 'Knows' },
  WORKS_WITH: { color: '#34d399', label: 'Works With' },
  COLLABORATES_WITH: { color: '#34d399', label: 'Collaborates' },
  WORKS_AT: { color: '#fbbf24', label: 'Works At' },
  WORKS_AT_LOCATION: { color: '#34d399', label: 'Works At' },
  FIRED: { color: '#ef4444', label: 'Fired', dashed: true },
  OWNS: { color: '#a78bfa', label: 'Owns' },
  LOCATED_AT: { color: '#34d399', label: 'Located At' },
  RELATED_TO: { color: '#94a3b8', label: 'Related To', dashed: true },
  TRANSACTION: { color: '#fbbf24', label: 'Transaction' },
  COMMUNICATED_WITH: { color: '#38bdf8', label: 'Communicated' },
  MEMBER_OF: { color: '#f97316', label: 'Member Of' },
  CONTROLS: { color: '#ec4899', label: 'Controls' },
  FOUNDER_OF: { color: '#ec4899', label: 'Founder Of' },
  MENTORS: { color: '#a78bfa', label: 'Mentors' },
  MANAGES: { color: '#f97316', label: 'Manages' },
  PRODUCES: { color: '#22d3ee', label: 'Produces' },
  HAS_CONTACT: { color: '#38bdf8', label: 'Has Contact' },
  HAS_PHONE: { color: '#38bdf8', label: 'Has Phone' },
  HAS_EMAIL: { color: '#c084fc', label: 'Has Email' },
  LEADS: { color: '#f97316', label: 'Leads' },
  LED_BY: { color: '#f97316', label: 'Led By' },
  PARTICIPATES_IN: { color: '#94a3b8', label: 'Participates' },
  INVESTED_IN: { color: '#fbbf24', label: 'Invested In' },
  RECEIVED: { color: '#34d399', label: 'Received' },
  PARTNERED_WITH: { color: '#a78bfa', label: 'Partnered' },
  PARTNERS_WITH: { color: '#a78bfa', label: 'Partners' },
  SIGNED: { color: '#94a3b8', label: 'Signed' },
  PROVIDES: { color: '#22d3ee', label: 'Provides' },
  ATTENDS: { color: '#a78bfa', label: 'Attends' },
  SPEAKS_AT: { color: '#f97316', label: 'Speaks At' },
  HOSTS: { color: '#f97316', label: 'Hosts' },
  RAISED: { color: '#fbbf24', label: 'Raised' },
  INTEGRATES_WITH: { color: '#22d3ee', label: 'Integrates' },
  INTERESTED_IN: { color: '#94a3b8', label: 'Interested', dashed: true },
  IS_FRIEND_OF: { color: '#60a5fa', label: 'Friend Of' },
  DEVELOPS: { color: '#22d3ee', label: 'Develops' },
};

/**
 * Get visual config for a relationship type with fallback.
 *
 * WHY fallback converts type to title case: backend may return
 * new relation types not yet in our config map.
 *
 * @param type - Relation type string (e.g. 'KNOWS', 'WORKS_AT')
 * @returns RelationConfig with color, label, optional dashed
 */
export function getRelationConfig(type: string): RelationConfig {
  return (
    RELATION_TYPE_CONFIG[type] ?? {
      color: '#6b7280',
      label: type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      dashed: false,
    }
  );
}

// ─── Default Settings ─────────────────────────────────────────────────────────

/** Default graph visualization settings */
export const DEFAULT_GRAPH_SETTINGS = {
  layout: 'force' as const,
  showLabels: true,
  showRelationLabels: false,
  nodeSize: 6,
  linkWidth: 1.5,
  linkDistance: 80,
  chargeStrength: -150,
  enablePhysics: true,
  physicsPreset: 'standard' as const,
  theme: 'light' as const,
  clusterByCommunity: true,
  showClusterHulls: true,
  animate: true,
  is3D: false,
};

/** Default filter state */
export const DEFAULT_GRAPH_FILTER = {
  entityTypes: [] as EntityType[],
  relationTypes: [] as RelationType[],
  communities: [] as number[],
  minStrength: 0,
  maxStrength: 1,
  searchQuery: '',
  showIsolated: true,
  highlightPath: false,
  showHiddenNodes: false,
};
