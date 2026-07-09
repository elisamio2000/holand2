/**
 * Shared HTML/CSS/JS snippets for interactive 2D and 3D graph exports.
 */

export interface ExportDockConfig {
  includePanelDock: boolean;
  includeSearch: boolean;
  includeLegend: boolean;
  includeInspector: boolean;
  includeControls: boolean;
  includeVisuals?: boolean;
}

export function buildExportPanelCss(): string {
  return `
    .panel-float { position: fixed; z-index: 6; background: rgba(15,23,42,.94); border: 1px solid rgba(148,163,184,.38); border-radius: 12px; backdrop-filter: blur(8px); box-shadow: 0 8px 32px rgba(0,0,0,.45); transition: opacity .2s, transform .2s; }
    .panel-float.collapsed .panel-body { display: none; }
    .panel-float.collapsed .panel-collapse::after { content: '+'; }
    .panel-float.collapsed .panel-collapse { font-size: 14px; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid rgba(71,85,105,.45); }
    .panel-collapse { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }
    .panel-collapse:hover { color: #f8fafc; }
    .panel-body { padding: 10px 12px; }
    .panel-info { top: 12px; left: 12px; max-width: 260px; font-size: 12px; }
    .panel-info h1 { font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 8px; }
    .panel-info .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; opacity: .92; }
    .search-wrap.panel-float { top: 12px; left: 50%; transform: translateX(-50%); min-width: min(380px, 94vw); }
    .search-body { display: flex; flex-direction: column; gap: 8px; }
    .search-body input { width: 100%; padding: 9px 14px; border-radius: 999px; border: 1px solid rgba(148,163,184,.4); background: rgba(30,41,59,.95); color: #f8fafc; font-size: 13px; }
    .search-mode { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #94a3b8; }
    .search-mode select { flex: 1; background: rgba(30,41,59,.95); color: #e2e8f0; border: 1px solid rgba(148,163,184,.35); border-radius: 6px; padding: 4px 8px; font-size: 11px; }
    .controls-wrap.panel-float { bottom: 12px; left: 12px; max-width: min(560px, 96vw); }
    .controls { display: flex; flex-wrap: wrap; gap: 6px; }
    .controls button { padding: 6px 11px; font-size: 11px; border-radius: 8px; border: 1px solid rgba(148,163,184,.4); background: rgba(30,41,59,.95); color: #f1f5f9; cursor: pointer; transition: background .15s, border-color .15s; }
    .controls button:hover { background: rgba(51,65,85,.98); border-color: rgba(96,165,250,.5); }
    .controls button.active { background: rgba(37,99,235,.55); border-color: #60a5fa; color: #fff; }
    .physics-inline { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 11px; color: #94a3b8; }
    .physics-inline input { flex: 1; min-width: 100px; }
    .pivot-opt { display: flex; align-items: center; gap: 8px; font-size: 10px; color: #94a3b8; margin-top: 8px; user-select: none; }
    .pivot-opt input { accent-color: #38bdf8; }
    .legend.panel-float { bottom: 12px; right: 12px; max-height: 42vh; min-width: 150px; }
    .legend-body { max-height: 36vh; overflow-y: auto; font-size: 11px; }
    .legend-item { display: flex; align-items: center; gap: 8px; padding: 3px 0; color: #cbd5e1; }
    .legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
    .inspector.panel-float { top: 72px; right: 12px; width: min(340px, 92vw); max-height: 70vh; z-index: 7; }
    .inspector.panel-float.hidden { display: none; }
    .inspector-inner { display: flex; flex-direction: column; max-height: 62vh; }
    .inspector-h { display: flex; justify-content: space-between; align-items: center; padding: 4px 0 8px; font-size: 13px; font-weight: 600; color: #f8fafc; }
    .inspector-h button { background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; }
    #inspector-body { font-size: 12px; overflow-y: auto; flex: 1; }
    .dock { position: fixed; top: 12px; right: 12px; z-index: 8; display: flex; flex-wrap: wrap; gap: 4px; max-width: 300px; justify-content: flex-end; }
    .dock-btn { padding: 5px 9px; font-size: 10px; border-radius: 999px; border: 1px solid rgba(148,163,184,.35); background: rgba(15,23,42,.9); color: #94a3b8; cursor: pointer; }
    .dock-btn.on { background: rgba(37,99,235,.5); color: #f8fafc; border-color: #60a5fa; }
    .nav-hint { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 4; font-size: 10px; color: rgba(148,163,184,.65); pointer-events: none; white-space: nowrap; }
    .panel-float.hide-panel { opacity: 0; pointer-events: none; transform: translateY(-6px); }
    .row { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(51,65,85,.4); }
    .row .k { color: #94a3b8; }
    .row .v { color: #f8fafc; text-align: right; word-break: break-word; max-width: 58%; font-size: 11px; }
    .sec { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(71,85,105,.5); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #60a5fa; }
    .muted { margin-top: 6px; font-size: 11px; color: #94a3b8; line-height: 1.45; }
  `;
}

