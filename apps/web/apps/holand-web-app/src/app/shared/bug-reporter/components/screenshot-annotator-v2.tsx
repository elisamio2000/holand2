'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import { 
  PiArrowDownRightBold, 
  PiPencilSimpleLineBold, 
  PiRectangleBold, 
  PiPaintBrushBold,
  PiArrowCounterClockwiseBold,
  PiArrowClockwiseBold,
  PiCheckBold,
  PiTrashBold
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import getStroke from 'perfect-freehand';
import { AnnotationHistory, type AnnotationAction } from './annotation-history';

type ToolMode = 'pen' | 'arrow' | 'rect' | 'highlighter';

interface ScreenshotAnnotatorV2Props {
  dataUrl: string;
  onAnnotated: (dataUrl: string) => void;
  className?: string;
}

const COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
];

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

export default function ScreenshotAnnotatorV2({ dataUrl, onAnnotated, className }: ScreenshotAnnotatorV2Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<ToolMode>('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  
  const drawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPath = useRef<number[][]>([]);
  const historyRef = useRef(new AnnotationHistory());
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    // Scale factor: displayed size vs actual canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const redraw = useCallback((actions: AnnotationAction[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imgRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0);

    actions.forEach((action) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (action.type === 'path') {
        const stroke = getStroke(action.points, {
          size: action.width * 2,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        });
        const pathData = getSvgPathFromStroke(stroke);
        const path = new Path2D(pathData);
        ctx.fillStyle = action.color;
        ctx.fill(path);
      } else if (action.type === 'arrow') {
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.width;
        ctx.beginPath();
        ctx.moveTo(action.start.x, action.start.y);
        ctx.lineTo(action.end.x, action.end.y);
        ctx.stroke();

        const angle = Math.atan2(action.end.y - action.start.y, action.end.x - action.start.x);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(action.end.x, action.end.y);
        ctx.lineTo(
          action.end.x - headLength * Math.cos(angle - Math.PI / 6),
          action.end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(action.end.x, action.end.y);
        ctx.lineTo(
          action.end.x - headLength * Math.cos(angle + Math.PI / 6),
          action.end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (action.type === 'rect') {
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.width;
        if (action.filled) {
          ctx.fillStyle = action.color + '40';
          ctx.fillRect(action.x, action.y, action.w, action.h);
        }
        ctx.strokeRect(action.x, action.y, action.w, action.h);
      }
    });
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }
    };
    img.src = dataUrl;
  }, [dataUrl]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const pos = getPos(e);
    startPos.current = pos;
    
    if (mode === 'pen' || mode === 'highlighter') {
      currentPath.current = [[pos.x, pos.y, 0.5]];
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const pos = getPos(e);

    if (mode === 'pen' || mode === 'highlighter') {
      currentPath.current.push([pos.x, pos.y, 0.5]);
      const tempActions = [...historyRef.current.getCurrentState(), {
        type: 'path' as const,
        points: currentPath.current,
        color: mode === 'highlighter' ? color + '40' : color,
        width: mode === 'highlighter' ? lineWidth * 3 : lineWidth,
      }];
      redraw(tempActions);
    } else {
      redraw(historyRef.current.getCurrentState());
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';

      if (mode === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(startPos.current.x, startPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (mode === 'rect') {
        const w = pos.x - startPos.current.x;
        const h = pos.y - startPos.current.y;
        ctx.strokeRect(startPos.current.x, startPos.current.y, w, h);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    
    const pos = getPos(e);
    let action: AnnotationAction | null = null;

    if (mode === 'pen' || mode === 'highlighter') {
      if (currentPath.current.length > 0) {
        action = {
          type: 'path',
          points: currentPath.current,
          color: mode === 'highlighter' ? color + '40' : color,
          width: mode === 'highlighter' ? lineWidth * 3 : lineWidth,
        };
      }
      currentPath.current = [];
    } else if (mode === 'arrow') {
      action = {
        type: 'arrow',
        start: startPos.current,
        end: pos,
        color,
        width: lineWidth,
      };
    } else if (mode === 'rect') {
      action = {
        type: 'rect',
        x: startPos.current.x,
        y: startPos.current.y,
        w: pos.x - startPos.current.x,
        h: pos.y - startPos.current.y,
        color,
        width: lineWidth,
        filled: false,
      };
    }

    if (action) {
      historyRef.current.add(action);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
      redraw(historyRef.current.getCurrentState());
    }
  };

  const handleUndo = useCallback(() => {
    const state = historyRef.current.undo();
    if (state) {
      redraw(state);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, [redraw]);

  const handleRedo = useCallback(() => {
    const state = historyRef.current.redo();
    if (state) {
      redraw(state);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, [redraw]);

  const handleClear = () => {
    historyRef.current.clear();
    redraw([]);
    setCanUndo(false);
    setCanRedo(false);
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onAnnotated(canvas.toDataURL('image/png'));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleUndo]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {[
          { mode: 'pen' as const, icon: PiPencilSimpleLineBold, label: t('messages.bugReport.annotate.pen') },
          { mode: 'arrow' as const, icon: PiArrowDownRightBold, label: t('messages.bugReport.annotate.arrow') },
          { mode: 'rect' as const, icon: PiRectangleBold, label: t('messages.bugReport.annotate.rect') },
          { mode: 'highlighter' as const, icon: PiPaintBrushBold, label: 'Highlighter' },
        ].map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.mode}
              type="button"
              onClick={() => setMode(tool.mode)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                mode === tool.mode
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-muted bg-white hover:bg-gray-50 dark:bg-gray-50'
              )}
              title={tool.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        
        <div className="h-6 w-px bg-gray-200" />
        
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setColor(c.value)}
            className={cn(
              'h-9 w-9 rounded-lg transition-all',
              color === c.value ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110'
            )}
            style={{ backgroundColor: c.value }}
            title={c.name}
          />
        ))}

        <div className="h-6 w-px bg-gray-200" />
        
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            canUndo
              ? 'border border-muted bg-white hover:bg-gray-50 dark:bg-gray-50'
              : 'cursor-not-allowed border border-muted bg-gray-100 text-gray-400'
          )}
          title="Undo (Ctrl+Z)"
        >
          <PiArrowCounterClockwiseBold className="h-4 w-4" />
        </button>
        
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            canRedo
              ? 'border border-muted bg-white hover:bg-gray-50 dark:bg-gray-50'
              : 'cursor-not-allowed border border-muted bg-gray-100 text-gray-400'
          )}
          title="Redo (Ctrl+Shift+Z)"
        >
          <PiArrowClockwiseBold className="h-4 w-4" />
        </button>
        
        <button
          type="button"
          onClick={handleClear}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted bg-white hover:bg-gray-50 dark:bg-gray-50"
          title={t('messages.bugReport.annotate.reset')}
        >
          <PiTrashBold className="h-4 w-4" />
        </button>

        <Button
          size="sm"
          variant="solid"
          onClick={handleApply}
          className="ml-auto gap-1.5"
        >
          <PiCheckBold className="h-4 w-4" />
          {t('messages.bugReport.annotate.apply')}
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-muted bg-gray-50 p-4">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { drawing.current = false; }}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className="max-w-full cursor-crosshair touch-none"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
