import { EntitySettingsSchema, EDGE_KIND_OPTIONS } from './schema-types';


/** Static schema registry — swap to GET /admin/pipeline/entity-schemas when backend ready. */
export const PIPELINE_ENTITY_SCHEMAS: Record<string, EntitySettingsSchema> = {
  tool: {
    kind: 'tool',
    primaryFields: ['model', 'api'],
    sections: [
      {
        id: 'binding',
        label: 'Binding',
        labelKey: 'pipeline.tools.bindingPanel',
        fields: [
          { key: 'model', type: 'model_select', label: 'Model', required: true },
          { key: 'fallback_model', type: 'model_select', label: 'Fallback' },
          {
            key: 'api',
            type: 'enum',
            label: 'API',
            options: [
              { value: 'chat', label: 'chat' },
              { value: 'embed', label: 'embed' },
              { value: 'image', label: 'image' },
            ],
          },
          { key: 'purpose', type: 'text', label: 'Purpose' },
          { key: 'pipeline_tag', type: 'text', label: 'Pipeline tag' },
          { key: 'binding_modalities', type: 'readonly_computed', label: 'Binding modalities', readOnly: true },
          { key: 'route_key', type: 'readonly_computed', label: 'Route key', readOnly: true },
        ],
      },
    ],
  },
  plugin: {
    kind: 'plugin',
    primaryFields: ['model'],
    sections: [
      {
        id: 'binding',
        label: 'Binding',
        fields: [
          { key: 'model', type: 'model_select', label: 'Model', required: true },
          { key: 'fallback_model', type: 'model_select', label: 'Fallback' },
        ],
      },
    ],
  },
  route: {
    kind: 'route',
    primaryFields: ['model_name', 'fallback_model_name'],
    sections: [
      {
        id: 'routing',
        label: 'Route',
        fields: [
          { key: 'route_key', type: 'text', label: 'route_key', readOnly: true },
          { key: 'model_name', type: 'model_select', label: 'Model', required: true },
          { key: 'fallback_model_name', type: 'model_select', label: 'Fallback' },
          { key: 'is_active', type: 'toggle', label: 'Active' },
        ],
      },
      {
        id: 'constraints',
        label: 'Constraints',
        defaultOpen: false,
        fields: [{ key: 'constraints', type: 'json', label: 'constraints' }],
      },
    ],
  },
  role: {
    kind: 'role',
    primaryFields: ['current_model'],
    sections: [
      {
        id: 'assign',
        label: 'Assignment',
        fields: [
          { key: 'route_key', type: 'readonly_computed', label: 'route_key', readOnly: true },
          { key: 'current_model', type: 'model_select', label: 'Current model', required: true },
          { key: 'fallback_model_name', type: 'model_select', label: 'Fallback model' },
          { key: 'task', type: 'readonly_computed', label: 'Task', readOnly: true },
          { key: 'modality', type: 'readonly_computed', label: 'Modality', readOnly: true },
        ],
      },
    ],
  },
  model: {
    kind: 'model',
    primaryFields: ['is_active', 'task', 'pipeline_tag'],
    sections: [
      {
        id: 'registry',
        label: 'Registry',
        fields: [
          { key: 'logical_id', type: 'readonly_computed', label: 'Logical ID', source: 'computed' },
          { key: 'name', type: 'readonly_computed', label: 'Name', readOnly: true },
          { key: 'origin', type: 'readonly_computed', label: 'Origin', source: 'computed' },
          { key: 'upstream_model', type: 'readonly_computed', label: 'Upstream', source: 'computed' },
          { key: 'task', type: 'text', label: 'Capability / task' },
          { key: 'pipeline_tag', type: 'text', label: 'Pipeline tag' },
          { key: 'is_active', type: 'toggle', label: 'Registry active' },
          { key: 'modalities', type: 'array', label: 'Modalities', itemType: 'text' },
          { key: 'pool_replica', type: 'readonly_computed', label: 'Pool replica', source: 'computed' },
          { key: 'deploy_host', type: 'readonly_computed', label: 'Deploy host', source: 'computed' },
        ],
      },
      {
        id: 'metadata',
        label: 'Metadata',
        defaultOpen: false,
        fields: [{ key: 'metadata', type: 'json', label: 'metadata' }],
      },
      {
        id: 'health',
        label: 'Health',
        defaultOpen: false,
        fields: [
          { key: 'health_status', type: 'readonly_computed', label: 'Status', source: 'computed' },
          { key: 'last_error', type: 'readonly_computed', label: 'Last error', source: 'computed' },
        ],
      },
    ],
  },
  endpoint: {
    kind: 'endpoint',
    primaryFields: ['host', 'port', 'is_active'],
    sections: [
      {
        id: 'connection',
        label: 'Connection',
        fields: [
          { key: 'name', type: 'readonly_computed', label: 'Name', readOnly: true },
          { key: 'host', type: 'text', label: 'Host' },
          { key: 'port', type: 'number', label: 'Port' },
          { key: 'scheme', type: 'enum', label: 'Scheme', options: [
            { value: 'http', label: 'http' },
            { value: 'https', label: 'https' },
          ]},
          { key: 'base_path', type: 'text', label: 'Base path' },
          { key: 'is_active', type: 'toggle', label: 'Active' },
        ],
      },
    ],
  },
  remoteNode: {
    kind: 'remoteNode',
    primaryFields: ['online'],
    sections: [
      {
        id: 'node',
        label: 'Node',
        fields: [
          { key: 'node_id', type: 'readonly_computed', label: 'Node ID', readOnly: true },
          { key: 'agent_url', type: 'readonly_computed', label: 'Agent URL', readOnly: true },
          { key: 'online', type: 'readonly_computed', label: 'Status', source: 'computed' },
          { key: 'models_deployed_count', type: 'readonly_computed', label: 'Models deployed', source: 'computed' },
        ],
      },
    ],
  },
  service: {
    kind: 'service',
    primaryFields: ['model_name', 'fallback_model_name'],
    sections: [
      {
        id: 'binding',
        label: 'Service binding',
        fields: [
          { key: 'entityId', type: 'readonly_computed', label: 'Service', readOnly: true },
          { key: 'model_name', type: 'model_select', label: 'Model' },
          { key: 'fallback_model_name', type: 'model_select', label: 'Fallback' },
          { key: 'prefer_external', type: 'toggle', label: 'Prefer external' },
          { key: 'load_balance', type: 'toggle', label: 'Load balance' },
        ],
      },
    ],
  },
  group: {
    kind: 'group',
    primaryFields: ['groupLabel'],
    sections: [
      {
        id: 'group',
        label: 'Group',
        fields: [{ key: 'groupLabel', type: 'text', label: 'Label' }],
      },
    ],
  },
  edge: {
    kind: 'edge',
    primaryFields: ['semantic_label', 'edgeKind'],
    sections: [
      {
        id: 'connection',
        label: 'Connection',
        fields: [
          { key: 'semantic_label', type: 'readonly_computed', label: 'Semantic', readOnly: true },
          { key: 'source', type: 'readonly_computed', label: 'From', readOnly: true },
          { key: 'target', type: 'readonly_computed', label: 'To', readOnly: true },
          { key: 'edgeKind', type: 'enum', label: 'Kind', options: EDGE_KIND_OPTIONS },
          { key: 'active', type: 'toggle', label: 'Active' },
        ],
      },
    ],
  },
};
