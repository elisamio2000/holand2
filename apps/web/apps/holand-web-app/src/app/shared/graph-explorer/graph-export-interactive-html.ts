/**
 * Interactive 2D graph HTML export (force-graph).
 * - scriptMode 'cdn': loads library from unpkg (needs internet unless cached).
 * - scriptMode 'inline': embeds {@link InteractiveHtmlExportOptions.forceGraphBundle}
 *   (e.g. fetched from /graph-export/force-graph.min.js) for fully offline HTML.
 */

import type { GraphData } from '@/types/graph-explorer.types';
import {
  buildLegendItemsHtml,
  buildRelationColorsJson,
  buildTypeColorsJson,
  COMMUNITY_HEX,
  communityReportsJson,
  escHtml,
  sanitizeInlineScriptContent,
  serializeExportLinks,
  serializeExportNodes,
} from './graph-export-payload';
import {
  buildExport2dSimPauseScript,
  buildExportColorHelpersScript,
  buildExportDockHtml,
  buildExportPanelCss,
  buildExportPanelInitScript,
  buildExportSearchBindingsScript,
  buildExportSearchCoreScript,
  buildExportSearchInputHtml,
  buildFloatPanelShell,
} from './graph-export-shared-ui';
import {
  buildExportLayoutBindingsScript,
  buildExportLayoutControlHtml,
  buildExportLayoutPanelCss,
  buildExportLayoutScript,
} from './graph-export-layout';
import {
  buildExportVisualsPanelCss,
  buildExportVisualsPanelHtml,
  buildExportVisualsPanelScript,
} from './graph-export-visuals-panel';

export { sanitizeInlineScriptContent } from './graph-export-payload';

export type HtmlExportScriptMode = 'cdn' | 'inline';

/** How search affects non-matching nodes when query length ≥ 2 */
export type HtmlExportSearchFocus = 'highlight' | 'dim' | 'hide';

export interface InteractiveHtmlExportOptions {
  title: string;
  filenameBase: string;
  backgroundColor: string;
  includeInspector: boolean;
  includeControls: boolean;
  includeLegend: boolean;
  includeSearch: boolean;
  includeNodeProperties: boolean;
  /** CDN vs fully inlined force-graph UMD */
  scriptMode: HtmlExportScriptMode;
  /** Full source of force-graph.min.js when scriptMode is 'inline' */
  forceGraphBundle?: string;
  includePhysicsPanel: boolean;
  /** Search UX for exported file */
  exportSearchFocus: HtmlExportSearchFocus;
  /** Embed AI community reports for richer inspector */
  includeCommunityReports: boolean;
  /** Seed layout from node x/y when present (export matches on-screen layout better). */
  includeSavedPositions: boolean;
  /** Draw relation names on links (can clutter dense graphs). */
  includeLinkLabels: boolean;
  /** Animated particles along links. */
  includeLinkParticles?: boolean;
  /** Top-right dock to show/hide panels. */
  includePanelDock?: boolean;
  /** Layout algorithm dropdown in exported controls. */
  includeLayoutPicker?: boolean;
  /**
   * When set (e.g. `./vendor/` for ZIP), loads `./vendor/force-graph.min.js` instead of CDN/inline.
   */
  scriptBasePath?: string;
}

const DEFAULT_OPTIONS: InteractiveHtmlExportOptions = {
  title: 'Knowledge graph',
  filenameBase: 'graph',
  backgroundColor: '#0f172a',
  includeInspector: true,
  includeControls: true,
  includeLegend: true,
  includeSearch: true,
  includeNodeProperties: false,
  scriptMode: 'cdn',
  forceGraphBundle: undefined,
  includePhysicsPanel: true,
  exportSearchFocus: 'highlight',
  includeCommunityReports: true,
  includeSavedPositions: true,
  includeLinkLabels: false,
  includeLinkParticles: true,
  includePanelDock: true,
  includeLayoutPicker: true,
  scriptBasePath: undefined,
};

