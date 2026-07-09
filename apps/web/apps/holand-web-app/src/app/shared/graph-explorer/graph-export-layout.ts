/**
 * Layout picker + algorithms for interactive 2D/3D HTML exports.
 * Mirrors graph-canvas layout presets (force-graph positions + fx/fy/fz pin).
 */

export const EXPORT_LAYOUT_SELECT_ID = 'export-layout';

const LAYOUT_OPTIONS: { value: string; label: string }[] = [
  { value: 'saved', label: 'Saved positions' },
  { value: 'force', label: 'Force-Directed' },
  { value: 'circular', label: 'Circular' },
  { value: 'grid', label: 'Grid' },
  { value: 'hierarchical', label: 'Tree (Vertical)' },
  { value: 'hierarchical-horizontal', label: 'Tree (Horizontal)' },
  { value: 'radial', label: 'Radial' },
  { value: 'cluster', label: 'Cluster (community)' },
  { value: 'concentric', label: 'Concentric' },
];

export function buildExportLayoutControlHtml(includeSavedOption: boolean): string {
  const opts = LAYOUT_OPTIONS.filter((o) => includeSavedOption || o.value !== 'saved')
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join('');
  return `<div class="layout-inline"><span>Layout</span><select id="${EXPORT_LAYOUT_SELECT_ID}" title="Arrange nodes">${opts}</select></div>`;
}

export function buildExportLayoutPanelCss(): string {
  return `
    .layout-inline { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 11px; color: #94a3b8; width: 100%; }
    .layout-inline select { flex: 1; min-width: 120px; background: rgba(30,41,59,.95); color: #e2e8f0; border: 1px solid rgba(148,163,184,.35); border-radius: 6px; padding: 4px 8px; font-size: 11px; }
  `;
}

export interface ExportLayoutScriptOptions {
  is3d: boolean;
  includeSavedPositions: boolean;
  /** Run after graph.graphData refresh (e.g. restore 3D lights). */
  afterGraphData?: string;
}

