/**
 * Visual settings panel for interactive exports (node size, link width, opacity sliders).
 * Allows user to adjust rendering in exported HTML without re-exporting.
 */

export interface VisualsPanelConfig {
  is3d: boolean;
  includeNodeSize: boolean;
  includeLinkWidth: boolean;
  includeLinkOpacity: boolean;
  includeNodeOpacity: boolean;
}

const DEFAULT_VISUALS_CFG: VisualsPanelConfig = {
  is3d: true,
  includeNodeSize: true,
  includeLinkWidth: true,
  includeLinkOpacity: true,
  includeNodeOpacity: true,
};

/** CSS for visual settings panel (embedded in export). */
export function buildExportVisualsPanelCss(): string {
  return `
    #visuals-panel .slider-group { margin-bottom: 14px; }
    #visuals-panel .slider-label {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 13px; color: #cbd5e1; margin-bottom: 6px;
    }
    #visuals-panel .slider-label .value { color: #fbbf24; font-weight: 600; }
    #visuals-panel input[type="range"] {
      width: 100%; height: 6px; border-radius: 3px;
      background: rgba(148,163,184,0.2); outline: none;
      -webkit-appearance: none; appearance: none;
    }
    #visuals-panel input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px; border-radius: 50%;
      background: #fbbf24; cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    #visuals-panel input[type="range"]::-moz-range-thumb {
      width: 16px; height: 16px; border-radius: 50%;
      background: #fbbf24; cursor: pointer; border: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
  `;
}

/** HTML for visual settings panel. */
export function buildExportVisualsPanelHtml(cfg: Partial<VisualsPanelConfig> = {}): string {
  const o = { ...DEFAULT_VISUALS_CFG, ...cfg };
  const nodeSlider = o.includeNodeSize
    ? `<div class="slider-group">
        <div class="slider-label">
          <span>Node size</span>
          <span class="value" id="node-size-val">1.0×</span>
        </div>
        <input type="range" id="node-size-slider" min="0.3" max="2.5" step="0.1" value="1.0" />
      </div>`
    : '';

  const linkWidthSlider = o.includeLinkWidth
    ? `<div class="slider-group">
        <div class="slider-label">
          <span>Link width</span>
          <span class="value" id="link-width-val">1.0×</span>
        </div>
        <input type="range" id="link-width-slider" min="0.2" max="3.0" step="0.1" value="1.0" />
      </div>`
    : '';

  const linkOpSlider = o.includeLinkOpacity
    ? `<div class="slider-group">
        <div class="slider-label">
          <span>Link opacity</span>
          <span class="value" id="link-opacity-val">0.50</span>
        </div>
        <input type="range" id="link-opacity-slider" min="0.05" max="1.0" step="0.05" value="0.50" />
      </div>`
    : '';

  const nodeOpSlider = o.includeNodeOpacity
    ? `<div class="slider-group">
        <div class="slider-label">
          <span>Node opacity</span>
          <span class="value" id="node-opacity-val">1.0</span>
        </div>
        <input type="range" id="node-opacity-slider" min="0.1" max="1.0" step="0.05" value="1.0" />
      </div>`
    : '';

  return `${nodeSlider}${linkWidthSlider}${linkOpSlider}${nodeOpSlider}`;
}