function buildEngineScriptTag(o: InteractiveHtmlExportOptions): string {
  if (o.scriptBasePath && o.scriptBasePath.length > 0) {
    const base = o.scriptBasePath.replace(/\/?$/, '/');
    return `<script src="${escHtml(base)}force-graph.min.js"></script>`;
  }
  if (o.scriptMode === 'inline' && o.forceGraphBundle && o.forceGraphBundle.length > 100) {
    return `<script>${sanitizeInlineScriptContent(o.forceGraphBundle)}</script>`;
  }
  return `<script src="/logo.png"></script>`;
}

export function buildInteractiveGraphHtml(
  graphData: GraphData,
  opts: Partial<InteractiveHtmlExportOptions> = {}
): string {
  const o: InteractiveHtmlExportOptions = { ...DEFAULT_OPTIONS, ...opts };
  const typeColorsJson = buildTypeColorsJson();
  const relationColorsJson = buildRelationColorsJson();
  const communityColorsJson = JSON.stringify(COMMUNITY_HEX);

  const nodes = serializeExportNodes(graphData, {
    includeNodeProperties: o.includeNodeProperties,
    includeSavedPositions: o.includeSavedPositions,
  });

  const links = serializeExportLinks(graphData, {
    includeNodeProperties: o.includeNodeProperties,
    includeSavedPositions: o.includeSavedPositions,
  });

  const communityReportsJsonStr = communityReportsJson(graphData, o.includeCommunityReports);

  const legendItems = buildLegendItemsHtml();

  const dockCfg = {
    includePanelDock: o.includePanelDock ?? true,
    includeSearch: o.includeSearch,
    includeLegend: o.includeLegend,
    includeInspector: o.includeInspector,
    includeControls: o.includeControls,
    includeVisuals: true,
  };

  const inspectorBlock = o.includeInspector
    ? buildFloatPanelShell(
        'inspector',
        'Inspector',
        `<div class="inspector-inner">
      <div class="inspector-h"><span id="inspector-title">Node</span><button type="button" id="inspector-close">×</button></div>
      <div id="inspector-body"></div>
    </div>`,
        'inspector hidden'
      )
    : '';

  const searchExtras =
    o.includeSearch
      ? `<label class="search-mode"><span>Match focus</span><select id="search-focus" title="Non-matching nodes when searching">
          <option value="highlight"${o.exportSearchFocus === 'highlight' ? ' selected' : ''}>Highlight matches</option>
          <option value="dim"${o.exportSearchFocus === 'dim' ? ' selected' : ''}>Dim others</option>
          <option value="hide"${o.exportSearchFocus === 'hide' ? ' selected' : ''}>Hide others</option>
        </select></label>`
      : '';

  const searchBlock = o.includeSearch
    ? buildFloatPanelShell(
        'search',
        'Search',
        `<div class="search-body">${buildExportSearchInputHtml(searchExtras)}</div>`,
        'search-wrap'
      )
    : '';

  const physicsInline =
    o.includePhysicsPanel && o.includeControls
      ? '<div class="physics-inline"><span>Damping</span><input type="range" id="vd" min="0.08" max="0.92" step="0.02" value="0.42" title="d3VelocityDecay"/></div>'
      : '';

  const controlsBlock = o.includeControls
    ? buildFloatPanelShell(
        'controls',
        'Controls',
        `<div class="controls">
      <button type="button" data-a="zoom-in" title="Zoom in">＋</button>
      <button type="button" data-a="zoom-out" title="Zoom out">−</button>
      <button type="button" data-a="fit" title="Fit graph">Fit</button>
      <button type="button" data-a="reset" title="Reset view">Reset</button>
      <button type="button" data-a="reheat" title="Restart simulation">Reheat</button>
      <button type="button" data-a="pause" id="btn-pause" title="Pause physics">Pause</button>
      <button type="button" data-a="labels" id="btn-labels" title="Node labels">Labels</button>
      <button type="button" data-a="particles" id="btn-particles" title="Flow on links">Flow</button>
      <button type="button" data-a="color-mode" id="btn-color-mode" title="Color by cluster or type">Clusters</button>
      <button type="button" data-a="clear">Clear</button>
    </div>
    <label class="pivot-opt"><input type="checkbox" id="pivot-mode" />
      <span>Aim zoom on next empty click (then use ±)</span>
    </label>
    ${physicsInline}
    ${o.includeLayoutPicker && o.includeControls ? buildExportLayoutControlHtml(o.includeSavedPositions) : ''}`,
        'controls-wrap'
      )
    : '';

  const legendBlock = o.includeLegend
    ? buildFloatPanelShell('legend', 'Entity types', `<div class="legend-body">${legendItems}</div>`, 'legend')
    : '';

  const visualsBlock = buildFloatPanelShell(
    'visuals',
    'Visuals',
    buildExportVisualsPanelHtml({ is3d: false, includeNodeSize: false }),
    'visuals-wrap panel-float'
  );

  const infoPanel = buildFloatPanelShell(
    'info',
    'Graph',
    `<h1>${escHtml(o.title)}</h1>
      <div class="row"><span>2D · Nodes</span><span>${nodes.length}</span></div>
      <div class="row"><span>Links</span><span>${links.length}</span></div>
      <div class="row"><span>Exported</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
      <div class="row"><span>Engine</span><span>${o.scriptBasePath ? 'offline' : o.scriptMode === 'inline' ? 'embedded' : 'CDN'}</span></div>`,
    'panel-info'
  );

  const linkParticlesInit = o.includeLinkParticles ? 'true' : 'false';
  const linkLabelChain = o.includeLinkLabels
    ? `.linkLabel(l => {
        var r = l.relation || '';
        return r.length > 24 ? r.slice(0, 22) + '…' : r;
      })`
    : '';

  const propsScript = o.includeNodeProperties
    ? `if (node.properties && Object.keys(node.properties).length) {
        html += '<div class="sec">Properties</div>';
        for (const [k, v] of Object.entries(node.properties)) {
          html += '<div class="row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(String(v)) + '</span></div>';
        }
      }`
    : '';

  const communityBlock = o.includeCommunityReports
    ? `
      var cid = node.community_id;
      if (cid !== null && cid !== undefined && communityReports && communityReports.length) {
        for (var ri = 0; ri < communityReports.length; ri++) {
          var rep = communityReports[ri];
          if (rep && rep.community_id === cid) {
            html += '<div class="sec">Cluster report</div>';
            if (rep.title) html += '<div class="row"><span class="k">Title</span><span class="v">' + esc(rep.title) + '</span></div>';
            if (rep.summary) html += '<div class="row"><span class="k">Summary</span><span class="v">' + esc(rep.summary) + '</span></div>';
            if (rep.rating != null) html += '<div class="row"><span class="k">Rating</span><span class="v">' + esc(String(rep.rating)) + '</span></div>';
            if (rep.rating_explanation) html += '<div class="muted">' + esc(rep.rating_explanation) + '</div>';
            break;
          }
        }
      }`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escHtml(o.title)}</title>
  ${buildEngineScriptTag(o)}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: ${o.backgroundColor}; color: #e2e8f0; overflow: hidden; }
    #g { width: 100vw; height: 100vh; }
    ${buildExportPanelCss()}
    ${buildExportVisualsPanelCss()}
    .visuals-wrap.panel-float { bottom: 12px; left: 50%; transform: translateX(-50%); max-width: min(320px, 90vw); }
    ${o.includeLayoutPicker ? buildExportLayoutPanelCss() : ''}
  </style>
