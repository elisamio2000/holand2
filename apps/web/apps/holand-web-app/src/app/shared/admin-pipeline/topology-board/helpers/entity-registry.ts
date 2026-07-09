import type { TopologyEntityKind } from './topology-board-types';

export interface EntityMeta {
  kind: TopologyEntityKind;
  label: string;
  column: string;
  color: string;
  borderColor: string;
  nodeType: string;
  defaultX: number;
  canSource: boolean;
  canTarget: boolean;
  i18nKey: string;
}

export const ENTITY_REGISTRY: Record<TopologyEntityKind, EntityMeta> = {
  tool: {
    kind: 'tool',
    label: 'Tool',
    column: 'Action',
    color: 'text-blue-700',
    borderColor: 'border-blue-400',
    nodeType: 'topoTool',
    defaultX: 40,
    canSource: true,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.tool',
  },
  route: {
    kind: 'route',
    label: 'Route',
    column: 'Trigger',
    color: 'text-green-700',
    borderColor: 'border-green-400',
    nodeType: 'topoRoute',
    defaultX: 320,
    canSource: true,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.route',
  },
  role: {
    kind: 'role',
    label: 'Role',
    column: 'Trigger',
    color: 'text-green-600',
    borderColor: 'border-green-300',
    nodeType: 'topoRole',
    defaultX: 320,
    canSource: true,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.role',
  },
  model: {
    kind: 'model',
    label: 'Model',
    column: 'Condition',
    color: 'text-orange-700',
    borderColor: 'border-orange-400',
    nodeType: 'topoModel',
    defaultX: 620,
    canSource: false,
    canTarget: true,
    i18nKey: 'pipeline.topology.board.entities.model',
  },
  endpoint: {
    kind: 'endpoint',
    label: 'Endpoint',
    column: 'Host',
    color: 'text-indigo-700',
    borderColor: 'border-indigo-400',
    nodeType: 'topoEndpoint',
    defaultX: 900,
    canSource: true,
    canTarget: true,
    i18nKey: 'pipeline.topology.board.entities.endpoint',
  },
  remoteNode: {
    kind: 'remoteNode',
    label: 'Node',
    column: 'Deploy',
    color: 'text-cyan-700',
    borderColor: 'border-cyan-400',
    nodeType: 'topoRemoteNode',
    defaultX: 900,
    canSource: true,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.remoteNode',
  },
  plugin: {
    kind: 'plugin',
    label: 'Plugin',
    column: 'Action',
    color: 'text-sky-700',
    borderColor: 'border-sky-400',
    nodeType: 'topoPlugin',
    defaultX: 40,
    canSource: true,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.plugin',
  },
  service: {
    kind: 'service',
    label: 'Service',
    column: 'Service',
    color: 'text-gray-700',
    borderColor: 'border-gray-400',
    nodeType: 'topoService',
    defaultX: 180,
    canSource: true,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.service',
  },
  group: {
    kind: 'group',
    label: 'Group',
    column: 'Cluster',
    color: 'text-purple-700',
    borderColor: 'border-purple-400',
    nodeType: 'topoGroup',
    defaultX: 0,
    canSource: false,
    canTarget: false,
    i18nKey: 'pipeline.topology.board.entities.group',
  },
};

export const PALETTE_CATEGORIES: Array<{
  id: string;
  labelKey: string;
  kinds: TopologyEntityKind[];
}> = [
  { id: 'actions', labelKey: 'pipeline.topology.board.categories.actions', kinds: ['tool', 'plugin', 'service'] },
  { id: 'triggers', labelKey: 'pipeline.topology.board.categories.triggers', kinds: ['route', 'role'] },
  { id: 'conditions', labelKey: 'pipeline.topology.board.categories.conditions', kinds: ['model'] },
  { id: 'infra', labelKey: 'pipeline.topology.board.categories.infra', kinds: ['endpoint', 'remoteNode'] },
];
