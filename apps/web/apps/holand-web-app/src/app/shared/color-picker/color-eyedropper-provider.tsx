'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { sampleColorAtPoint } from './lib/color-sample';
import { resolveDisplayHex } from './lib/color-utils';

type EyedropperResolve = (hex: string | null) => void;

const ColorEyedropperContext = createContext<(() => Promise<string | null>) | null>(null);

export function useColorEyedropper() {
  return useContext(ColorEyedropperContext);
}

const LOUPE_SIZE_PX = 72;
const LOUPE_RADIUS_PX = LOUPE_SIZE_PX / 2;

function ColorEyedropperOverlay({ onFinish }: { onFinish: (hex: string | null) => void }) {
  const { t } = useTranslation();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState('#94a3b8');
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const onMove = (e: PointerEvent) => {
      if (!activeRef.current) return;
      setPos({ x: e.clientX, y: e.clientY });
      const hex = sampleColorAtPoint(e.clientX, e.clientY);
      if (hex) setPreview(hex);
    };
    const onDown = (e: PointerEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      activeRef.current = false;
      const hex = sampleColorAtPoint(e.clientX, e.clientY);
      onFinish(hex);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activeRef.current = false;
        onFinish(null);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('keydown', onKey);
    return () => {
      activeRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('keydown', onKey);
    };
  }, [onFinish]);

  return (
    <div
      data-color-picker-eyedropper
      data-color-picker-eyedropper-skip
      className="pointer-events-none fixed inset-0 z-[10050] cursor-crosshair"
      style={{ touchAction: 'none' }}
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
        <div className="rounded-full bg-gray-900/80 px-3 py-1 text-xs text-white shadow-lg">
          {t('colorPicker.eyedropperHint')}
        </div>
      </div>
      <div
        className="pointer-events-none fixed z-[10051]"
        style={{ left: pos.x, top: pos.y }}
        aria-hidden
      >
        <div
          className="absolute"
          style={{
            width: LOUPE_SIZE_PX,
            height: LOUPE_SIZE_PX,
            left: 0,
            top: 0,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="relative size-full rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.25)]"
            style={{ backgroundColor: resolveDisplayHex(preview) }}
          >
            <div
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }}
            />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/70" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/70" />
            <div className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 border border-white bg-black/50 shadow-sm" />
          </div>
        </div>
        <div
          className="absolute whitespace-nowrap text-center font-mono text-[10px] text-white drop-shadow-md"
          style={{
            left: 0,
            top: LOUPE_RADIUS_PX + 6,
            transform: 'translateX(-50%)',
          }}
        >
          {preview}
        </div>
      </div>
    </div>
  );
}

export function ColorEyedropperProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const resolveRef = useRef<EyedropperResolve | null>(null);

  const startEyedropper = useCallback(() => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
      setActive(true);
    });
  }, []);

  const finish = useCallback((hex: string | null) => {
    setActive(false);
    resolveRef.current?.(hex);
    resolveRef.current = null;
  }, []);

  return (
    <ColorEyedropperContext.Provider value={startEyedropper}>
      {children}
      {active ? <ColorEyedropperOverlay onFinish={finish} /> : null}
    </ColorEyedropperContext.Provider>
  );
}
