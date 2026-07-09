/**
 * Ensure Mermaid node labels stay readable inside prose / dark mode.
 * Fixes white-on-white labels when SVG text inherits `currentColor`.
 */

const LIGHT_LABEL = '#212529';
const DARK_LABEL = '#e5e7eb';

function isLightFill(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.toLowerCase().trim();
  return (
    v === '#fff' ||
    v === '#ffffff' ||
    v === 'white' ||
    v === 'rgb(255, 255, 255)' ||
    v === '#f8f9fa' ||
    v === '#ffffff00'
  );
}

/** Patch rendered SVG in the DOM so node labels are visible. */
export function patchMermaidSvgLabels(root: Element | null): void {
  if (!root || typeof document === 'undefined') return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const labelFill = isDark ? DARK_LABEL : LIGHT_LABEL;

  root.querySelectorAll('svg').forEach((svg) => {
    svg.querySelectorAll('text, tspan').forEach((node) => {
      const el = node as SVGElement;
      const fill = el.getAttribute('fill');
      const style = el.getAttribute('style') || '';
      const computedFill =
        typeof window !== 'undefined'
          ? getComputedStyle(el as unknown as Element).fill
          : '';
      const effectiveFill = fill || computedFill;
      if (
        !effectiveFill ||
        effectiveFill === 'currentColor' ||
        effectiveFill === 'none' ||
        isLightFill(effectiveFill) ||
        /fill:\s*(#fff|#ffffff|white|currentcolor)/i.test(style)
      ) {
        el.setAttribute('fill', labelFill);
      }
    });

    svg.querySelectorAll('foreignObject').forEach((fo) => {
      fo.querySelectorAll('div, span, p').forEach((el) => {
        const html = el as HTMLElement;
        html.style.color = labelFill;
      });
    });
  });
}
