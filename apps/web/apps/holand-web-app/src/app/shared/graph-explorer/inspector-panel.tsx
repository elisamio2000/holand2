'use client';

/**
 * InspectorPanel — Right panel showing details of selected node/link/community.
 *
 * Renders three sub-views:
 * 1. NodeInspector — entity details, connections, properties
 * 2. LinkInspector — relationship details, source/target
 * 3. CommunityInspector — cluster overview with member list
 *
 * @requires rizzui — Badge, ActionIcon, Text, Title
 * @requires react-icons/pi — Phosphor icons
 *
 * @example
 * ```tsx
 * <InspectorPanel target={inspectorTarget} data={graphData} onNodeAction={handleNodeAction} />
 * ```
 */

import { IconTooltip } from '@/components/tooltip';
import { useMemo, useCallback, useState } from 'react';
import { Badge, ActionIcon, Text, Title } from 'rizzui';
import {
  PiXBold,
  PiCopyBold,
  PiArrowsOutBold,
  PiPushPinBold,
  PiLockKeyBold,
  PiEyeSlashBold,
  PiGraphBold,
  PiLinkBold,
  PiArrowRightBold,
  PiArrowLeftBold,
  PiCaretDownBold,
  PiCaretRightBold,
  PiPackageBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import { getEntityConfig, getRelationConfig, getCommunityColor } from '@/config/graph-config';

import type {
  GraphData,
  GraphNode,
  GraphLink,
  InspectorTarget,
  NodeAction,
  LinkAction,
  EntityType,
  CommunityReport,
  Community,
} from '@/types/graph-explorer.types';
import { GRAPH_ENTITY_ICONS } from './graph-entity-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InspectorPanelProps {
  target: InspectorTarget;
  data: GraphData;
  onClose: () => void;
  onNodeAction: (nodeId: string, action: NodeAction) => void;
  onLinkAction: (linkId: string, action: LinkAction) => void;
  onSelectNode: (nodeId: string) => void;
  className?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InspectorPanel({
  target,
  data,
  onClose,
  onNodeAction,
  onLinkAction,
  onSelectNode,
  className,
}: InspectorPanelProps) {
  if (!target) return null;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gray-0 dark:bg-gray-50 border-l border-muted overflow-hidden',
        className
      )}
    >
      {target.kind === 'node' && (
        <NodeInspector
          node={target.item as GraphNode}
          data={data}
          onClose={onClose}
          onNodeAction={onNodeAction}
          onSelectNode={onSelectNode}
        />
      )}
      {target.kind === 'link' && (
        <LinkInspector
          link={target.item as GraphLink}
          data={data}
          onClose={onClose}
          onLinkAction={onLinkAction}
          onSelectNode={onSelectNode}
        />
      )}
      {target.kind === 'community' && target.item.community_id != null && (
        <CommunityInspector
          communityId={target.item.community_id}
          data={data}
          onClose={onClose}
          onSelectNode={onSelectNode}
          fromNodeId={target.fromNodeId}
        />
      )}
    </div>
  );
}

// ─── Node Inspector ───────────────────────────────────────────────────────────

