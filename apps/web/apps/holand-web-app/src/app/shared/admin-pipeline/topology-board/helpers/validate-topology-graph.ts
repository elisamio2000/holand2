import type { TopologyEdge, TopologyNode, TopologyPipelineData } from './topology-board-types';
import { validateConnection } from './validate-connection';

export interface TopologyValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  message: string;
}

export function validateTopologyGraph(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  pipelineData: TopologyPipelineData | null
): TopologyValidationIssue[] {
  const issues: TopologyValidationIssue[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  edges.forEach((e) => {
    if (!nodeIds.has(e.source)) {
      issues.push({
        id: `edge-missing-source-${e.id}`,
        severity: 'error',
        message: `Edge ${e.id} missing source node`,
      });
    }
    if (!nodeIds.has(e.target)) {
      issues.push({
        id: `edge-missing-target-${e.id}`,
        severity: 'error',
        message: `Edge ${e.id} missing target node`,
      });
    }
    const sourceNode = nodes.find((n) => n.id === e.source);
    const targetNode = nodes.find((n) => n.id === e.target);
    if (sourceNode && targetNode && pipelineData) {
      const model =
        targetNode.data.kind === 'model'
          ? pipelineData.models.find((m) => m.name === targetNode.data.entityId)
          : undefined;
      const result = validateConnection(
        e.source,
        e.target,
        sourceNode.data.binding,
        model
      );
      if (!result.ok) {
        issues.push({
          id: `edge-invalid-${e.id}`,
          severity: 'warning',
          message: result.reason ?? 'Invalid connection',
        });
      }
    }
  });

  const toolsWithoutModel = nodes.filter(
    (n) => n.data.kind === 'tool' && n.data.binding && !n.data.binding.model
  );
  toolsWithoutModel.forEach((n) => {
    issues.push({
      id: `tool-unbound-${n.id}`,
      severity: 'warning',
      message: `Tool ${n.data.label} has no bound model`,
    });
  });

  return issues;
}
