import type { ShapeElementResult } from '../../lib/canvas/shape-geometry';
import cn from '@core/utils/class-names';

export function renderShapeSvgElement(el: ShapeElementResult, selected?: boolean) {
  const cls = cn(selected && 'drop-shadow-md');
  switch (el.type) {
    case 'ellipse':
      return <ellipse {...el.attrs} className={cls} />;
    case 'polygon':
      return <polygon {...el.attrs} className={cls} />;
    case 'path':
      return <path {...el.attrs} className={cls} />;
    default:
      return <rect {...el.attrs} className={cls} />;
  }
}
