// ============================================
// Graph Explorer — TypeScript Type Definitions
// Types for Knowledge Graph visualization and analysis
// Migrated from data.graph plugin v0.1.0
// ============================================

// ─── Entity Types ────────────────────────────────────────────────────────────

/** Supported entity types in the knowledge graph */
export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'financial_entity'
  | 'event'
  | 'document'
  | 'vehicle'
  | 'phone'
  | 'phone_number'
  | 'email'
  | 'product'
  | 'project'
  | 'unknown';

/** Supported relationship types between entities */
export type RelationType =
  | 'KNOWS'
  | 'WORKS_WITH'
  | 'WORKS_AT'
  | 'FIRED'
  | 'OWNS'
  | 'LOCATED_AT'
  | 'RELATED_TO'
  | 'TRANSACTION'
  | 'COMMUNICATED_WITH'
  | 'MEMBER_OF'
  | 'CONTROLS'
  | 'FOUNDER_OF'
  | 'MENTORS'
  | 'MANAGES'
  | 'PRODUCES'
  | 'HAS_CONTACT'
  | 'HAS_PHONE'
  | 'HAS_EMAIL'
  | 'LEADS'
  | 'LED_BY'
  | 'PARTICIPATES_IN'
  | 'INVESTED_IN'
  | 'RECEIVED'
  | 'PARTNERED_WITH'
  | 'PARTNERS_WITH'
  | 'SIGNED'
  | 'PROVIDES'
  | 'ATTENDS'
  | 'SPEAKS_AT'
  | 'HOSTS'
  | 'RAISED'
  | 'INTEGRATES_WITH'
  | 'INTERESTED_IN'
  | 'COLLABORATES_WITH'
  | 'WORKS_AT_LOCATION'
  | 'DEVELOPS'
  | 'IS_FRIEND_OF'
  | string;

// ─── Raw API Shapes (matching backend output) ────────────────────────────────

/**
 * Raw entity from backend / plugin canvas payload.
 */
export interface RawEntity {
  id?: string;
  name: string;
  type: EntityType;
  description: string | null;
  /**
   * Cluster id for hulls / colors. Populated from backend `communityId` first (see
   * `readCanonicalClusterId` in graph-payload-normalize), then fallbacks, then `IN_COMMUNITY` → `Community`.
   */
  community_id: number | null;
  case_id: string;
  artifact_id: string;
  origin: string;
  properties?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  timestamps?: Record<string, string>;
  tags?: string[];
  status?: string;
  visibility?: string;
}

/**
 * Raw relationship from backend / plugin canvas payload.
 */
export interface RawRelationship {
  id?: string;
  source: string;
  source_name?: string;
  target: string;
  target_name?: string;
  relation: RelationType;
  description: string | null;
  strength: number;
  weight?: number;
  confidence?: number;
  case_id: string;
  artifact_id: string;
  origin: string;
  properties?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  timestamps?: Record<string, string>;
  tags?: string[];
  status?: string;
  bidirectional?: boolean;
  visibility?: string;
}

/** Community cluster detected in the graph */
export interface Community {
  community_id: number | null;
  level: number;
  size: number;
  title?: string;
  description?: string;
  entity_names: string[];
  entity_ids?: string[];
  density?: number;
  cohesion?: number;
  centrality?: number;
  growth_rate?: number;
  health_score?: number;
}

/** Single finding within a community report */
export interface CommunityFinding {
  summary: string;
  explanation: string;
}

/**
 * AI-generated report for a community cluster (from graph payload or local synthesis).
 */
export interface CommunityReport {
  community_id: number | null;
  title: string;
  summary: string;
  rating: number;
  rating_explanation: string;
  findings: CommunityFinding[];
  level?: number;
  size?: number;
  entity_names?: string[];
}

/** Graph-level statistics from backend */
export interface GraphStats {
  entity_count: number;
  relationship_count: number;
  community_count: number;
  report_count: number;
  person_count?: number;
  organization_count?: number;
  product_count?: number;
  project_count?: number;
  location_count?: number;
  financial_entity_count?: number;
  document_count?: number;
  event_count?: number;
  contact_count?: number;
  active_entities?: number;
  inactive_entities?: number;
  verified_entities?: number;
  unverified_entities?: number;
  high_strength_relationships?: number;
  medium_strength_relationships?: number;
  low_strength_relationships?: number;
  bidirectional_relationships?: number;
  unidirectional_relationships?: number;
}