export function buildExportDockHtml(c: ExportDockConfig): string {
  if (!c.includePanelDock) return '';
  const btns: string[] = ['<button type="button" class="dock-btn on" data-panel="info">Info</button>'];
  if (c.includeSearch) btns.push('<button type="button" class="dock-btn on" data-panel="search">Search</button>');
  if (c.includeLegend) btns.push('<button type="button" class="dock-btn on" data-panel="legend">Legend</button>');
  if (c.includeInspector) btns.push('<button type="button" class="dock-btn on" data-panel="inspector">Inspector</button>');
  if (c.includeControls) btns.push('<button type="button" class="dock-btn on" data-panel="controls">Controls</button>');
  if (c.includeVisuals) btns.push('<button type="button" class="dock-btn on" data-panel="visuals">Visuals</button>');
  return `<div class="dock" id="dock" title="Show or hide panels">${btns.join('')}</div>`;
}

/** Panel show/hide dock + collapse headers (inline in export HTML). */
export function buildExportPanelInitScript(includeDock: boolean): string {
  const dock = includeDock
    ? `
    document.querySelectorAll('.dock-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-panel');
        var el = document.querySelector('[data-panel-id="' + id + '"]');
        if (!el) return;
        var hide = !el.classList.contains('hide-panel');
        el.classList.toggle('hide-panel', hide);
        btn.classList.toggle('on', !hide);
      });
    });`
    : '';
  return `
    document.querySelectorAll('.panel-collapse').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-collapse');
        var panel = document.querySelector('[data-panel-id="' + id + '"]');
        if (panel) panel.classList.toggle('collapsed');
      });
    });
    ${dock}`;
}

export function buildFloatPanelShell(
  panelId: string,
  title: string,
  bodyHtml: string,
  extraClass = ''
): string {
  return `<div id="${panelId}" class="panel-float ${extraClass}" data-panel-id="${panelId}">
    <div class="panel-head"><span>${title}</span><button type="button" class="panel-collapse" data-collapse="${panelId}">−</button></div>
    <div class="panel-body">${bodyHtml}</div>
  </div>`;
}

/** Search input id (panel wrapper uses id="search"; input must not duplicate). */
export const EXPORT_SEARCH_INPUT_ID = 'graph-search-input';

export function buildExportSearchInputHtml(extras: string): string {
  return `<input type="search" id="${EXPORT_SEARCH_INPUT_ID}" placeholder="Search graph…" autocomplete="off" />${extras}`;
}

/**
 * Search matching + highlight/dim/hide visibility (expects graph, data, highlights, searchFocus, communityReports).
 */
