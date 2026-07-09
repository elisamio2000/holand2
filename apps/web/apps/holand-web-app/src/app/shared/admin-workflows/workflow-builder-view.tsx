// ============================================
// WorkflowBuilderView — Main orchestrator (Enhanced)
// Collapsible sidebars, run panel, keyboard shortcuts
// ============================================
'use client';

import { useCallback, useState } from 'react';
import { Button, Text } from 'rizzui';
import { PiArrowLeftBold } from 'react-icons/pi';
import { ReactFlowProvider } from '@xyflow/react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useWorkflowStore } from './store/workflow-store';
import { workflowService } from '@/services/workflow.service';
import type {
  WorkflowDefinition,
  WorkflowTemplate,
} from '@/types/workflow.types';

import WorkflowGallery from './components/workflow-gallery';
import WorkflowCanvas from './components/workflow-canvas';
import WorkflowStepPalette from './components/workflow-step-palette';
import WorkflowInspector from './components/workflow-inspector';
import WorkflowToolbar from './components/workflow-toolbar';
import WorkflowRunPanel from './components/workflow-run-panel';

const LOG_TAG = '[WorkflowBuilderView]';

type ViewMode = 'gallery' | 'editor';

/**
 * WorkflowBuilderView — Main container for the workflow builder page.
 *
 * Gallery mode: list saved workflows, create new, use templates.
 * Editor mode: full canvas with collapsible palette, inspector, toolbar, and run panel.
 */