</head>
<body>
  <div id="g"></div>
  ${infoPanel}
  ${buildExportDockHtml(dockCfg)}
  ${searchBlock}
  ${inspectorBlock}
  ${legendBlock}
  ${visualsBlock}
  ${controlsBlock}
  <div class="nav-hint">Drag nodes · Scroll zoom · Empty click clears selection</div>
  <script>
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    const typeColors = ${typeColorsJson};
    const relationColors = ${relationColorsJson};
    const communityColors = ${communityColorsJson};
    const communityReports = ${communityReportsJsonStr};
    const data = { nodes: ${JSON.stringify(nodes)}, links: ${JSON.stringify(links)} };
    let showLabels = true;
    let selected = null;
    let highlights = [];
    let searchFocus = ${JSON.stringify(o.exportSearchFocus)};
    const visual = {
      particles: ${linkParticlesInit},
      colorByCommunity: true,
      simPaused: false
    };
    var visualSettings = {
      nodeSizeMult: 1.0,
      linkWidthMult: 1.0,
      linkOpacityBase: 0.5,
      nodeOpacityBase: 1.0
    };
    const $ = (id) => document.getElementById(id);

    ${buildExportColorHelpersScript()}
    ${o.includeSearch ? buildExportSearchCoreScript() : ''}
    ${o.includeLayoutPicker ? buildExportLayoutScript({ is3d: false, includeSavedPositions: o.includeSavedPositions }) : ''}

    function syncToggleButtons2d() {
      var p = $('btn-particles'); if (p) p.classList.toggle('active', visual.particles);
      var c = $('btn-color-mode'); if (c) {
        c.classList.toggle('active', visual.colorByCommunity);
        c.textContent = visual.colorByCommunity ? 'Clusters' : 'Types';
      }
      var l = $('btn-labels'); if (l) l.classList.toggle('active', showLabels);
      var pause = $('btn-pause');
      if (pause) {
        pause.textContent = visual.simPaused ? 'Play' : 'Pause';
        pause.classList.toggle('active', visual.simPaused);
      }
    }

    function refreshVisuals2d() {
      graph.linkColor(graph.linkColor());
      graph.nodeColor(graph.nodeColor());
      if (typeof graph.linkDirectionalParticles === 'function') {
        graph.linkDirectionalParticles(graph.linkDirectionalParticles());
      }
      graph.nodeCanvasObject(graph.nodeCanvasObject());
    }

    ${buildExport2dSimPauseScript()}
    var pivotGx = null;
    var pivotGy = null;
    function readZoomK(g) {
      if (typeof g.zoom !== 'function') return 1;
      var z = g.zoom();
      if (typeof z === 'number' && isFinite(z)) return z;
      if (z && typeof z === 'object' && typeof z.k === 'number') return z.k;
      return 1;
    }
    function graphCentroid(gd) {
      var nodes = gd.nodes;
      var sx = 0;
      var sy = 0;
      var c = 0;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.x != null && n.y != null && isFinite(n.x) && isFinite(n.y)) {
          sx += n.x;
          sy += n.y;
          c++;
        }
      }
      return c ? { x: sx / c, y: sy / c } : { x: 0, y: 0 };
    }
    function pivotModeOn() {
      var el = $('pivot-mode');
      return !!(el && el.checked);
    }
    function centerBeforeZoom() {
      var gd = graph.graphData();
      var c;
      if (pivotModeOn() && pivotGx != null && pivotGy != null) {
        c = { x: pivotGx, y: pivotGy };
      } else {
        c = graphCentroid(gd);
      }
      if (typeof graph.centerAt === 'function' && isFinite(c.x) && isFinite(c.y)) {
        graph.centerAt(c.x, c.y, 260);
      }
    }
    function exportZoomIn() {
      centerBeforeZoom();
      setTimeout(function () {
        var k = readZoomK(graph);
        graph.zoom(Math.min(k * 1.35, 8), 240);
      }, 55);
    }
    function exportZoomOut() {
      centerBeforeZoom();
      setTimeout(function () {
        var k = readZoomK(graph);
        graph.zoom(Math.max(k / 1.35, 0.08), 240);
      }, 55);
    }
    function exportResetView() {
      var c = graphCentroid(graph.graphData());
      if (typeof graph.centerAt === 'function') graph.centerAt(c.x, c.y, 400);
      setTimeout(function () {
        graph.zoomToFit(600, 52);
      }, 120);
    }
    const graph = ForceGraph()($('g'))
      .graphData(data)
      .backgroundColor('${o.backgroundColor}')
      .nodeLabel('')
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .linkColor(${o.includeSearch ? 'exportLinkColorForSearch' : 'linkColorFaded2d'})
      .linkWidth(l => {
        var base = Math.max(0.3, (l.strength || 5) / 8);
        return base * visualSettings.linkWidthMult;
      })
      .linkDirectionalParticles(function () { return visual.particles ? 2 : 0; })
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(1)
      .linkDirectionalParticleColor(linkColorFaded2d)
      ${linkLabelChain}
      .nodeVal(n => 1 + Math.sqrt((n.connectionCount || 0) + 1) * 0.9)
      .nodeColor(resolveNodeColor)
      .nodeCanvasObject((node, ctx, globalScale) => {
        const q = ${o.includeSearch ? 'exportSearchQuery()' : "''"};
        const active = ${o.includeSearch ? 'exportSearchActive(q)' : 'false'};
        const isHit = highlights.indexOf(node.id) >= 0;
        const dim = active && searchFocus === 'dim' && !isHit;
        const r = 4 + Math.sqrt((node.connectionCount || 0) + 1) * 1.2;
        const col = graph.nodeColor()(node);
        const ring = selected && selected.id === node.id;
        if (ring) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4 / globalScale, 0, 2 * Math.PI);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        var baseA = dim ? 0.07 : 0.33;
        var opMult = (typeof visualSettings !== 'undefined' && visualSettings.nodeOpacityBase != null) ? visualSettings.nodeOpacityBase : 1;
        var aHex = Math.round(Math.max(0, Math.min(1, baseA * opMult)) * 255).toString(16);
        if (aHex.length < 2) aHex = '0' + aHex;
        ctx.fillStyle = (col || '#94a3b8') + aHex;
        ctx.fill();
        ctx.strokeStyle = dim ? ((col || '#94a3b8') + '40') : (col || '#94a3b8');
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        if (showLabels && globalScale > 0.35) {
          var label = (node.label || '').length > 18 ? (node.label || '').slice(0, 16) + '…' : (node.label || '');
          var fs = Math.max(7, 9 / globalScale);
          ctx.font = '500 ' + fs + 'px system-ui,sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3 / globalScale;
          ctx.strokeStyle = 'rgba(15,23,42,0.85)';
          ctx.strokeText(label, node.x, node.y + r + fs + 1);
          ctx.fillStyle = dim ? 'rgba(148,163,184,0.45)' : 'rgba(248,250,252,0.92)';
          ctx.fillText(label, node.x, node.y + r + fs + 1);
        }
      })
      .nodeCanvasObjectMode(() => 'replace')
      .onNodeClick(node => {
        selected = node;
        ${o.includeInspector ? 'renderInspector(node);' : ''}
        graph.centerAt(node.x, node.y, 400);
        graph.zoom(2.2, 400);
        graph.nodeCanvasObject(graph.nodeCanvasObject());
      })
      .onBackgroundClick(function (ev) {
        if (pivotModeOn() && typeof graph.screen2GraphCoords === 'function') {
          var el = $('g');
          if (el && ev && ev.clientX != null) {
            var r = el.getBoundingClientRect();
            var px = ev.clientX - r.left;
            var py = ev.clientY - r.top;
            var gp = graph.screen2GraphCoords(px, py);
            if (gp && gp.x != null) {
              pivotGx = gp.x;
              pivotGy = gp.y;
            }
          }
        }
        selected = null;
        highlights = [];
        ${o.includeInspector ? "$('inspector').classList.add('hidden');" : ''}
        ${o.includeSearch ? 'clearExportSearchInput(); runSearch("");' : ''}
        ${o.includeSearch ? '' : 'refreshVisuals2d();'}
      });
    syncToggleButtons2d();
    applySimPaused2d();
    ${o.includeInspector ? `
    function renderInspector(node) {
      let html = '';
      html += '<div class="row"><span class="k">Type</span><span class="v">' + esc(node.type) + '</span></div>';
      html += '<div class="row"><span class="k">Connections</span><span class="v">' + esc(String(node.connectionCount || 0)) + '</span></div>';
      if (node.community_id !== null && node.community_id !== undefined) {
        html += '<div class="row"><span class="k">Cluster</span><span class="v">#' + esc(String(node.community_id)) + '</span></div>';
      }
      if (node.description) {
        html += '<div class="row"><span class="k">Description</span><span class="v">' + esc(node.description) + '</span></div>';
      }
      ${propsScript}
      ${communityBlock}
      $('inspector-title').textContent = node.label || node.id;
      $('inspector-body').innerHTML = html;
      $('inspector').classList.remove('hidden');
      $('inspector-close').onclick = () => { $('inspector').classList.add('hidden'); };
    }
    ` : ''}
    ${o.includeSearch ? buildExportSearchBindingsScript('refreshVisuals2d();') : ''}
    ${o.includePhysicsPanel && o.includeControls ? `
    var vdEl = $('vd');
    if (vdEl && typeof graph.d3VelocityDecay === 'function') {
      vdEl.addEventListener('input', function () {
        var v = parseFloat(this.value);
        if (!isNaN(v)) graph.d3VelocityDecay(v);
      });
      graph.d3VelocityDecay(parseFloat(vdEl.value));
    }
    ` : ''}
    ${o.includeControls ? `
    document.querySelector('.controls').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'zoom-in') exportZoomIn();
      if (a === 'zoom-out') exportZoomOut();
      if (a === 'fit') graph.zoomToFit(450, 52);
      if (a === 'reset') exportResetView();
      if (a === 'reheat') { visual.simPaused = false; applySimPaused2d(); graph.d3ReheatSimulation(); syncToggleButtons2d(); }
      if (a === 'pause') toggleSimPause2d();
      if (a === 'labels') { showLabels = !showLabels; syncToggleButtons2d(); graph.nodeCanvasObject(graph.nodeCanvasObject()); }
      if (a === 'particles') { visual.particles = !visual.particles; refreshVisuals2d(); syncToggleButtons2d(); }
      if (a === 'color-mode') { visual.colorByCommunity = !visual.colorByCommunity; refreshVisuals2d(); syncToggleButtons2d(); }
      if (a === 'clear') {
        selected = null; highlights = [];
        ${o.includeInspector ? "$('inspector').classList.add('hidden');" : ''}
        ${o.includeSearch ? 'clearExportSearchInput(); runSearch("");' : 'refreshVisuals2d();'}
      }
    });
    ` : ''}
    ${buildExportPanelInitScript(o.includePanelDock ?? true)}
    ${o.includeLayoutPicker ? buildExportLayoutBindingsScript({ afterRun: 'if (typeof graph.zoomToFit === "function") graph.zoomToFit(800, 48);' }) : ''}
    ${buildExportVisualsPanelScript({ is3d: false, includeNodeSize: false })}
    setTimeout(function () {
      if (typeof applyExportLayout === 'function' && $('export-layout')) {
        applyExportLayout($('export-layout').value);
      } else {
        graph.zoomToFit(500, 48);
      }
    }, 400);
  </script>
</body>
</html>`;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
