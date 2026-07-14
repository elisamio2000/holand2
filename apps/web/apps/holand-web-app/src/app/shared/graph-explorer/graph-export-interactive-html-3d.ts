/**
 * Interactive 3D graph HTML (Three.js + 3d-force-graph UMD).
 * Offline-capable: inline bundles, ZIP vendor/, or CDN fallback.
 * Visual preset: lit nodes + optional glow, link flow particles, collapsible UI dock.
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
import type { HtmlExportScriptMode, HtmlExportSearchFocus } from './graph-export-interactive-html';
import {
  buildExport3dSimOrbitScript,
  buildExportColorHelpersScript,
  buildExportDockHtml,
  buildExportPanelCss,
  buildExportPanelInitScript,
  type ExportDockConfig,
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
import { buildExport3dVisualScript } from './graph-export-3d-visual';
import {
  buildExportVisualsPanelCss,
  buildExportVisualsPanelHtml,
  buildExportVisualsPanelScript,
} from './graph-export-visuals-panel';

export interface InteractiveHtmlExport3DOptions {
  title: string;
  backgroundColor: string;
  includeInspector: boolean;
  includeControls: boolean;
  includeLegend: boolean;
  includeSearch: boolean;
  includeNodeProperties: boolean;
  scriptMode: HtmlExportScriptMode;
  forceGraph3dBundle?: string;
  threeBundle?: string;
  includePhysicsPanel: boolean;
  exportSearchFocus: HtmlExportSearchFocus;
  includeCommunityReports: boolean;
  includeSavedPositions: boolean;
  /** Relative folder for vendor scripts (ZIP / folder export). */
  scriptBasePath?: string;
  /** Animated particles along links (direction of relations). */
  includeLinkParticles?: boolean;
  /** Soft halo around nodes (still uses valid hex colors for polished). */
  includeNodeGlow?: boolean;
  /** Top-right dock to show/hide panels. */
  includePanelDock?: boolean;
  /** Link relation labels (can clutter dense graphs). */
  includeLinkLabels?: boolean;
  /** Layout algorithm dropdown in exported controls. */
  includeLayoutPicker?: boolean;
}

const DEFAULT_3D: InteractiveHtmlExport3DOptions = {
  title: 'Knowledge graph 3D',
  backgroundColor: '#000011',
  includeInspector: true,
  includeControls: true,
  includeLegend: true,
  includeSearch: true,
  includeNodeProperties: false,
  scriptMode: 'cdn',
  includePhysicsPanel: true,
  exportSearchFocus: 'highlight',
  includeCommunityReports: true,
  includeSavedPositions: true,
  scriptBasePath: undefined,
  includeLinkParticles: true,
  includeNodeGlow: true,
  includePanelDock: true,
  includeLinkLabels: false,
  includeLayoutPicker: true,
};

function build3DEngineTags(o: InteractiveHtmlExport3DOptions): string {
  if (o.scriptBasePath && o.scriptBasePath.length > 0) {
    const base = o.scriptBasePath.replace(/\/?$/, '/');
    return `<script src="${escHtml(base)}three.min.js"></script>
  <script src="${escHtml(base)}3d-force-graph.min.js"></script>`;
  }
  if (
    o.scriptMode === 'inline' &&
    o.threeBundle &&
    o.threeBundle.length > 1000 &&
    o.forceGraph3dBundle &&
    o.forceGraph3dBundle.length > 100
  ) {
    return `<script>${sanitizeInlineScriptContent(o.threeBundle)}</script>
  <script>${sanitizeInlineScriptContent(o.forceGraph3dBundle)}</script>`;
  }
  return `<script src="/brand/brand-mark-4x.svg"></script>
  <script src="/brand/brand-mark-4x.svg"></script>`;
}


