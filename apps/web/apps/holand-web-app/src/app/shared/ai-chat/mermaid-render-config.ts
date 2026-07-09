/**
 * Shared Mermaid init for chat + canvas.
 * Dark palette approximates Cursor / mermaid.live dark (charcoal + cyan accents).
 * `htmlLabels: false` keeps labels as SVG `<text>` for reliable PNG export.
 */

/** PNG / raster export fill — match diagram `background` for each mode */
export function getMermaidExportBackgroundColor(): string {
  if (typeof document === 'undefined') return '#1e1e1e';
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? '#1e1e1e'
    : '#f8f9fa';
}

/** Optional CSS layered on top of themeVariables (flowchart edge labels, clusters). */
function getMermaidThemeCss(isDark: boolean): string {
  if (!isDark) {
    return `
      .cluster rect { fill: #f1f3f5 !important; stroke: #dee2e6 !important; }
      .cluster .cluster-label span { fill: #495057 !important; color: #495057 !important; }
      .edgeLabel .label rect { fill: #ffffff !important; stroke: #dee2e6 !important; }
      .edgeLabel .label span { fill: #343a40 !important; color: #343a40 !important; }
      .nodeLabel, .nodeLabel span, .label text, .node text, text.actor { fill: #212529 !important; color: #212529 !important; }
      .pieCircle { stroke: #dee2e6 !important; }
      .legend rect { fill: #f8f9fa !important; stroke: #dee2e6 !important; }
      text.taskText { fill: #343a40 !important; }
      .section0, .section1, .section2, .section3 { fill: #f1f3f5 !important; }
    `;
  }
  return `
    .cluster rect { fill: #252526 !important; stroke: #3c3c3c !important; }
    .cluster .cluster-label span { fill: #cccccc !important; color: #cccccc !important; }
    .edgeLabel .label rect { fill: #2d2d2d !important; stroke: #454545 !important; }
    .edgeLabel .label span { fill: #e0e0e0 !important; color: #e0e0e0 !important; }
    .nodeLabel, .nodeLabel span, .label text, .node text, text.actor { fill: #e5e7eb !important; color: #e5e7eb !important; }
    .node rect, .node polygon, .node circle { stroke-width: 1px !important; }
    .pieCircle { stroke: #454545 !important; }
    .legend rect { fill: #252526 !important; stroke: #3c3c3c !important; }
    text.taskText { fill: #e0e0e0 !important; }
  `;
}

/** Harmonized pie / section palette (readable in light & dark UI). */
const PIE_PALETTE_LIGHT = [
  '#339af0',
  '#51cf66',
  '#fcc419',
  '#ff6b6b',
  '#845ef7',
  '#22b8cf',
  '#fd7e14',
  '#e64980',
] as const;

const PIE_PALETTE_DARK = [
  '#4dabf7',
  '#69db7c',
  '#ffd43b',
  '#ff8787',
  '#b197fc',
  '#3bc9db',
  '#ffa94d',
  '#f783ac',
] as const;

function pieThemeVars(colors: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  colors.forEach((c, i) => {
    out[`pie${i + 1}`] = c;
  });
  return out;
}