/** Metadata about the entity extraction process */
export interface ExtractionMeta {
  input_length: number;
  num_chunks: number;
  entity_types_used: string[];
  relationship_types_used?: string[];
  max_gleanings: number;
  model: string;
  language: string;
  input_type: string;
  classification_source: string;
  classification_reasoning: string;
  elapsed_ms: number;
  data_quality_score?: number;
  completeness_score?: number;
  consistency_score?: number;
  extraction_confidence?: number;
}

/**
 * Complete raw graph data (plugin canvas or local import).
 */
export interface RawGraphData {
  entities: RawEntity[];
  relationships: RawRelationship[];
  stats: GraphStats;
  extraction_meta: ExtractionMeta;
  communities: Community[];
  community_reports: CommunityReport[];
}

// ─── Graph Render Nodes & Links ───────────────────────────────────────────────

/** Graph node for rendering — entity with D3 simulation fields + UI state */
export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  description: string;
  community_id: number | null;
  case_id: string;
  artifact_id: string;
  origin: string;
  /** Extended properties from raw data */
  properties?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  timestamps?: Record<string, string>;
  tags?: string[];
  status?: string;
  visibility?: string;
  /** D3 simulation fields (added at runtime) */
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  /** UI state */
  selected?: boolean;
  highlighted?: boolean;
  pinned?: boolean;
  hidden?: boolean;
  locked?: boolean;
  expanded?: boolean;
  /** Computed */
  connectionCount?: number;
  communityColor?: string;
  /** Clustering */
  clusterX?: number;
  clusterY?: number;
}

/** Graph link for rendering — relationship with D3 fields + UI state */
export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relation: RelationType;
  description: string;
  strength: number;
  weight?: number;
  confidence?: number;
  case_id: string;
  artifact_id: string;
  origin: string;
  /** Extended properties from raw data */
  properties?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  timestamps?: Record<string, string>;
  tags?: string[];
  status?: string;
  bidirectional?: boolean;
  visibility?: string;
  /** UI state */
  selected?: boolean;
  highlighted?: boolean;
  hidden?: boolean;
}

/** Complete graph data for rendering */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  communities: Community[];
  community_reports: CommunityReport[];
  stats: GraphStats;
  extraction_meta?: ExtractionMeta;
}

// ─── Filter & Search State ────────────────────────────────────────────────────

/** Active filter state for graph visualization */
export interface GraphFilter {
  entityTypes: EntityType[];
  relationTypes: RelationType[];
  communities: number[];
  minStrength: number;
  maxStrength: number;
  searchQuery: string;
  showIsolated: boolean;
  highlightPath: boolean;
  showHiddenNodes?: boolean;
}

/**
 * Force simulation intensity when {@link GraphSettings.enablePhysics} is on.
 * - gentle: higher damping, weaker repulsion, light centering — best for manual edits
 * - standard: default behaviour
 * - energetic: longer / stronger motion for exploration
 */
export type PhysicsPreset = 'gentle' | 'standard' | 'energetic';

/** Available layout algorithms */
export type LayoutAlgorithm =
  | 'force'
  | 'hierarchical'
  | 'hierarchical-horizontal'
  | 'circular'
  | 'grid'
  | 'radial'
  | 'tree'
  | 'tree-horizontal'
  | 'cluster'
  | 'concentric'
  | 'dagre';

/** Graph rendering settings */
export interface GraphSettings {
  layout: LayoutAlgorithm;
  showLabels: boolean;
  showRelationLabels: boolean;
  nodeSize: number;
  linkWidth: number;
  linkDistance: number;
  chargeStrength: number;
  enablePhysics: boolean;
  /** Used only when enablePhysics is true; scales forces, damping, and post-drag reheat. */
  physicsPreset: PhysicsPreset;
  theme: 'dark' | 'light';
  clusterByCommunity: boolean;
  showClusterHulls: boolean;
  animate: boolean;
  is3D?: boolean;
}

// ─── Inspector Panel ──────────────────────────────────────────────────────────

/** Target for the inspector panel sidebar */
export type InspectorTarget =
  | { kind: 'node'; item: GraphNode }
  | { kind: 'link'; item: GraphLink }
  /** When opened from a node (e.g. “full cluster”), `fromNodeId` enables back to that node in the inspector. */
  | { kind: 'community'; item: CommunityReport; fromNodeId?: string }
  | null;

// ─── Context Menu ─────────────────────────────────────────────────────────────

/** Target for right-click context menu */
export type ContextMenuTarget =
  | { kind: 'node'; item: GraphNode }
  | { kind: 'link'; item: GraphLink }
  | { kind: 'canvas' }
  | null;

