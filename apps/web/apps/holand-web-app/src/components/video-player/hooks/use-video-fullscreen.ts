import { useCallback, useEffect, useState } from 'react';

export function useVideoFullscreen(containerRef: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const el = containerRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [containerRef]);

  const enterFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    void el.requestFullscreen?.();
  }, [containerRef]);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen };
}
