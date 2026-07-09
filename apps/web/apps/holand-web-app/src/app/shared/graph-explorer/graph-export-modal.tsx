'use client';

import { useState, useCallback } from 'react';
import { Button, Checkbox, Input, Text, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import type { GraphData } from '@/types/graph-explorer.types';
import {
  buildInteractiveGraphHtml,
  downloadTextFile,
  type HtmlExportSearchFocus,
} from './graph-export-interactive-html';
import { buildInteractiveGraphHtml3D } from './graph-export-interactive-html-3d';
import { downloadGraphExplorerZip } from './graph-export-zip-package';

export interface GraphExportModalProps {
  open: boolean;
  graphData: GraphData;
  onClose: () => void;
}

type ExportDimension = '2d' | '3d';
type ExportPackaging = 'single-html' | 'zip-bundle';

export default function GraphExportModal({ open, graphData, onClose }: GraphExportModalProps) {
  const [baseName, setBaseName] = useState('knowledge-graph');
  const [dimension, setDimension] = useState<ExportDimension>('2d');
  const [packaging, setPackaging] = useState<ExportPackaging>('single-html');
  const [includeInspector, setIncludeInspector] = useState(true);
  const [includeControls, setIncludeControls] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeSearch, setIncludeSearch] = useState(true);
  const [includeProps, setIncludeProps] = useState(false);
  const [includeCommunityReports, setIncludeCommunityReports] = useState(true);
  const [includePhysicsPanel, setIncludePhysicsPanel] = useState(true);
  const [includeSavedPositions, setIncludeSavedPositions] = useState(true);
  const [includeLinkLabels, setIncludeLinkLabels] = useState(false);
  const [includeLinkParticles, setIncludeLinkParticles] = useState(true);
  const [includePanelDock, setIncludePanelDock] = useState(true);
  const [include3dNodeGlow, setInclude3dNodeGlow] = useState(true);
  const [includeLayoutPicker, setIncludeLayoutPicker] = useState(true);
  const [bg, setBg] = useState('#0f172a');
  /** Single-file: inline 2D engine from /graph-export/force-graph.min.js */
  const [bundleEngineLocal, setBundleEngineLocal] = useState(false);
  /** Single-file 3D: inline three + 3d-force-graph (very large HTML). Prefer ZIP for 3D offline. */
  const [bundle3dLocal, setBundle3dLocal] = useState(false);
  const [exportSearchFocus, setExportSearchFocus] = useState<HtmlExportSearchFocus>('highlight');
  const [exporting, setExporting] = useState(false);

  const handleDownload = useCallback(async () => {
    setExporting(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const safe = baseName.replace(/[^\w\-]+/g, '_') || 'graph';

    const common2d = {
      title: baseName,
      filenameBase: baseName,
      backgroundColor: bg,
      includeInspector,
      includeControls,
      includeLegend,
      includeSearch,
      includeNodeProperties: includeProps,
      includeCommunityReports,
      includePhysicsPanel,
      exportSearchFocus,
      includeSavedPositions,
      includeLinkLabels,
      includeLinkParticles,
      includePanelDock,
      includeLayoutPicker,
    };

    const common3d = {
      title: baseName,
      backgroundColor: dimension === '3d' ? '#000011' : bg,
      includeInspector,
      includeControls,
      includeLegend,
      includeSearch,
      includeNodeProperties: includeProps,
      includeCommunityReports,
      includePhysicsPanel,
      exportSearchFocus,
      includeSavedPositions,
      includeLinkParticles,
      includeNodeGlow: include3dNodeGlow,
      includePanelDock,
      includeLinkLabels,
      includeLayoutPicker,
    };

    try {
      if (packaging === 'zip-bundle') {
        if (dimension === '2d') {
          const res = await fetch(`${origin}/graph-export/force-graph.min.js`, { cache: 'force-cache' });
          if (!res.ok) throw new Error('missing_force_graph');
          const fg = await res.text();
          const html = buildInteractiveGraphHtml(graphData, {
            ...common2d,
            scriptBasePath: './vendor/',
          });
          await downloadGraphExplorerZip(safe, html, { 'force-graph.min.js': fg });
        } else {
          const [rt, r3] = await Promise.all([
            fetch(`${origin}/graph-export/three.min.js`, { cache: 'force-cache' }),
            fetch(`${origin}/graph-export/3d-force-graph.min.js`, { cache: 'force-cache' }),
          ]);
          if (!rt.ok || !r3.ok) throw new Error('missing_3d_vendor');
          const [tJs, g3Js] = await Promise.all([rt.text(), r3.text()]);
          const html = buildInteractiveGraphHtml3D(graphData, {
            ...common3d,
            scriptBasePath: './vendor/',
          });
          await downloadGraphExplorerZip(safe, html, {
            'three.min.js': tJs,
            '3d-force-graph.min.js': g3Js,
          });
        }
        toast.success('ZIP downloaded — extract and open index.html (fully offline)');
        onClose();
        return;
      }

      // Single HTML
      if (dimension === '2d') {
        let forceGraphBundle: string | undefined;
        if (bundleEngineLocal) {
          const res = await fetch(`${origin}/graph-export/force-graph.min.js`, { cache: 'force-cache' });
          if (!res.ok) {
            toast.error('Local force-graph.min.js missing under public/graph-export/');
            return;
          }
          forceGraphBundle = await res.text();
        }
        const html = buildInteractiveGraphHtml(graphData, {
          ...common2d,
          scriptMode: bundleEngineLocal ? 'inline' : 'cdn',
          forceGraphBundle,
        });
        downloadTextFile(`${safe}-2d-interactive.html`, html, 'text/html;charset=utf-8');
        toast.success(bundleEngineLocal ? '2D HTML downloaded (engine embedded)' : '2D HTML downloaded');
      } else {
        let threeBundle: string | undefined;
        let forceGraph3dBundle: string | undefined;
        if (bundle3dLocal) {
          const [rt, r3] = await Promise.all([
            fetch(`${origin}/graph-export/three.min.js`, { cache: 'force-cache' }),
            fetch(`${origin}/graph-export/3d-force-graph.min.js`, { cache: 'force-cache' }),
          ]);
          if (!rt.ok || !r3.ok) {
            toast.error('Local three / 3d-force-graph bundles missing under public/graph-export/');
            return;
          }
          threeBundle = await rt.text();
          forceGraph3dBundle = await r3.text();
        }
        const html = buildInteractiveGraphHtml3D(graphData, {
          ...common3d,
          scriptMode: bundle3dLocal ? 'inline' : 'cdn',
          threeBundle,
          forceGraph3dBundle,
        });
        downloadTextFile(`${safe}-3d-interactive.html`, html, 'text/html;charset=utf-8');
        toast.success(
          bundle3dLocal ? '3D HTML downloaded (Three + 3d-force-graph embedded — large file)' : '3D HTML downloaded'
        );
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Export failed — check browser console');
    } finally {
      setExporting(false);
    }
  }, [
    graphData,
    baseName,
    bg,
    dimension,
    packaging,
    includeInspector,
    includeControls,
    includeLegend,
    includeSearch,
    includeProps,
    includeCommunityReports,
    includePhysicsPanel,
    includeSavedPositions,
    includeLinkLabels,
    includeLinkParticles,
    includePanelDock,
    include3dNodeGlow,
    includeLayoutPicker,
    bundleEngineLocal,
    bundle3dLocal,
    exportSearchFocus,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-muted bg-gray-0 shadow-2xl dark:bg-gray-50 max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-muted px-4 py-3">
          <Title as="h3" className="text-base font-semibold">
            Export interactive graph
          </Title>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200"
            onClick={onClose}
            aria-label="Close"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4 overflow-y-auto">
          <div>
            <Text className="mb-1 text-xs font-medium text-gray-600">File base name</Text>
            <Input value={baseName} onChange={(e) => setBaseName(e.target.value)} placeholder="knowledge-graph" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600">Renderer</Text>
              <select
                className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs dark:bg-gray-50"
                value={dimension}
                onChange={(e) => setDimension(e.target.value as ExportDimension)}
              >
                <option value="2d">2D (Canvas force)</option>
                <option value="3d">3D (WebGL)</option>
              </select>
            </div>
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600">Package</Text>
              <select
                className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs dark:bg-gray-50"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value as ExportPackaging)}
              >
                <option value="single-html">Single .html</option>
                <option value="zip-bundle">ZIP (index + vendor/)</option>
              </select>
            </div>
          </div>

          <div>
            <Text className="mb-1 text-xs font-medium text-gray-600">Background</Text>
            <Input value={bg} onChange={(e) => setBg(e.target.value)} placeholder="#0f172a" />
          </div>

          <div className="space-y-2 rounded-lg border border-muted p-3">
            <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">Embedded UI</Text>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeInspector} onChange={() => setIncludeInspector((v) => !v)} />
              Inspector
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeControls} onChange={() => setIncludeControls((v) => !v)} />
              Toolbar + controls
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeLegend} onChange={() => setIncludeLegend((v) => !v)} />
              Type legend
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeSearch} onChange={() => setIncludeSearch((v) => !v)} />
              Search + focus modes
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includePhysicsPanel} onChange={() => setIncludePhysicsPanel((v) => !v)} />
              Physics damping slider
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeLayoutPicker} onChange={() => setIncludeLayoutPicker((v) => !v)} />
              Layout picker (same presets as explorer)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeProps} onChange={() => setIncludeProps((v) => !v)} />
              Full node/link properties (larger)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeCommunityReports} onChange={() => setIncludeCommunityReports((v) => !v)} />
              Cluster AI text in inspector
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeSavedPositions} onChange={() => setIncludeSavedPositions((v) => !v)} />
              Seed layout from saved x/y/z (closer to current view)
            </label>
            <Text className="pt-1 text-[11px] font-semibold text-gray-600 dark:text-gray-400">Visuals (2D &amp; 3D)</Text>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includePanelDock} onChange={() => setIncludePanelDock((v) => !v)} />
              Panel dock (show/hide UI blocks)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeLinkParticles} onChange={() => setIncludeLinkParticles((v) => !v)} />
              Link flow particles (animated direction)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeLinkLabels} onChange={() => setIncludeLinkLabels((v) => !v)} />
              Relation labels on links (may clutter dense graphs)
            </label>
            {dimension === '3d' && (
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox checked={include3dNodeGlow} onChange={() => setInclude3dNodeGlow((v) => !v)} />
                Node glow + emissive lighting (3D only)
              </label>
            )}
          </div>

          {packaging === 'single-html' && (
            <div className="space-y-2 rounded-lg border border-muted p-3">
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">Offline (single file)</Text>
              {dimension === '2d' ? (
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
                  <Checkbox checked={bundleEngineLocal} onChange={() => setBundleEngineLocal((v) => !v)} className="mt-0.5" />
                  <span>
                    Embed 2D engine (~160&nbsp;KB) from{' '}
                    <code className="rounded bg-gray-100 px-0.5 dark:bg-gray-200">/graph-export/force-graph.min.js</code>
                  </span>
                </label>
              ) : (
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
                  <Checkbox checked={bundle3dLocal} onChange={() => setBundle3dLocal((v) => !v)} className="mt-0.5" />
                  <span>
                    Embed Three.js + 3d-force-graph (multi‑MB). For 3D offline on slow links, prefer{' '}
                    <strong>ZIP package</strong> instead.
                  </span>
                </label>
              )}
              {!bundleEngineLocal && dimension === '2d' && (
                <Text className="text-[11px] text-gray-500">
                  Default 2D: one script from unpkg. Works offline only if cached or with embed option above.
                </Text>
              )}
              {dimension === '3d' && !bundle3dLocal && (
                <Text className="text-[11px] text-gray-500">
                  Default 3D: loads Three + 3d-force-graph from unpkg (two requests).
                </Text>
              )}
            </div>
          )}

          {packaging === 'zip-bundle' && (
            <Text className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400 rounded-lg border border-muted p-3">
              ZIP always includes vendor scripts from this server next to <code className="text-[10px]">index.html</code>
              . Extract the folder and open <code className="text-[10px]">index.html</code> — no internet required.
            </Text>
          )}

          {includeSearch && (
            <div className="space-y-1">
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">Default search focus</Text>
              <select
                className="w-full rounded-md border border-muted bg-gray-0 px-2 py-1.5 text-xs dark:bg-gray-50"
                value={exportSearchFocus}
                onChange={(e) => setExportSearchFocus(e.target.value as HtmlExportSearchFocus)}
              >
                <option value="highlight">Highlight matches</option>
                <option value="dim">Dim non-matches</option>
                <option value="hide">Hide non-matches</option>
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-muted px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleDownload()} isLoading={exporting}>
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