export default function WorkflowBuilderView() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [runPanelExpanded, setRunPanelExpanded] = useState(false);

  const {
    loadWorkflow,
    resetWorkflow,
    toDefinition,
    setRunStatus,
    setNodeStatus,
    isDirty,
    nodes,
  } = useWorkflowStore();

  const handleCreateNew = useCallback(() => {
    console.info(LOG_TAG, 'Creating new workflow');
    resetWorkflow();
    useWorkflowStore.setState({
      workflowName: t('workflow.editor.untitled'),
    });
    setViewMode('editor');
  }, [resetWorkflow, t]);

  const handleEdit = useCallback(
    (workflow: WorkflowDefinition) => {
      console.info(LOG_TAG, 'Opening workflow:', workflow.name);
      loadWorkflow(workflow);
      setViewMode('editor');
    },
    [loadWorkflow]
  );

  const handleUseTemplate = useCallback(
    (template: WorkflowTemplate) => {
      console.info(LOG_TAG, 'Using template:', template.name);
      const def: WorkflowDefinition = {
        ...template.definition,
        id: '',
        name: template.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      loadWorkflow(def);
      useWorkflowStore.setState({ workflowId: null, isDirty: true });
      setViewMode('editor');
    },
    [loadWorkflow]
  );

  const handleBackToGallery = useCallback(() => {
    if (isDirty) {
      if (!confirm(t('workflow.editor.unsavedChanges'))) return;
    }
    setViewMode('gallery');
    resetWorkflow();
  }, [isDirty, resetWorkflow, t]);

  const handleValidate = useCallback(() => {
    const def = toDefinition();
    const result = workflowService.validateWorkflow(def);
    if (result.valid) {
      toast.success(t('workflow.validation.valid'));
    } else {
      result.errors.forEach((err) =>
        toast.error(`${err.code}: ${err.message}`)
      );
      result.warnings.forEach((warn) =>
        toast(warn.message, { icon: '⚠️' })
      );
    }
  }, [toDefinition, t]);

  const handleRun = useCallback(async () => {
    const def = toDefinition();
    const validation = workflowService.validateWorkflow(def);
    if (!validation.valid) {
      toast.error(t('workflow.validation.invalid'));
      return;
    }

    console.info(LOG_TAG, 'Starting workflow execution');
    setRunStatus('running');
    setRunPanelExpanded(true);

    const sortedNodes = [...def.nodes];
    const edges = def.edges;

    const triggerNode = sortedNodes.find((n) => n.data.kind === 'trigger');
    if (!triggerNode) {
      toast.error(t('workflow.validation.noTrigger'));
      setRunStatus('failed');
      return;
    }

    const visited = new Set<string>();
    const queue = [triggerNode.id];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = sortedNodes.find((n) => n.id === nodeId);
      if (!node) continue;

      setNodeStatus(nodeId, 'running');

      const startTime = Date.now();

      try {
        if (node.data.kind === 'tool_execute' && node.data.config.tool_id) {
          const result = await workflowService.executeToolStep(
            node.data.config.tool_id as string,
            (node.data.config.args as Record<string, unknown>) ?? {}
          );
          useWorkflowStore.getState().updateNodeData(nodeId, { result });
          setNodeStatus(nodeId, result.error ? 'error' : 'success');
          if (result.error) {
            toast.error(`${node.data.label}: ${result.error}`);
          }
        } else if (node.data.kind === 'llm_call') {
          const prompt = JSON.stringify(node.data.config.args ?? {});
          const result = await workflowService.executeLlmStep(
            prompt,
            node.data.config.route_key as string,
            node.data.config.model_name as string
          );
          useWorkflowStore.getState().updateNodeData(nodeId, { result });
          setNodeStatus(nodeId, result.error ? 'error' : 'success');
        } else if (node.data.kind === 'delay') {
          const seconds = (node.data.config.delay_seconds as number) ?? 1;
          await new Promise((r) =>
            setTimeout(r, Math.min(seconds, 10) * 1000)
          );
          useWorkflowStore.getState().updateNodeData(nodeId, {
            result: {
              duration_ms: Date.now() - startTime,
              started_at: new Date(startTime).toISOString(),
              finished_at: new Date().toISOString(),
            },
          });
          setNodeStatus(nodeId, 'success');
        } else {
          useWorkflowStore.getState().updateNodeData(nodeId, {
            result: {
              duration_ms: Date.now() - startTime,
              started_at: new Date(startTime).toISOString(),
              finished_at: new Date().toISOString(),
            },
          });
          setNodeStatus(nodeId, 'success');
        }
      } catch (err) {
        const duration = Date.now() - startTime;
        useWorkflowStore.getState().updateNodeData(nodeId, {
          result: {
            error: err instanceof Error ? err.message : String(err),
            duration_ms: duration,
            started_at: new Date(startTime).toISOString(),
            finished_at: new Date().toISOString(),
          },
        });
        setNodeStatus(nodeId, 'error');
        toast.error(`${node.data.label}: execution error`);
      }

      const outEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outEdges) {
        queue.push(edge.target);
      }
    }

    setRunStatus('completed');
    toast.success(t('workflow.runPanel.completed'));
  }, [toDefinition, setRunStatus, setNodeStatus, t]);

  const handleAutoLayout = useCallback(() => {
    const currentNodes = useWorkflowStore.getState().nodes;
    if (currentNodes.length === 0) return;

    const SPACING_X = 250;
    const SPACING_Y = 150;
    const edges = useWorkflowStore.getState().edges;

    const roots = currentNodes.filter(
      (n) => !edges.some((e) => e.target === n.id)
    );

    const visited = new Set<string>();
    const positions: Record<string, { x: number; y: number }> = {};
    let col = 0;

    function layoutDFS(nodeId: string, depth: number, lane: number) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      positions[nodeId] = { x: lane * SPACING_X, y: depth * SPACING_Y };

      const children = edges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);
      children.forEach((childId, i) => {
        layoutDFS(childId, depth + 1, lane + i);
      });
    }

    roots.forEach((root) => {
      layoutDFS(root.id, 0, col);
      col += 2;
    });

    currentNodes.forEach((n) => {
      if (!visited.has(n.id)) {
        positions[n.id] = { x: col * SPACING_X, y: 0 };
        col += 1;
      }
    });

    useWorkflowStore.setState({
      nodes: currentNodes.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      })),
      isDirty: true,
    });

    toast.success(t('workflow.editor.autoLayout') + ' ✓');
  }, [t]);

  // ==========================================
  // Gallery Mode
  // ==========================================
  if (viewMode === 'gallery') {
    return (
      <WorkflowGallery
        onEdit={handleEdit}
        onCreateNew={handleCreateNew}
        onUseTemplate={handleUseTemplate}
      />
    );
  }

  // ==========================================
  // Editor Mode
  // ==========================================
  return (
    <ReactFlowProvider>
      <div className="flex h-[calc(100vh-180px)] flex-col overflow-hidden rounded-xl border border-muted">
        {/* Back + Toolbar */}
        <div className="flex items-center border-b border-muted bg-gray-0 dark:bg-gray-50">
          <Button
            variant="text"
            size="sm"
            onClick={handleBackToGallery}
            className="ms-2 gap-1 text-gray-500"
          >
            <PiArrowLeftBold className="h-3.5 w-3.5" />
            {t('workflow.gallery.title')}
          </Button>
          <div className="flex-1">
            <WorkflowToolbar
              onValidate={handleValidate}
              onRun={handleRun}
              onAutoLayout={handleAutoLayout}
            />
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Collapsible Palette */}
          <WorkflowStepPalette
            isCollapsed={paletteCollapsed}
            onToggleCollapse={() => setPaletteCollapsed(!paletteCollapsed)}
          />

          {/* Center: Canvas + Run Panel */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1">
              <WorkflowCanvas onAutoLayout={handleAutoLayout} />
            </div>

            {/* Bottom: Run Panel */}
            <WorkflowRunPanel
              isExpanded={runPanelExpanded}
              onToggle={() => setRunPanelExpanded(!runPanelExpanded)}
              onRun={handleRun}
            />
          </div>

          {/* Right: Collapsible Inspector */}
          <WorkflowInspector
            isCollapsed={inspectorCollapsed}
            onToggleCollapse={() =>
              setInspectorCollapsed(!inspectorCollapsed)
            }
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