export function buildInteractiveGraphHtml3D(
  graphData: GraphData,
  opts: Partial<InteractiveHtmlExport3DOptions> = {}
): string {
  const o: InteractiveHtmlExport3DOptions = { ...DEFAULT_3D, ...opts };
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

  const dockCfg: ExportDockConfig = {
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
      <div class="inspector-h"><span id="inspector-title">Node</span><button type="button" id="inspector-close">Ã—</button></div>
      <div id="inspector-body"></div>
    </div>`,
        'inspector hidden'
      )
    : '';

  const searchExtras =
    o.includeSearch
      ? `<label class="search-mode"><span>Match focus</span><select id="search-focus">
          <option value="highlight"${o.exportSearchFocus === 'highlight' ? ' selected' : ''}>Highlight</option>
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

  const controlsBlock = o.includeControls
    ? buildFloatPanelShell(
        'controls',
        'Controls',
        `<div class="controls">
            <button type="button" data-a="fit" title="Fit graph in view">Fit</button>
            <button type="button" data-a="reheat" title="Restart force simulation">Reheat</button>
            <button type="button" data-a="pause" id="btn-pause" title="Pause or resume physics">Pause</button>
            <button type="button" data-a="rotate" id="btn-rotate" title="Auto-orbit camera">Orbit</button>
            <button type="button" data-a="glow" id="btn-glow" title="Node halo glow">Glow</button>
            <button type="button" data-a="particles" id="btn-particles" title="Flow on links">Flow</button>
            <button type="button" data-a="color-mode" id="btn-color-mode" title="Color by cluster or type">Clusters</button>
            <button type="button" data-a="clear">Clear</button>
          </div>
          ${o.includePhysicsPanel ? '<div class="physics-inline"><span>Damping</span><input type="range" id="vd" min="0.08" max="0.92" step="0.02" value="0.38"/></div>' : ''}
          ${o.includeLayoutPicker && o.includeControls ? buildExportLayoutControlHtml(o.includeSavedPositions) : ''}`,
        'controls-wrap'
      )
    : '';

  const visualsBlock = buildFloatPanelShell(
    'visuals',
    'Visuals',
    buildExportVisualsPanelHtml({ is3d: true }),
    'visuals-wrap panel-float'
  );

  const legendBlock = o.includeLegend
    ? buildFloatPanelShell('legend', 'Entity types', `<div class="legend-body">${legendItems}</div>`, 'legend')
    : '';

  const infoPanel = buildFloatPanelShell(
    'info',
    'Graph',
    `<h1>${escHtml(o.title)}</h1>
      <div class="row"><span>3D Â· Nodes</span><span>${nodes.length}</span></div>
      <div class="row"><span>Links</span><span>${links.length}</span></div>
      <div class="row"><span>Exported</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
      <div class="row"><span>Engine</span><span>${o.scriptBasePath ? 'offline' : o.scriptMode === 'inline' ? 'embedded' : 'CDN'}</span></div>`,
    'panel-info'
  );

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

  const linkLabelLine = o.includeLinkLabels
    ? `.linkLabel(l => (l.relation || '').length > 24 ? (l.relation || '').slice(0, 22) + 'â€¦' : (l.relation || ''))`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escHtml(o.title)}</title>
  ${build3DEngineTags(o)}
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
  <div class="nav-hint">Left-drag orbit Â· Scroll zoom Â· Right-drag pan</div>
  <script>
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    const typeColors = ${typeColorsJson};
    const relationColors = ${relationColorsJson};
    const communityColors = ${communityColorsJson};
    const communityReports = ${communityReportsJsonStr};
    const data = { nodes: ${JSON.stringify(nodes)}, links: ${JSON.stringify(links)} };
    let highlights = [];
    let searchFocus = ${JSON.stringify(o.exportSearchFocus)};
    const visual = {
      glow: ${o.includeNodeGlow ? 'true' : 'false'},
      particles: ${o.includeLinkParticles ? 'true' : 'false'},
      colorByCommunity: true,
      simPaused: false,
      autoRotate: false
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
    function nodeVal(n) {
      return 1 + Math.sqrt((n.connectionCount || 0) + 1) * 0.9;
    }
    const NODE_REL_SIZE = 6;
    function nodeRadius(n) {
      return Math.cbrt(nodeVal(n)) * NODE_REL_SIZE * 0.15;
    }
    ${buildExport3dVisualScript()}
    ${o.includeLayoutPicker ? buildExportLayoutScript({ is3d: true, includeSavedPositions: o.includeSavedPositions, afterGraphData: 'restoreExport3dSceneDecor();' }) : ''}

    function syncToggleButtons() {
      var g = $('btn-glow'); if (g) g.classList.toggle('active', visual.glow);
      var p = $('btn-particles'); if (p) p.classList.toggle('active', visual.particles);
      var c = $('btn-color-mode'); if (c) {
        c.classList.toggle('active', visual.colorByCommunity);
        c.textContent = visual.colorByCommunity ? 'Clusters' : 'Types';
      }
      var r = $('btn-rotate'); if (r) r.classList.toggle('active', visual.autoRotate);
      var pause = $('btn-pause');
      if (pause) {
        pause.textContent = visual.simPaused ? 'Play' : 'Pause';
        pause.classList.toggle('active', visual.simPaused);
      }
    }

    const graph = ForceGraph3D()(document.getElementById('g'))
      .graphData(data)
      .backgroundColor('${o.backgroundColor}')
      .showNavInfo(false)
      .nodeLabel(function (n) {
        var lb = n.label || n.id;
        return lb + (n.type ? '\\n(' + n.type + ')' : '');
      })
      .nodeRelSize(NODE_REL_SIZE)
      .nodeVal(nodeVal)
      .nodeThreeObject(function (n) {
        if (!visual.glow) return false;
        return buildNodeMesh(n);
      })
      .nodeThreeObjectExtend(false)
      .nodeColor(resolveNodeColor)
      .linkColor(linkColorFaded3d)
      .linkOpacity(visualSettings.linkOpacityBase)
      .linkWidth(function (l) {
        var base = Math.max(0.28, (l.strength || 5) / 8);
        return base * visualSettings.linkWidthMult;
      })
      .linkDirectionalParticles(function () { return visual.particles ? 2 : 0; })
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleWidth(1.2)
      .linkDirectionalParticleColor(linkColorFaded3d)
      ${linkLabelLine}
      .nodeOpacity(visualSettings.nodeOpacityBase)
      .onNodeClick(function (node) {
        ${o.includeInspector ? 'renderInspector(node);' : ''}
        graph.cameraPosition(
          { x: (node.x || 0) * 1.35, y: (node.y || 0) * 1.35, z: (node.z || 0) * 1.35 + 100 },
          node,
          900
        );
      })
      .onBackgroundClick(function () {
        highlights = [];
        ${o.includeInspector ? "$('inspector').classList.add('hidden');" : ''}
        ${o.includeSearch ? 'clearExportSearchInput(); runSearch("");' : 'graph.nodeOpacity(graph.nodeOpacity()); graph.linkOpacity(graph.linkOpacity()); refreshVisuals();'}
      });

    ${buildExport3dSimOrbitScript()}

    boostSceneLights();
    addStarfield();
    syncToggleButtons();
    if (typeof graph.resumeAnimation === 'function') graph.resumeAnimation();

    ${o.includeInspector ? `
    function renderInspector(node) {
      var html = '';
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
      $('inspector-close').onclick = function () { $('inspector').classList.add('hidden'); };
    }
    ` : ''}

    ${o.includeSearch ? buildExportSearchBindingsScript('refreshVisuals(); if (typeof graph.nodeOpacity === "function") graph.nodeOpacity(graph.nodeOpacity()); if (typeof graph.linkOpacity === "function") graph.linkOpacity(graph.linkOpacity()); if (typeof graph.linkColor === "function") graph.linkColor(graph.linkColor());') : ''}

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
      if (a === 'fit') graph.zoomToFit(1200, 48);
      if (a === 'reheat') { visual.simPaused = false; applySimPaused(); graph.d3ReheatSimulation(); syncToggleButtons(); }
      if (a === 'pause') toggleSimPause();
      if (a === 'rotate') toggleOrbit();
      if (a === 'glow') { visual.glow = !visual.glow; refreshVisuals(); syncToggleButtons(); }
      if (a === 'particles') { visual.particles = !visual.particles; refreshVisuals(); syncToggleButtons(); }
      if (a === 'color-mode') { visual.colorByCommunity = !visual.colorByCommunity; refreshVisuals(); syncToggleButtons(); }
      if (a === 'clear') {
        ${o.includeInspector ? "$('inspector').classList.add('hidden');" : ''}
        highlights = [];
        ${o.includeSearch ? 'clearExportSearchInput(); runSearch("");' : 'graph.nodeOpacity(graph.nodeOpacity()); graph.linkOpacity(graph.linkOpacity()); refreshVisuals();'}
      }
    });
    ` : ''}

    ${buildExportPanelInitScript(o.includePanelDock ?? true)}
    ${o.includeLayoutPicker ? buildExportLayoutBindingsScript({ afterRun: 'restoreExport3dSceneDecor(); if (typeof graph.zoomToFit === "function") graph.zoomToFit(1000, 52);' }) : ''}
    ${buildExportVisualsPanelScript({ is3d: true })}

    setTimeout(function () { if (typeof graph.zoomToFit === 'function') graph.zoomToFit(1000, 52); }, 480);
  </script>
</body>
</html>`;
}