export function buildExportSearchCoreScript(): string {
  const inputId = EXPORT_SEARCH_INPUT_ID;
  return `
    function exportSearchQuery() {
      var si = $('${inputId}');
      return si ? (si.value || '').trim().toLowerCase() : '';
    }
    function exportSearchActive(q) {
      return ((q != null ? q : exportSearchQuery()) || '').length >= 2;
    }
    function exportLinkEndpoints(l) {
      return {
        s: typeof l.source === 'object' ? l.source.id : l.source,
        t: typeof l.target === 'object' ? l.target.id : l.target
      };
    }
    function exportLinkTouchesHighlight(l) {
      var ep = exportLinkEndpoints(l);
      return highlights.indexOf(ep.s) >= 0 && highlights.indexOf(ep.t) >= 0;
    }
    function nodeMatchesCommunityReportSearch(n, q) {
      if (!q || n.community_id == null || !communityReports || !communityReports.length) return false;
      for (var ri = 0; ri < communityReports.length; ri++) {
        var rep = communityReports[ri];
        if (!rep || rep.community_id !== n.community_id) continue;
        var blob = [rep.title, rep.summary, rep.rating_explanation];
        if (rep.findings && rep.findings.length) {
          for (var fi = 0; fi < rep.findings.length; fi++) {
            var f = rep.findings[fi];
            if (f) { blob.push(f.summary, f.explanation); }
          }
        }
        if (rep.entity_names && rep.entity_names.length) blob = blob.concat(rep.entity_names);
        if (blob.join(' ').toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    }
    function nodeMatchesExportSearch(n, q) {
      if (!q) return false;
      if ((n.label || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((n.type || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((n.id || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((n.description || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((n.origin || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((n.case_id || '').toLowerCase().indexOf(q) >= 0) return true;
      if (n.community_id !== null && n.community_id !== undefined && String(n.community_id).indexOf(q) >= 0) return true;
      if (n.tags && n.tags.length) {
        for (var ti = 0; ti < n.tags.length; ti++) {
          if (String(n.tags[ti]).toLowerCase().indexOf(q) >= 0) return true;
        }
      }
      if (n.properties && typeof n.properties === 'object') {
        try {
          if (JSON.stringify(n.properties).toLowerCase().indexOf(q) >= 0) return true;
        } catch (e) {}
      }
      if (nodeMatchesCommunityReportSearch(n, q)) return true;
      return false;
    }
    function linkMatchesExportSearch(l, q) {
      if (!q) return false;
      if ((l.relation || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((l.description || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((l.id || '').toLowerCase().indexOf(q) >= 0) return true;
      if ((l.origin || '').toLowerCase().indexOf(q) >= 0) return true;
      if (l.properties && typeof l.properties === 'object') {
        try {
          if (JSON.stringify(l.properties).toLowerCase().indexOf(q) >= 0) return true;
        } catch (e) {}
      }
      return false;
    }
    function collectSearchHighlights(q) {
      highlights = [];
      if (!exportSearchActive(q)) return;
      var hitIds = {};
      var fromLinks = {};
      data.links.forEach(function (l) {
        if (!linkMatchesExportSearch(l, q)) return;
        var ep = exportLinkEndpoints(l);
        fromLinks[ep.s] = true;
        fromLinks[ep.t] = true;
      });
      data.nodes.forEach(function (n) {
        if (nodeMatchesExportSearch(n, q) || fromLinks[n.id]) hitIds[n.id] = true;
      });
      highlights = Object.keys(hitIds);
    }
    function exportLinkColorForSearch(l) {
      var q = exportSearchQuery();
      if (!exportSearchActive(q)) return linkColorFaded2d(l);
      if (searchFocus === 'dim' && !exportLinkTouchesHighlight(l)) return 'rgba(71,85,105,0.12)';
      return linkColorFaded2d(l);
    }
    function applyExportSearchVisibility(q) {
      var active = exportSearchActive(q);
      if (typeof graph.nodeVisibility === 'function') {
        if (!active || searchFocus !== 'hide') graph.nodeVisibility(true);
        else graph.nodeVisibility(function (n) { return highlights.indexOf(n.id) >= 0; });
      }
      if (typeof graph.linkVisibility === 'function') {
        if (!active || searchFocus !== 'hide') graph.linkVisibility(true);
        else graph.linkVisibility(function (l) { return exportLinkTouchesHighlight(l); });
      }
    }
    function clearExportSearchInput() {
      var si = $('${inputId}');
      if (si) si.value = '';
    }
  `;
}

/** Wire search input + focus select (call after graph exists). */
export function buildExportSearchBindingsScript(afterRunSearch: string): string {
  const inputId = EXPORT_SEARCH_INPUT_ID;
  return `
    function runSearch(q) {
      q = (q != null ? q : exportSearchQuery()).trim().toLowerCase();
      collectSearchHighlights(q);
      applyExportSearchVisibility(q);
      ${afterRunSearch}
    }
    var searchInput = $('${inputId}');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        runSearch((this.value || '').trim().toLowerCase());
      });
    }
    var sf = $('search-focus');
    if (sf) sf.addEventListener('change', function () {
      searchFocus = this.value || 'highlight';
      runSearch(exportSearchQuery());
    });
  `;
}