function NodeInspector({
  node,
  data,
  onClose,
  onNodeAction,
  onSelectNode,
}: {
  node: GraphNode;
  data: GraphData;
  onClose: () => void;
  onNodeAction: (nodeId: string, action: NodeAction) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const [propsOpen, setPropsOpen] = useState(false);
  const cfg = getEntityConfig(node.type);

  const connections = useMemo(() => {
    return data.links.filter((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return srcId === node.id || tgtId === node.id;
    });
  }, [data.links, node.id]);

  const connectedNodes = useMemo(() => {
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    return connections.map((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      const neighborId = srcId === node.id ? tgtId : srcId;
      const direction = srcId === node.id ? 'outgoing' : 'incoming';
      const neighbor = nodeMap.get(neighborId);
      return { link: l, neighborId, direction, neighbor };
    });
  }, [connections, data.nodes, node.id]);

  const clusterMembers = useMemo(() => {
    if (node.community_id == null) return [];
    return data.nodes.filter((n) => n.community_id === node.community_id);
  }, [data.nodes, node.community_id]);

  const clusterReport = useMemo(() => {
    if (node.community_id == null) return undefined;
    return data.community_reports.find((r) => r.community_id === node.community_id);
  }, [data.community_reports, node.community_id]);

  const clusterCatalog = useMemo(() => {
    if (node.community_id == null) return undefined;
    return data.communities.find((c) => c.community_id === node.community_id);
  }, [data.communities, node.community_id]);

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(node.id);
    toast.success('Node ID copied');
  }, [node.id]);

  return (
    <>
      {/* Header */}
      <div className="px-3 py-3 border-b border-muted">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
            >
              {GRAPH_ENTITY_ICONS[node.type] ?? GRAPH_ENTITY_ICONS.unknown}
            </div>
            <div>
              <Title as="h6" className="text-sm font-semibold text-gray-900 dark:text-gray-700 leading-tight">
                {node.label}
              </Title>
              <Badge size="sm" style={{ backgroundColor: cfg.bgColor, color: cfg.color }}>
                {cfg.label}
              </Badge>
            </div>
          </div>
          <ActionIcon variant="text" size="sm" onClick={onClose}>
            <PiXBold className="w-4 h-4" />
          </ActionIcon>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 mt-2">
          <IconTooltip content="Focus" preset="toolbar">
            <ActionIcon variant="outline" size="sm" aria-label="Focus" onClick={() => onNodeAction(node.id, 'focus')}>
              <PiArrowsOutBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
          <IconTooltip content="Expand" preset="toolbar">
            <ActionIcon variant="outline" size="sm" aria-label="Expand" onClick={() => onNodeAction(node.id, 'expand')}>
              <PiGraphBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
          <IconTooltip content="Pin" preset="toolbar">
            <ActionIcon variant="outline" size="sm" aria-label="Pin" onClick={() => onNodeAction(node.id, 'pin')}>
              <PiPushPinBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
          <IconTooltip content="Lock" preset="toolbar">
            <ActionIcon variant="outline" size="sm" aria-label="Lock" onClick={() => onNodeAction(node.id, 'lock')}>
              <PiLockKeyBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
          <IconTooltip content="Hide" preset="toolbar">
            <ActionIcon variant="outline" size="sm" aria-label="Hide" onClick={() => onNodeAction(node.id, 'hide')}>
              <PiEyeSlashBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
          <IconTooltip content="Copy ID" preset="toolbar">
            <ActionIcon variant="outline" size="sm" aria-label="Copy ID" onClick={handleCopyId}>
              <PiCopyBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
          {node.community_id != null && (
            <IconTooltip content="Open cluster inspector" preset="toolbar">
              <ActionIcon
                variant="outline"
                size="sm"
                aria-label="Open cluster inspector"
                onClick={() => onNodeAction(node.id, 'inspect_cluster')}
              >
                <PiPackageBold className="w-3.5 h-3.5" />
              </ActionIcon>
            </IconTooltip>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Description */}
        {node.description && (
          <div>
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Description
            </Text>
            <Text className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {node.description}
            </Text>
          </div>
        )}

        {/* Summary */}
        <div>
          <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Overview
          </Text>
          <div className="space-y-1">
            <PropertyRow label="ID" value={node.id} truncate />
            <PropertyRow label="Type" value={cfg.label} />
            {node.community_id !== null && (
              <PropertyRow
                label="Community"
                value={`Cluster ${node.community_id}`}
                color={getCommunityColor(node.community_id)}
              />
            )}
            <PropertyRow label="Connections" value={String(connections.length)} />
            {node.origin && <PropertyRow label="Origin" value={node.origin} truncate />}
          </div>
        </div>

        {node.community_id != null && (
          <div className="rounded-lg border border-muted overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50/90 dark:bg-gray-200/15">
              <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Cluster insight
              </Text>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                onClick={() => onNodeAction(node.id, 'inspect_cluster')}
              >
                <PiPackageBold className="w-3 h-3" />
                Full panel
              </button>
            </div>
            <div className="px-2 py-2">
              <ClusterAiReportAccordions
                report={clusterReport}
                clusterMeta={clusterCatalog}
                members={clusterMembers}
                onSelectNode={onSelectNode}
              />
              {!clusterReport &&
                !(clusterCatalog?.description || clusterCatalog?.entity_names?.length) && (
                  <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    No AI report for this cluster in the loaded dataset. Open the full panel to browse all members on
                    the canvas.
                  </Text>
                )}
            </div>
          </div>
        )}

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Tags
            </Text>
            <div className="flex flex-wrap gap-1">
              {node.tags.map((tag, i) => (
                <Badge key={i} variant="outline" size="sm" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {node.properties && Object.keys(node.properties).length > 0 && (
          <div className="rounded-lg border border-muted">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
              onClick={() => setPropsOpen((o) => !o)}
            >
              <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Extended properties ({Object.keys(node.properties).length})
              </Text>
              {propsOpen ? (
                <PiCaretDownBold className="h-3 w-3 text-gray-400" />
              ) : (
                <PiCaretRightBold className="h-3 w-3 text-gray-400" />
              )}
            </button>
            {propsOpen && (
              <div className="space-y-1 border-t border-muted px-2 py-2">
                {Object.entries(node.properties).map(([key, val]) => (
                  <PropertyRow key={key} label={key} value={String(val)} truncate />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Connections */}
        <div>
          <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Connections ({connectedNodes.length})
          </Text>
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {connectedNodes.map(({ link, neighborId, direction, neighbor }) => {
              const rCfg = getRelationConfig(link.relation);
              const nCfg = neighbor ? getEntityConfig(neighbor.type) : null;
              return (
                <button
                  key={link.id}
                  onClick={() => onSelectNode(neighborId)}
                  className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors group"
                >
                  {nCfg && (
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px]"
                      style={{ backgroundColor: nCfg.bgColor, color: nCfg.color }}
                    >
                      {(neighbor?.label ?? '?')[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                      {neighbor?.label ?? neighborId}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      {direction === 'outgoing' ? (
                        <PiArrowRightBold className="w-2.5 h-2.5" />
                      ) : (
                        <PiArrowRightBold className="w-2.5 h-2.5 rotate-180" />
                      )}
                      <span style={{ color: rCfg.color }}>{rCfg.label}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{link.strength}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Link Inspector ───────────────────────────────────────────────────────────

function LinkInspector({
  link,
  data,
  onClose,
  onLinkAction,
  onSelectNode,
}: {
  link: GraphLink;
  data: GraphData;
  onClose: () => void;
  onLinkAction: (linkId: string, action: LinkAction) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const rCfg = getRelationConfig(link.relation);
  const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
  const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
  const sourceNode = data.nodes.find((n) => n.id === srcId);
  const targetNode = data.nodes.find((n) => n.id === tgtId);
  const srcCfg = sourceNode ? getEntityConfig(sourceNode.type) : null;
  const tgtCfg = targetNode ? getEntityConfig(targetNode.type) : null;

  return (
    <>
      {/* Header */}
      <div className="px-3 py-3 border-b border-muted">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <PiLinkBold className="w-4 h-4" style={{ color: rCfg.color }} />
              <Title as="h6" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
                {rCfg.label}
              </Title>
            </div>
            <Badge size="sm" style={{ backgroundColor: rCfg.color + '20', color: rCfg.color }}>
              Strength: {link.strength}
            </Badge>
          </div>
          <ActionIcon variant="text" size="sm" onClick={onClose}>
            <PiXBold className="w-4 h-4" />
          </ActionIcon>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 mt-2">
          <ActionIcon
            variant="outline"
            size="sm"
            onClick={() => onLinkAction(link.id, 'focus')}
            title="Focus"
          >
            <PiArrowsOutBold className="w-3.5 h-3.5" />
          </ActionIcon>
          <ActionIcon
            variant="outline"
            size="sm"
            onClick={() => onLinkAction(link.id, 'hide')}
            title="Hide"
          >
            <PiEyeSlashBold className="w-3.5 h-3.5" />
          </ActionIcon>
          <ActionIcon
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(link.id);
              toast.success('Link ID copied');
            }}
            title="Copy ID"
          >
            <PiCopyBold className="w-3.5 h-3.5" />
          </ActionIcon>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Source → Target visual */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100/50 dark:bg-gray-200/30">
          <button
            onClick={() => onSelectNode(srcId)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            {srcCfg && (
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: srcCfg.bgColor, color: srcCfg.color }}
              >
                {(sourceNode?.label ?? '?')[0]}
              </div>
            )}
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[80px]">
              {sourceNode?.label ?? srcId}
            </span>
          </button>
          <PiArrowRightBold className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <button
            onClick={() => onSelectNode(tgtId)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            {tgtCfg && (
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: tgtCfg.bgColor, color: tgtCfg.color }}
              >
                {(targetNode?.label ?? '?')[0]}
              </div>
            )}
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[80px]">
              {targetNode?.label ?? tgtId}
            </span>
          </button>
        </div>

        {/* Properties */}
        <div>
          <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Properties
          </Text>
          <div className="space-y-1">
            <PropertyRow label="ID" value={link.id} truncate />
            <PropertyRow label="Relation" value={rCfg.label} color={rCfg.color} />
            <PropertyRow label="Strength" value={String(link.strength)} />
            {link.description && <PropertyRow label="Description" value={link.description} />}
            {link.origin && <PropertyRow label="Origin" value={link.origin} truncate />}
          </div>
        </div>

        {/* Tags */}
        {link.tags && link.tags.length > 0 && (
          <div>
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Tags
            </Text>
            <div className="flex flex-wrap gap-1">
              {link.tags.map((kw, i) => (
                <Badge key={i} variant="outline" size="sm" className="text-[10px]">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Properties */}
        {link.properties && Object.keys(link.properties).length > 0 && (
          <div>
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Properties
            </Text>
            <div className="space-y-1">
              {Object.entries(link.properties).map(([key, val]) => (
                <PropertyRow key={key} label={key} value={String(val)} truncate />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Collapsible AI community report + cluster catalog (shared by node & community inspectors). */
function ClusterAiReportAccordions({
  report,
  clusterMeta,
  members,
  onSelectNode,
}: {
  report?: CommunityReport;
  clusterMeta?: Community;
  members: GraphNode[];
  onSelectNode: (nodeId: string) => void;
}) {
  const memberLabelSet = useMemo(() => {
    const s = new Set<string>();
    members.forEach((n) => {
      s.add(n.label.trim().toUpperCase());
    });
    return s;
  }, [members]);

  const [reportSummaryOpen, setReportSummaryOpen] = useState(true);
  const [reportFindingsOpen, setReportFindingsOpen] = useState(false);
  const [reportNamesOpen, setReportNamesOpen] = useState(false);
  const [reportMetaOpen, setReportMetaOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  if (!report && !(clusterMeta?.description || clusterMeta?.entity_names?.length)) return null;

  return (
    <div className="rounded-lg border border-muted space-y-0">
      {report && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
            onClick={() => setReportSummaryOpen((o) => !o)}
          >
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Title / summary
            </Text>
            {reportSummaryOpen ? (
              <PiCaretDownBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
            ) : (
              <PiCaretRightBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
            )}
          </button>
          {reportSummaryOpen && (
            <div className="border-t border-muted px-2 py-2 space-y-1.5">
              <Text className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                {report.title}
              </Text>
              <Text className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{report.summary}</Text>
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left border-t border-muted"
            onClick={() => setReportMetaOpen((o) => !o)}
          >
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Rating / meta
            </Text>
            {reportMetaOpen ? (
              <PiCaretDownBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
            ) : (
              <PiCaretRightBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
            )}
          </button>
          {reportMetaOpen && (
            <div className="border-t border-muted px-2 py-2 space-y-1">
              <PropertyRow label="Rating" value={String(report.rating)} />
              {report.rating_explanation && (
                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {report.rating_explanation}
                </div>
              )}
              {report.level != null && <PropertyRow label="Level" value={String(report.level)} />}
              {report.size != null && <PropertyRow label="Report size" value={String(report.size)} />}
            </div>
          )}

          {report.findings?.length ? (
            <>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left border-t border-muted"
                onClick={() => setReportFindingsOpen((o) => !o)}
              >
                <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Findings ({report.findings.length})
                </Text>
                {reportFindingsOpen ? (
                  <PiCaretDownBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
                ) : (
                  <PiCaretRightBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {reportFindingsOpen && (
                <div className="border-t border-muted px-2 py-2 space-y-2 max-h-[220px] overflow-y-auto">
                  {report.findings.map((f, i) => (
                    <div key={i} className="rounded-md bg-gray-50/80 dark:bg-gray-200/20 px-2 py-1.5">
                      <Text className="text-[11px] font-medium text-gray-800 dark:text-gray-200">{f.summary}</Text>
                      <Text className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {f.explanation}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {report.entity_names && report.entity_names.length > 0 && (
            <>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left border-t border-muted"
                onClick={() => setReportNamesOpen((o) => !o)}
              >
                <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Report entity names ({report.entity_names.length})
                </Text>
                {reportNamesOpen ? (
                  <PiCaretDownBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
                ) : (
                  <PiCaretRightBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {reportNamesOpen && (
                <div className="border-t border-muted px-2 py-2 max-h-[200px] overflow-y-auto space-y-0.5">
                  {report.entity_names.map((name, i) => {
                    const hit = memberLabelSet.has(name.trim().toUpperCase());
                    const nodeHit = members.find((n) => n.label.trim().toUpperCase() === name.trim().toUpperCase());
                    return (
                      <div key={`${name}-${i}`} className="flex items-center gap-1 text-[10px]">
                        <span
                          className={cn(
                            'truncate flex-1',
                            hit ? 'text-gray-700 dark:text-gray-300' : 'text-amber-600 dark:text-amber-400'
                          )}
                        >
                          {name}
                          {!hit && ' · not on canvas'}
                        </span>
                        {nodeHit && (
                          <button
                            type="button"
                            className="text-primary hover:underline flex-shrink-0"
                            onClick={() => onSelectNode(nodeHit.id)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {!report && clusterMeta && (clusterMeta.description || clusterMeta.entity_names?.length) && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
            onClick={() => setCatalogOpen((o) => !o)}
          >
            <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Cluster catalog (no AI report)
            </Text>
            {catalogOpen ? (
              <PiCaretDownBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
            ) : (
              <PiCaretRightBold className="h-3 w-3 text-gray-400 flex-shrink-0" />
            )}
          </button>
          {catalogOpen && (
            <div className="border-t border-muted px-2 py-2 space-y-2">
              {clusterMeta.description && (
                <Text className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {clusterMeta.description}
                </Text>
              )}
              {clusterMeta.entity_names && clusterMeta.entity_names.length > 0 && (
                <div className="max-h-[160px] overflow-y-auto space-y-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                  {clusterMeta.entity_names.map((name, i) => (
                    <div key={`${name}-${i}`} className="truncate">
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Community Inspector ──────────────────────────────────────────────────────

function CommunityInspector({
  communityId,
  data,
  onClose,
  onSelectNode,
  fromNodeId,
}: {
  communityId: number;
  data: GraphData;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  /** Node the user opened this cluster view from — shows a minimal back control when set. */
  fromNodeId?: string;
}) {
  const color = getCommunityColor(communityId);
  const members = useMemo(
    () => data.nodes.filter((n) => n.community_id === communityId),
    [data.nodes, communityId]
  );

  const clusterMeta = useMemo(
    () => data.communities.find((c) => c.community_id === communityId),
    [data.communities, communityId]
  );

  const report = useMemo((): CommunityReport | undefined => {
    return data.community_reports.find((r) => r.community_id === communityId);
  }, [data.community_reports, communityId]);

  const typeCounts = useMemo(() => {
    const counts = new Map<EntityType, number>();
    members.forEach((n) => counts.set(n.type, (counts.get(n.type) ?? 0) + 1));
    return counts;
  }, [members]);

  const title =
    report?.title ||
    clusterMeta?.title ||
    (clusterMeta?.description ? clusterMeta.description.slice(0, 80) : null) ||
    `Cluster ${communityId}`;

  return (
    <>
      {/* Header */}
      <div className="px-3 py-3 border-b border-muted">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-1">
            {fromNodeId && (
              <button
                type="button"
                onClick={() => onSelectNode(fromNodeId)}
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-200 dark:hover:text-gray-700"
                title="Back to node"
                aria-label="Back to node"
              >
                <PiArrowLeftBold className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <Title
                  as="h6"
                  className="text-sm font-semibold text-gray-900 dark:text-gray-700 leading-tight line-clamp-3"
                >
                  {title}
                </Title>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge size="sm" style={{ backgroundColor: color + '20', color }}>
                  #{communityId} · {members.length} on graph
                </Badge>
                {report?.size != null && report.size !== members.length && (
                  <Badge size="sm" variant="outline" className="text-[10px]">
                    Report size: {report.size}
                  </Badge>
                )}
                {report && (
                  <Badge size="sm" variant="outline" className="text-[10px]">
                    AI report
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <ActionIcon variant="text" size="sm" onClick={onClose} className="flex-shrink-0">
            <PiXBold className="w-4 h-4" />
          </ActionIcon>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        <ClusterAiReportAccordions
          report={report}
          clusterMeta={clusterMeta}
          members={members}
          onSelectNode={onSelectNode}
        />

        {/* Type distribution */}
        <div>
          <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Type Distribution
          </Text>
          <div className="flex flex-wrap gap-1">
            {Array.from(typeCounts.entries()).map(([type, count]) => {
              const tCfg = getEntityConfig(type);
              return (
                <Badge
                  key={type}
                  size="sm"
                  style={{ backgroundColor: tCfg.bgColor, color: tCfg.color }}
                >
                  {tCfg.label}: {count}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Members */}
        <div>
          <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Members on canvas ({members.length})
          </Text>
          <div className="space-y-0.5 max-h-[350px] overflow-y-auto">
            {members.map((node) => {
              const nCfg = getEntityConfig(node.type);
              return (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors text-left"
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px]"
                    style={{ backgroundColor: nCfg.bgColor, color: nCfg.color }}
                  >
                    {node.label[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                      {node.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{nCfg.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Shared sub-component ─────────────────────────────────────────────────────

function PropertyRow({
  label,
  value,
  color,
  truncate,
}: {
  label: string;
  value: string;
  color?: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-2 text-xs">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={cn(
          'text-gray-700 dark:text-gray-300 text-right',
          truncate && 'truncate max-w-[150px]'
        )}
        style={color ? { color } : undefined}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}