/** Script to wire sliders + apply to graph (call after graph initialized). */
export function buildExportVisualsPanelScript(cfg: Partial<VisualsPanelConfig> = {}): string {
  const o = { ...DEFAULT_VISUALS_CFG, ...cfg };
  const is3d = o.is3d;

  return `
    function applyVisualSettings() {
      if (!graph) return;
      ${
        o.includeLinkWidth
          ? `
      if (typeof graph.linkWidth === 'function') {
        graph.linkWidth(function (l) {
          var base = Math.max(0.28, (l.strength || 5) / 8);
          return base * visualSettings.linkWidthMult;
        });
      }
      `
          : ''
      }
      ${
        o.includeLinkOpacity && is3d
          ? `
      // 3d-force-graph linkOpacity takes a NUMBER (not a per-link function).
      if (typeof graph.linkOpacity === 'function') {
        graph.linkOpacity(visualSettings.linkOpacityBase);
      }
      `
          : ''
      }
      ${
        is3d
          ? `
      // Custom node meshes (glow) ignore graph.nodeOpacity / nodeRelSize, so apply
      // directly. Default spheres (glow off) use the library setters.
      if (visual.glow) {
        if (typeof applyNodeVisualSettings === 'function') applyNodeVisualSettings();
      } else {
        ${o.includeNodeSize ? `if (typeof graph.nodeRelSize === 'function') graph.nodeRelSize(6 * visualSettings.nodeSizeMult);` : ''}
        ${o.includeNodeOpacity ? `if (typeof graph.nodeOpacity === 'function') graph.nodeOpacity(visualSettings.nodeOpacityBase);` : ''}
      }
      `
          : ''
      }
      ${
        !is3d
          ? `
      // 2D canvas: link opacity/colors are redrawn from visualSettings on next paint.
      if (typeof graph.linkColor === 'function') graph.linkColor(graph.linkColor());
      if (typeof refreshVisuals2d === 'function') refreshVisuals2d();
      `
          : ''
      }
    }

    ${
      o.includeNodeSize
        ? `
    var nodeSizeSlider = $('node-size-slider');
    var nodeSizeVal = $('node-size-val');
    if (nodeSizeSlider && nodeSizeVal) {
      nodeSizeSlider.addEventListener('input', function () {
        visualSettings.nodeSizeMult = parseFloat(this.value);
        nodeSizeVal.textContent = visualSettings.nodeSizeMult.toFixed(1) + '×';
        applyVisualSettings();
      });
    }
    `
        : ''
    }
    ${
      o.includeLinkWidth
        ? `
    var linkWidthSlider = $('link-width-slider');
    var linkWidthVal = $('link-width-val');
    if (linkWidthSlider && linkWidthVal) {
      linkWidthSlider.addEventListener('input', function () {
        visualSettings.linkWidthMult = parseFloat(this.value);
        linkWidthVal.textContent = visualSettings.linkWidthMult.toFixed(1) + '×';
        applyVisualSettings();
      });
    }
    `
        : ''
    }
    ${
      o.includeLinkOpacity
        ? `
    var linkOpSlider = $('link-opacity-slider');
    var linkOpVal = $('link-opacity-val');
    if (linkOpSlider && linkOpVal) {
      linkOpSlider.addEventListener('input', function () {
        visualSettings.linkOpacityBase = parseFloat(this.value);
        linkOpVal.textContent = visualSettings.linkOpacityBase.toFixed(2);
        applyVisualSettings();
      });
    }
    `
        : ''
    }
    ${
      o.includeNodeOpacity
        ? `
    var nodeOpSlider = $('node-opacity-slider');
    var nodeOpVal = $('node-opacity-val');
    if (nodeOpSlider && nodeOpVal) {
      nodeOpSlider.addEventListener('input', function () {
        visualSettings.nodeOpacityBase = parseFloat(this.value);
        nodeOpVal.textContent = visualSettings.nodeOpacityBase.toFixed(2);
        applyVisualSettings();
      });
    }
    `
        : ''
    }

    // Sync slider positions to current visualSettings, then apply once on load.
    (function () {
      var ns = $('node-size-slider'); if (ns) { ns.value = visualSettings.nodeSizeMult; var nsv = $('node-size-val'); if (nsv) nsv.textContent = visualSettings.nodeSizeMult.toFixed(1) + '×'; }
      var lw = $('link-width-slider'); if (lw) { lw.value = visualSettings.linkWidthMult; var lwv = $('link-width-val'); if (lwv) lwv.textContent = visualSettings.linkWidthMult.toFixed(1) + '×'; }
      var lo = $('link-opacity-slider'); if (lo) { lo.value = visualSettings.linkOpacityBase; var lov = $('link-opacity-val'); if (lov) lov.textContent = visualSettings.linkOpacityBase.toFixed(2); }
      var no = $('node-opacity-slider'); if (no) { no.value = visualSettings.nodeOpacityBase; var nov = $('node-opacity-val'); if (nov) nov.textContent = visualSettings.nodeOpacityBase.toFixed(2); }
      setTimeout(function () { if (typeof applyVisualSettings === 'function') applyVisualSettings(); }, 500);
    })();
  `;
}