/** Shared color helpers injected before graph init (expects global typeColors, relationColors, communityColors, highlights, visual). */
export function buildExportColorHelpersScript(): string {
  return `
    function resolveNodeColor(n) {
      if (highlights.indexOf(n.id) >= 0) return '#fbbf24';
      if (visual.colorByCommunity && n.community_id !== null && n.community_id !== undefined) {
        var cid = Number(n.community_id);
        if (!isNaN(cid)) return communityColors[Math.abs(cid) % communityColors.length];
      }
      return typeColors[n.type] || typeColors.default;
    }
    function resolveLinkColorHex(l) {
      return relationColors[l.relation] || relationColors.default;
    }
    function linkColorFadedAlpha(l, alpha) {
      var hex = resolveLinkColorHex(l);
      if (!hex || hex.charAt(0) !== '#') return 'rgba(148,163,184,' + alpha + ')';
      var h = hex.length === 9 ? hex.slice(0, 7) : hex;
      var r = parseInt(h.slice(1, 3), 16);
      var g = parseInt(h.slice(3, 5), 16);
      var b = parseInt(h.slice(5, 7), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(148,163,184,' + alpha + ')';
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    /** 2D canvas — soft stroke; honors visualSettings.linkOpacityBase when present. */
    function linkColorFaded2d(l) {
      var a = (typeof visualSettings !== 'undefined' && visualSettings.linkOpacityBase != null)
        ? visualSettings.linkOpacityBase : 0.33;
      return linkColorFadedAlpha(l, a);
    }
    /** 3D WebGL — soft links matching reference export (alpha 0.42 + linkOpacity 0.5). */
    function linkColorFaded3d(l) {
      return linkColorFadedAlpha(l, 0.42);
    }
    function linkColorFaded(l) {
      return linkColorFadedAlpha(l, 0.42);
    }
  `;
}

/** 3D: orbit via rAF (works when physics paused); pause only stops d3 simulation. */
export function buildExport3dSimOrbitScript(): string {
  return `
    var orbitRafId = null;
    var defaultCooldown = 15000;

    function stopOrbit() {
      if (orbitRafId != null) {
        cancelAnimationFrame(orbitRafId);
        orbitRafId = null;
      }
    }

    function orbitStep() {
      if (!visual.autoRotate) {
        orbitRafId = null;
        return;
      }
      if (typeof graph.resumeAnimation === 'function') graph.resumeAnimation();
      var cam = graph.camera && graph.camera();
      if (cam && cam.position) {
        var angle = 0.0032;
        var x = cam.position.x;
        var z = cam.position.z;
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        graph.cameraPosition({
          x: x * cos - z * sin,
          y: cam.position.y,
          z: x * sin + z * cos
        }, null, 0);
      }
      orbitRafId = requestAnimationFrame(orbitStep);
    }

    function startOrbit() {
      stopOrbit();
      if (visual.autoRotate) orbitRafId = requestAnimationFrame(orbitStep);
    }

    function applySimPaused() {
      if (visual.simPaused) {
        graph.cooldownTime(0);
        var sim = graph.d3Simulation && graph.d3Simulation();
        if (sim && typeof sim.stop === 'function') sim.stop();
        if (sim && typeof sim.alpha === 'function') sim.alpha(0);
      } else {
        if (typeof graph.cooldownTime === 'function') graph.cooldownTime(defaultCooldown);
        if (typeof graph.d3ReheatSimulation === 'function') graph.d3ReheatSimulation();
      }
      if (typeof graph.resumeAnimation === 'function') graph.resumeAnimation();
    }

    function toggleSimPause() {
      visual.simPaused = !visual.simPaused;
      applySimPaused();
      syncToggleButtons();
    }

    function toggleOrbit() {
      visual.autoRotate = !visual.autoRotate;
      if (visual.autoRotate) startOrbit();
      else stopOrbit();
      syncToggleButtons();
    }
  `;
}

/** 2D: pause physics without killing canvas redraw. */
export function buildExport2dSimPauseScript(): string {
  return `
    function applySimPaused2d() {
      if (visual.simPaused) {
        graph.cooldownTime(0);
        var sim = graph.d3Simulation && graph.d3Simulation();
        if (sim && typeof sim.stop === 'function') sim.stop();
        if (sim && typeof sim.alpha === 'function') sim.alpha(0);
      } else {
        if (typeof graph.cooldownTime === 'function') graph.cooldownTime(Infinity);
        if (typeof graph.d3ReheatSimulation === 'function') graph.d3ReheatSimulation();
      }
    }
    function toggleSimPause2d() {
      visual.simPaused = !visual.simPaused;
      applySimPaused2d();
      var bp = $('btn-pause');
      if (bp) bp.textContent = visual.simPaused ? 'Play' : 'Pause';
      if (bp) bp.classList.toggle('active', visual.simPaused);
    }
  `;
}