/** Inline JS: layout helpers + applyExportLayout (expects graph, data, visual). */
export function buildExportLayoutScript(o: ExportLayoutScriptOptions): string {
  const is3d = o.is3d;
  const resumeSim = is3d
    ? `if (typeof applySimPaused === 'function') { visual.simPaused = false; applySimPaused(); }`
    : `if (typeof applySimPaused2d === 'function') { visual.simPaused = false; applySimPaused2d(); }`;
  const afterGd = o.afterGraphData ? `\n        ${o.afterGraphData}` : '';

  return `
    var exportIs3d = ${is3d ? 'true' : 'false'};
    var exportHasSavedLayout = ${o.includeSavedPositions ? 'true' : 'false'};

    function exportGraphSize() {
      return { width: Math.max(480, window.innerWidth || 900), height: Math.max(360, window.innerHeight || 700) };
    }

    function exportPinNode(node, x, y, z) {
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
      if (exportIs3d) {
        node.z = z != null ? z : 0;
        node.fz = node.z;
      }
    }

    function exportClearNodePins(node) {
      node.fx = null;
      node.fy = null;
      if (exportIs3d) node.fz = null;
    }

    function exportLayoutCircular(nodes, w, h) {
      var cx = w / 2;
      var cy = h / 2;
      var radius = Math.min(w, h) * 0.35;
      for (var i = 0; i < nodes.length; i++) {
        var angle = (2 * Math.PI * i) / nodes.length;
        exportPinNode(nodes[i], cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), 0);
      }
    }

    function exportLayoutGrid(nodes, w, h) {
      var cols = Math.ceil(Math.sqrt(nodes.length)) || 1;
      var cellW = w / (cols + 1);
      var rows = Math.ceil(nodes.length / cols) || 1;
      var cellH = h / (rows + 1);
      for (var i = 0; i < nodes.length; i++) {
        var row = Math.floor(i / cols);
        var col = i % cols;
        exportPinNode(nodes[i], cellW * (col + 1), cellH * (row + 1), 0);
      }
    }

    function exportLayoutRadial(nodes, links, w, h) {
      var cx = w / 2;
      var cy = h / 2;
      var communities = {};
      var keys = [];
      for (var i = 0; i < nodes.length; i++) {
        var key = nodes[i].community_id;
        var sk = key === null || key === undefined ? 'null' : String(key);
        if (!communities[sk]) { communities[sk] = []; keys.push(sk); }
        communities[sk].push(nodes[i]);
      }
      var baseRadius = Math.min(w, h) * 0.25;
      for (var ci = 0; ci < keys.length; ci++) {
        var groupNodes = communities[keys[ci]];
        var groupAngle = (2 * Math.PI * ci) / keys.length;
        var groupCx = cx + baseRadius * Math.cos(groupAngle);
        var groupCy = cy + baseRadius * Math.sin(groupAngle);
        var groupRadius = Math.max(50, groupNodes.length * 15);
        for (var ni = 0; ni < groupNodes.length; ni++) {
          var nodeAngle = (2 * Math.PI * ni) / groupNodes.length;
          var z = exportIs3d ? (ci - keys.length / 2) * 40 : 0;
          exportPinNode(
            groupNodes[ni],
            groupCx + groupRadius * Math.cos(nodeAngle),
            groupCy + groupRadius * Math.sin(nodeAngle),
            z
          );
        }
      }
    }

    function exportLayoutHierarchical(nodes, links, w, h, horizontal) {
      var incoming = {};
      for (var i = 0; i < nodes.length; i++) incoming[nodes[i].id] = 0;
      for (var li = 0; li < links.length; li++) {
        var l = links[li];
        var tgt = typeof l.target === 'object' ? l.target.id : l.target;
        incoming[tgt] = (incoming[tgt] || 0) + 1;
      }
      var levels = {};
      var queue = [];
      var roots = [];
      for (var ri = 0; ri < nodes.length; ri++) {
        if ((incoming[nodes[ri].id] || 0) === 0) roots.push(nodes[ri]);
      }
      if (roots.length === 0 && nodes.length) roots.push(nodes[0]);
      for (var rq = 0; rq < roots.length; rq++) queue.push({ node: roots[rq], level: 0 });
      while (queue.length) {
        var item = queue.shift();
        var node = item.node;
        var level = item.level;
        if (!node || levels[node.id] !== undefined) continue;
        levels[node.id] = level;
        for (var lj = 0; lj < links.length; lj++) {
          var lk = links[lj];
          var src = typeof lk.source === 'object' ? lk.source.id : lk.source;
          var tgt = typeof lk.target === 'object' ? lk.target.id : lk.target;
          if (src === node.id && levels[tgt] === undefined) {
            for (var nk = 0; nk < nodes.length; nk++) {
              if (nodes[nk].id === tgt) {
                queue.push({ node: nodes[nk], level: level + 1 });
                break;
              }
            }
          }
        }
      }
      for (var ni2 = 0; ni2 < nodes.length; ni2++) {
        if (levels[nodes[ni2].id] === undefined) levels[nodes[ni2].id] = 0;
      }
      var levelGroups = {};
      var maxLevel = 0;
      for (var ni3 = 0; ni3 < nodes.length; ni3++) {
        var lvl = levels[nodes[ni3].id];
        if (!levelGroups[lvl]) levelGroups[lvl] = [];
        levelGroups[lvl].push(nodes[ni3]);
        if (lvl > maxLevel) maxLevel = lvl;
      }
      var levelSpacing = horizontal ? w / (maxLevel + 2) : h / (maxLevel + 2);
      for (var lvlKey in levelGroups) {
        if (!Object.prototype.hasOwnProperty.call(levelGroups, lvlKey)) continue;
        var groupNodes = levelGroups[lvlKey];
        var level = Number(lvlKey);
        var nodeSpacing = horizontal ? h / (groupNodes.length + 1) : w / (groupNodes.length + 1);
        for (var gi = 0; gi < groupNodes.length; gi++) {
          var x;
          var y;
          var z = exportIs3d ? level * 55 : 0;
          if (horizontal) {
            x = levelSpacing * (level + 1);
            y = nodeSpacing * (gi + 1);
          } else {
            x = nodeSpacing * (gi + 1);
            y = levelSpacing * (level + 1);
          }
          exportPinNode(groupNodes[gi], x, y, z);
        }
      }
    }

    function exportLayoutConcentric(nodes, w, h) {
      var cx = w / 2;
      var cy = h / 2;
      var sorted = nodes.slice().sort(function (a, b) {
        return (b.connectionCount || 0) - (a.connectionCount || 0);
      });
      var ring = 0;
      var ringCount = 1;
      var ringIndex = 0;
      var baseRadius = 60;
      for (var i = 0; i < sorted.length; i++) {
        var radius = baseRadius + ring * 80;
        var angle = (2 * Math.PI * ringIndex) / ringCount;
        exportPinNode(sorted[i], cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), ring * 25);
        ringIndex++;
        if (ringIndex >= ringCount) {
          ring++;
          ringIndex = 0;
          ringCount = Math.max(1, Math.floor(6 * ring));
        }
      }
    }

    function exportNodesHaveSavedCoords() {
      if (!exportHasSavedLayout) return false;
      for (var i = 0; i < data.nodes.length; i++) {
        var n = data.nodes[i];
        if (n.x != null && n.y != null && isFinite(n.x) && isFinite(n.y)) return true;
      }
      return false;
    }

    function applyExportLayout(mode) {
      var nodes = data.nodes;
      var links = data.links;
      var size = exportGraphSize();
      var w = size.width;
      var h = size.height;
      var layout = mode || 'force';

      if (layout === 'tree') layout = 'hierarchical';
      if (layout === 'tree-horizontal') layout = 'hierarchical-horizontal';
      if (layout === 'cluster') layout = 'radial';

      if (layout === 'force') {
        for (var i = 0; i < nodes.length; i++) exportClearNodePins(nodes[i]);
        ${resumeSim}
        if (typeof graph.d3ReheatSimulation === 'function') graph.d3ReheatSimulation();
        graph.graphData(data);${afterGd}
        setTimeout(function () { graph.zoomToFit(${is3d ? '900' : '500'}, 52); }, ${is3d ? '320' : '280'});
        return;
      }

      if (layout === 'saved') {
        for (var si = 0; si < nodes.length; si++) {
          var sn = nodes[si];
          if (sn.x != null && sn.y != null && isFinite(sn.x) && isFinite(sn.y)) {
            exportPinNode(sn, sn.x, sn.y, sn.z != null && isFinite(sn.z) ? sn.z : 0);
          } else {
            exportClearNodePins(sn);
          }
        }
        graph.graphData(data);${afterGd}
        setTimeout(function () { graph.zoomToFit(${is3d ? '900' : '500'}, 52); }, ${is3d ? '280' : '200'});
        return;
      }

      if (layout === 'circular') exportLayoutCircular(nodes, w, h);
      else if (layout === 'grid') exportLayoutGrid(nodes, w, h);
      else if (layout === 'radial') exportLayoutRadial(nodes, links, w, h);
      else if (layout === 'hierarchical') exportLayoutHierarchical(nodes, links, w, h, false);
      else if (layout === 'hierarchical-horizontal') exportLayoutHierarchical(nodes, links, w, h, true);
      else if (layout === 'concentric') exportLayoutConcentric(nodes, w, h);

      graph.graphData(data);${afterGd}
      setTimeout(function () { graph.zoomToFit(${is3d ? '900' : '500'}, 52); }, ${is3d ? '320' : '200'});
    }

    function initExportLayoutPicker() {
      var sel = $('${EXPORT_LAYOUT_SELECT_ID}');
      if (!sel) return;
      if (exportHasSavedLayout && exportNodesHaveSavedCoords()) sel.value = 'saved';
      else sel.value = 'force';
      sel.addEventListener('change', function () {
        applyExportLayout(this.value);
      });
    }
  `;
}

export function buildExportLayoutBindingsScript(_opts?: { afterRun?: string }): string {
  return `initExportLayoutPicker();`;
}
