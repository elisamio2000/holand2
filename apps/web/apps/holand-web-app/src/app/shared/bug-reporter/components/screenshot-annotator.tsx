'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';

type ScreenshotAnnotatorProps = {
  dataUrl: string;
  onAnnotated?: (annotatedDataUrl: string) => void;
  className?: string;
};

type DrawMode = 'pen' | 'arrow' | 'rect';

export default function ScreenshotAnnotator({
  dataUrl,
  onAnnotated,
  className,
}: ScreenshotAnnotatorProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<DrawMode>('pen');
  const [color, setColor] = useState('#ef4444');

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 720;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      redraw();
    };
    img.src = dataUrl;
  }, [dataUrl, redraw]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    startRef.current = getPos(e);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const end = getPos(e);
    const { x: x0, y: y0 } = startRef.current;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.fillStyle = color;

    if (mode === 'pen') {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (mode === 'rect') {
      ctx.strokeRect(x0, y0, end.x - x0, end.y - y0);
    } else if (mode === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - y0, end.x - x0);
      const head = 12;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - head * Math.cos(angle - Math.PI / 6),
        end.y - head * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - head * Math.cos(angle + Math.PI / 6),
        end.y - head * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onAnnotated?.(canvas.toDataURL('image/png', 0.9));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        {(['pen', 'arrow', 'rect'] as DrawMode[]).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? 'solid' : 'outline'}
            onClick={() => setMode(m)}
          >
            {t(`messages.bugReport.annotate.${m}`)}
          </Button>
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-muted"
          title={t('messages.bugReport.annotate.color')}
        />
        <Button size="sm" variant="outline" onClick={redraw}>
          {t('messages.bugReport.annotate.reset')}
        </Button>
        <Button size="sm" variant="solid" onClick={handleExport}>
          {t('messages.bugReport.annotate.apply')}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        className="max-w-full cursor-crosshair rounded-lg border border-muted"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          drawingRef.current = false;
        }}
      />
    </div>
  );
}