/** State of the right-click context menu */
export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: ContextMenuTarget;
}

// ─── Node & Link Actions ──────────────────────────────────────────────────────

/** Available actions for graph nodes */
export type NodeAction =
  | 'focus'
  | 'expand'
  | 'collapse'
  | 'hide'
  | 'show'
  | 'pin'
  | 'unpin'
  | 'lock'
  | 'unlock'
  | 'select'
  | 'deselect'
  | 'highlight'
  | 'unhighlight'
  | 'copy_id'
  | 'copy_label'
  | 'delete'
  | 'edit'
  | 'find_path'
  | 'show_neighbors'
  | 'hide_neighbors'
  | 'select_cluster'
  | 'inspect_cluster'
  | 'collapse_cluster'
  | 'expand_cluster'
  | 'hide_unselected'
  | 'hide_unconnected';

/** Available actions for graph links */
export type LinkAction =
  | 'focus'
  | 'hide'
  | 'show'
  | 'select'
  | 'deselect'
  | 'highlight'
  | 'unhighlight'
  | 'copy_id'
  | 'copy_label'
  | 'delete'
  | 'edit'
  | 'reverse'
  | 'strengthen'
  | 'weaken'
  | 'goto_source'
  | 'goto_target';

// ─── History & Timeline ──────────────────────────────────────────────────────

/** Snapshot entry for undo/redo history */
export interface GraphHistoryEntry {
  id: string;
  timestamp: Date;
  label: string;
  snapshot: { nodes: string[]; links: string[] };
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

/** Legacy / generic path representation (nodes + links on path) */
export interface PathResult {
  nodes: GraphNode[];
  links: GraphLink[];
  length: number;
}

/** Optional constraints for pathfinding traversals */
export interface PathConstraints {
  allowedRelations?: string[];
  allowedNodeTypes?: string[];
  blockedNodes?: string[];
  blockedNodeTypes?: string[];
  requireAllProperty?: Array<{ key: string; value?: string }>;
  requireAnyProperty?: Array<{ key: string; value?: string }>;
}

/** One step on a computed path (edge metadata) */
export interface PathfindingEdgeStep {
  source: string;
  target: string;
  relation: string;
  strength: number;
}

/** Output of shortest / strongest / k-shortest path algorithms */
export interface PathfindingComputation {
  path: string[];
  totalWeight: number;
  hops: number;
  edges: PathfindingEdgeStep[];
  found: boolean;
}

/** Centrality scores for a node */
export interface CentralityScore {
  nodeId: string;
  degree: number;
  betweenness: number;
  closeness: number;
}

// ─── Large Data Handling ──────────────────────────────────────────────────────

/** Configuration for virtual viewport big data rendering */
export interface VirtualizationConfig {
  enabled: boolean;
  nodeLimit: number;
  linkLimit: number;
  lodLevels: number;
  cullingEnabled: boolean;
  clusterThreshold: number;
}

/** Real-time rendering performance stats */
export interface RenderStats {
  fps: number;
  nodeCount: number;
  linkCount: number;
  visibleNodes: number;
  visibleLinks: number;
  renderTime: number;
}

// ─── Config Types ─────────────────────────────────────────────────────────────

/** Visual configuration for an entity type */
export interface EntityConfig {
  /** Display label */
  label: string;
  /** Primary color (hex) */
  color: string;
  /** Background color with opacity (rgba) */
  bgColor: string;
  /** Phosphor icon name suffix (e.g. 'UserBold' → PiUserBold) */
  icon: string;
}

/** Visual configuration for a relationship type */
export interface RelationConfig {
  /** Display label */
  label: string;
  /** Line color (hex) */
  color: string;
  /** Whether to render as dashed line */
  dashed?: boolean;
}

/** Row from plugin_graph_explorer_cases */
export interface GraphCaseListItem {
  case_id: string;
  node_count: number;
}

/** Row from plugin_graph_explorer_artifacts */
export interface GraphArtifactListItem {
  artifact_id: string;
  node_count: number;
  label?: string;
}

/** plugin_graph_explorer_overview payload (subset) */
export interface GraphExplorerOverview {
  health?: Record<string, unknown>;
  schema?: { labels?: string[]; relationship_types?: string[] };
  graphrag_ready?: boolean;
}

/** plugin_graph_explorer_schema payload (subset) */
export interface GraphExplorerSchema {
  labels?: string[];
  relationship_types?: string[];
  property_keys?: string[];
  graphrag_ready?: boolean;
}