function getAppThemeVariables(isDark: boolean): Record<string, string> {
  const pieVars = pieThemeVars(isDark ? PIE_PALETTE_DARK : PIE_PALETTE_LIGHT);

  if (isDark) {
    return {
      ...pieVars,
      pieTitleTextColor: '#f1f3f5',
      pieSectionTextColor: '#f1f3f5',
      pieLegendTextColor: '#ced4da',
      pieStrokeColor: '#2d2d2d',
      pieStrokeWidth: '1px',
      fontSize: '13px',
      background: '#1e1e1e',
      mainBkg: '#2d2d2d',
      secondBkg: '#252526',
      nodeBkg: '#2d2d2d',
      clusterBkg: '#252526',
      edgeLabelBackground: '#2d2d2d',
      primaryTextColor: '#e0e0e0',
      secondaryTextColor: '#a0a0a0',
      tertiaryTextColor: '#808080',
      textColor: '#e0e0e0',
      titleColor: '#ffffff',
      nodeTextColor: '#e0e0e0',
      lineColor: '#6e6e6e',
      arrowheadColor: '#4ec9e0',
      primaryBorderColor: '#454545',
      secondaryBorderColor: '#3c3c3c',
      tertiaryBorderColor: '#3c3c3c',
      clusterBorder: '#3c3c3c',
      nodeBorder: '#454545',
      defaultLinkColor: '#4ec9e0',
      primaryColor: '#2d2d2d',
      secondaryColor: '#333333',
      tertiaryColor: '#333333',
      actorBkg: '#2d2d2d',
      actorBorder: '#454545',
      actorTextColor: '#e0e0e0',
      actorLineColor: '#6e6e6e',
      signalColor: '#e0e0e0',
      signalTextColor: '#e0e0e0',
      labelBoxBkgColor: '#2d2d2d',
      labelBoxBorderColor: '#454545',
      labelTextColor: '#e0e0e0',
      loopTextColor: '#a0a0a0',
      activationBkgColor: '#333333',
      activationBorderColor: '#454545',
      sequenceNumberColor: '#ffffff',
      noteBkgColor: '#264f78',
      noteTextColor: '#9cdcfe',
      noteBorderColor: '#4ec9e0',
      errorBkgColor: '#5a1d1d',
      errorTextColor: '#f48771',
    };
  }

  return {
    ...pieVars,
    pieTitleTextColor: '#212529',
    pieSectionTextColor: '#212529',
    pieLegendTextColor: '#495057',
    pieStrokeColor: '#ffffff',
    pieStrokeWidth: '1px',
    fontSize: '13px',
    background: '#f8f9fa',
    mainBkg: '#ffffff',
    secondBkg: '#f1f3f5',
    nodeBkg: '#ffffff',
    clusterBkg: '#f1f3f5',
    edgeLabelBackground: '#ffffff',
    primaryTextColor: '#343a40',
    secondaryTextColor: '#495057',
    tertiaryTextColor: '#868e96',
    textColor: '#343a40',
    titleColor: '#212529',
    nodeTextColor: '#343a40',
    lineColor: '#868e96',
    arrowheadColor: '#228be6',
    primaryBorderColor: '#dee2e6',
    secondaryBorderColor: '#ced4da',
    tertiaryBorderColor: '#dee2e6',
    clusterBorder: '#ced4da',
    nodeBorder: '#dee2e6',
    defaultLinkColor: '#228be6',
    primaryColor: '#ffffff',
    secondaryColor: '#f8f9fa',
    tertiaryColor: '#f1f3f5',
    actorBkg: '#ffffff',
    actorBorder: '#dee2e6',
    actorTextColor: '#343a40',
    actorLineColor: '#ced4da',
    signalColor: '#343a40',
    signalTextColor: '#343a40',
    labelBoxBkgColor: '#f8f9fa',
    labelBoxBorderColor: '#dee2e6',
    labelTextColor: '#343a40',
    loopTextColor: '#495057',
    activationBkgColor: '#f1f3f5',
    activationBorderColor: '#dee2e6',
    sequenceNumberColor: '#212529',
    noteBkgColor: '#e7f5ff',
    noteTextColor: '#1864ab',
    noteBorderColor: '#228be6',
    errorBkgColor: '#ffe3e3',
    errorTextColor: '#c92a2a',
  };
}

export function getMermaidChatInitOptions(isDark: boolean) {
  return {
    startOnLoad: false,
    theme: 'base' as const,
    look: 'classic' as const,
    darkMode: isDark,
    themeVariables: getAppThemeVariables(isDark),
    themeCSS: getMermaidThemeCss(isDark),
    securityLevel: 'loose' as const,
    fontFamily: 'inherit',
    flowchart: { useMaxWidth: true, htmlLabels: false, curve: 'basis' as const },
    sequence: { useMaxWidth: true, htmlLabels: false },
    gantt: { useMaxWidth: true, htmlLabels: false },
  };
}
