// ============================================
// Graph Test Data Generator
// Generates synthetic graph data at various scales for Big Data testing
// ============================================

import type {
  GraphData,
  GraphNode,
  GraphLink,
  EntityType,
  Community,
  CommunityReport,
} from '@/types/graph-explorer.types';
import { getCommunityColor } from '@/config/graph-config';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES: EntityType[] = [
  'person', 'organization', 'location', 'financial_entity',
  'event', 'document', 'phone_number', 'email', 'product', 'project',
];

const ENTITY_TYPE_WEIGHTS: Record<EntityType, number> = {
  person: 40, organization: 15, location: 10, financial_entity: 5,
  event: 5, document: 8, phone_number: 5, email: 5, product: 4, project: 3,
  vehicle: 0, phone: 0, unknown: 0,
};

const RELATION_TYPES = [
  'KNOWS', 'WORKS_WITH', 'WORKS_AT', 'OWNS', 'LOCATED_AT',
  'RELATED_TO', 'TRANSACTION', 'COMMUNICATED_WITH', 'MEMBER_OF',
  'CONTROLS', 'FOUNDER_OF', 'MENTORS', 'MANAGES', 'PRODUCES',
  'HAS_CONTACT', 'HAS_PHONE', 'HAS_EMAIL', 'IS_FRIEND_OF',
  'IS_FATHER_OF', 'IS_PARENT_OF', 'ATTENDS', 'WORKS_UNDER',
];

const FIRST_NAMES = [
  'Ali', 'Sara', 'Reza', 'Mina', 'Amir', 'Zahra', 'Hossein', 'Fateme',
  'Mohammad', 'Leila', 'Ahmad', 'Narges', 'Mehdi', 'Parisa', 'Javad',
  'John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'James', 'Ashley',
  'Robert', 'Jennifer', 'William', 'Amanda', 'Richard', 'Stephanie', 'Thomas',
];

const LAST_NAMES = [
  'Ahmadi', 'Hosseini', 'Mohammadi', 'Rezaei', 'Karimi', 'Hashemi',
  'Mousavi', 'Moradi', 'Jafari', 'Ghasemi', 'Rahimi', 'Kazemi',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson',
];

const ORG_NAMES = [
  'TechCorp', 'DataFlow', 'CloudNet', 'SecureVault', 'FinBridge',
  'GreenEnergy', 'SmartCity', 'HealthPlus', 'EduTech', 'TransLogix',
  'CyberShield', 'AgriTech', 'MediaWave', 'RetailMax', 'BuildPro',
];

const CITIES = [
  'Tehran', 'Isfahan', 'Shiraz', 'Tabriz', 'Mashhad', 'Haifa',
  'New York', 'London', 'Berlin', 'Tokyo', 'Dubai', 'Istanbul',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seeded pseudo-random number generator for reproducible tests */
function createRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function weightedPick(rng: () => number): EntityType {
  const entries = Object.entries(ENTITY_TYPE_WEIGHTS).filter(([, w]) => w > 0) as [EntityType, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [type, weight] of entries) {
    r -= weight;
    if (r <= 0) return type;
  }
  return 'person';
}

function generateName(type: EntityType, index: number, rng: () => number): string {
  switch (type) {
    case 'person':
      return `${pickRandom(FIRST_NAMES, rng)} ${pickRandom(LAST_NAMES, rng)}`;
    case 'organization':
      return `${pickRandom(ORG_NAMES, rng)} ${index < 100 ? 'Inc' : 'LLC'}`;
    case 'location':
      return `${pickRandom(CITIES, rng)} District ${Math.floor(rng() * 20) + 1}`;
    case 'financial_entity':
      return `Account-${String(index).padStart(6, '0')}`;
    case 'event':
      return `Event-${String(index).padStart(4, '0')}`;
    case 'document':
      return `Doc-${String(index).padStart(5, '0')}`;
    case 'phone_number':
      return `+98${String(Math.floor(rng() * 9000000000) + 1000000000)}`;
    case 'email':
      return `user${index}@${pickRandom(['gmail.com', 'yahoo.com', 'company.ir'], rng)}`;
    case 'product':
      return `Product-${String(index).padStart(4, '0')}`;
    case 'project':
      return `Project-${pickRandom(['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'], rng)}-${index}`;
    default:
      return `Entity-${index}`;
  }
}

// ─── Generator ────────────────────────────────────────────────────────────────

export interface GenerateGraphOptions {
  /** Total number of nodes to generate */
  nodeCount: number;
  /** Average edges per node (actual count = nodeCount * edgesPerNode / 2) */
  edgesPerNode?: number;
  /** Number of communities to create */
  communityCount?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Case ID to assign to all entities */
  caseId?: string;
}

/**
 * Generate synthetic graph data for Big Data testing.
 *
 * Creates realistic knowledge graph with configurable scale:
 * - Nodes grouped into communities with intra/inter-community edges
 * - Edge strength varies by relationship type
 * - Entities have descriptions, properties, and metrics
 *
 * @param options - Generation parameters
 * @returns Complete GraphData ready for visualization
 *
 * @example
 * ```ts
 * const graph = generateTestGraph({ nodeCount: 5000, edgesPerNode: 3 });
 * // → 5000 nodes, ~7500 edges, 10 communities
 * ```
 */
export function generateTestGraph(options: GenerateGraphOptions): GraphData {
  const {
    nodeCount,
    edgesPerNode = 3,
    communityCount = Math.max(2, Math.min(15, Math.ceil(nodeCount / 200))),
    seed = 42,
    caseId = 'cas_test_generated',
  } = options;

  console.info('[GenerateTestGraph] Starting generation:', {
    nodeCount,
    edgesPerNode,
    communityCount,
    seed,
  });

  const rng = createRNG(seed);
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const communities: Community[] = [];
  const communityMembers = new Map<number, string[]>();

  // ─── Create communities ────────────────────────────────────────────────

  for (let c = 0; c < communityCount; c++) {
    communityMembers.set(c, []);
    communities.push({
      community_id: c,
      level: 0,
      size: 0,
      title: `Community ${c + 1}`,
      description: `Auto-generated community #${c + 1} for testing`,
      entity_names: [],
      entity_ids: [],
    });
  }

  // ─── Create nodes ──────────────────────────────────────────────────────

  for (let i = 0; i < nodeCount; i++) {
    const type = weightedPick(rng);
    const communityId = Math.floor(rng() * communityCount);
    const name = generateName(type, i, rng);
    const id = `ent_${String(i).padStart(6, '0')}`;

    const node: GraphNode = {
      id,
      label: name,
      type,
      description: `${name} — ${type} entity in community ${communityId}`,
      community_id: communityId,
      case_id: caseId,
      artifact_id: `artifact_${String(Math.floor(rng() * 100)).padStart(3, '0')}`,
      origin: `/data/test/generated_${caseId}.json`,
      properties: {
        importance: Math.floor(rng() * 10) + 1,
        trust_score: Math.floor(rng() * 100),
      },
      tags: [type, `community_${communityId}`],
      status: rng() > 0.05 ? 'active' : 'inactive',
      communityColor: getCommunityColor(communityId),
      connectionCount: 0,
      hidden: false,
      pinned: false,
      locked: false,
      expanded: true,
    };

    nodes.push(node);
    communityMembers.get(communityId)!.push(id);
    communities[communityId].size++;
    communities[communityId].entity_ids!.push(id);
    communities[communityId].entity_names!.push(name);
  }

  // ─── Create edges ──────────────────────────────────────────────────────

  const targetEdgeCount = Math.floor((nodeCount * edgesPerNode) / 2);
  const existingEdges = new Set<string>();
  let edgeIndex = 0;

  // WHY 70/30 split: realistic graphs have more intra-community than inter-community edges
  const intraCommunityEdges = Math.floor(targetEdgeCount * 0.7);
  const interCommunityEdges = targetEdgeCount - intraCommunityEdges;

  // Intra-community edges (within same community)
  for (let e = 0; e < intraCommunityEdges; e++) {
    const communityId = Math.floor(rng() * communityCount);
    const members = communityMembers.get(communityId)!;
    if (members.length < 2) continue;

    const srcIdx = Math.floor(rng() * members.length);
    let tgtIdx = Math.floor(rng() * members.length);
    if (srcIdx === tgtIdx) tgtIdx = (tgtIdx + 1) % members.length;

    const src = members[srcIdx];
    const tgt = members[tgtIdx];
    const edgeKey = src < tgt ? `${src}-${tgt}` : `${tgt}-${src}`;
    if (existingEdges.has(edgeKey)) continue;
    existingEdges.add(edgeKey);

    const relation = pickRandom(RELATION_TYPES, rng);
    links.push({
      id: `link_${String(edgeIndex++).padStart(6, '0')}`,
      source: src,
      target: tgt,
      relation,
      description: `${relation} relationship`,
      strength: Math.floor(rng() * 8) + 3,
      case_id: caseId,
      artifact_id: `artifact_000`,
      origin: `/data/test/generated.json`,
      selected: false,
      highlighted: false,
      hidden: false,
    });
  }

  // Inter-community edges (between different communities)
  for (let e = 0; e < interCommunityEdges; e++) {
    const c1 = Math.floor(rng() * communityCount);
    let c2 = Math.floor(rng() * communityCount);
    if (c1 === c2) c2 = (c2 + 1) % communityCount;

    const members1 = communityMembers.get(c1)!;
    const members2 = communityMembers.get(c2)!;
    if (members1.length === 0 || members2.length === 0) continue;

    const src = pickRandom(members1, rng);
    const tgt = pickRandom(members2, rng);
    const edgeKey = src < tgt ? `${src}-${tgt}` : `${tgt}-${src}`;
    if (existingEdges.has(edgeKey)) continue;
    existingEdges.add(edgeKey);

    const relation = pickRandom(RELATION_TYPES, rng);
    links.push({
      id: `link_${String(edgeIndex++).padStart(6, '0')}`,
      source: src,
      target: tgt,
      relation,
      description: `Cross-community ${relation}`,
      strength: Math.floor(rng() * 5) + 1,
      case_id: caseId,
      artifact_id: `artifact_000`,
      origin: `/data/test/generated.json`,
      selected: false,
      highlighted: false,
      hidden: false,
    });
  }

  // Update connection counts
  links.forEach((link) => {
    const srcNode = nodes.find((n) => n.id === link.source);
    const tgtNode = nodes.find((n) => n.id === link.target);
    if (srcNode) srcNode.connectionCount = (srcNode.connectionCount ?? 0) + 1;
    if (tgtNode) tgtNode.connectionCount = (tgtNode.connectionCount ?? 0) + 1;
  });

  // ─── Create community reports ──────────────────────────────────────────

  const reports: CommunityReport[] = communities.map((c) => ({
    community_id: c.community_id,
    title: c.title ?? `Community ${c.community_id}`,
    summary: `Community with ${c.size} members and diverse entity types.`,
    rating: Math.floor(rng() * 4) + 6,
    rating_explanation: 'Auto-generated rating for test data',
    findings: [
      { summary: `Contains ${c.size} entities`, explanation: 'Size metric' },
    ],
  }));

  console.info('[GenerateTestGraph] Generation complete:', {
    nodes: nodes.length,
    links: links.length,
    communities: communities.length,
  });

  return {
    nodes,
    links,
    communities,
    community_reports: reports,
    stats: {
      entity_count: nodes.length,
      relationship_count: links.length,
      community_count: communities.length,
      report_count: reports.length,
    },
  };
}
