'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type MermaidBlockVariant = 'standalone' | 'embedded';

const MermaidRenderContext = createContext<MermaidBlockVariant>('standalone');

/** When true, diagram "open in canvas" is hidden (already inside a canvas/modal viewer). */
const InsideCanvasViewerContext = createContext(false);

export function MermaidRenderProvider({
  variant,
  children,
}: {
  variant: MermaidBlockVariant;
  children: ReactNode;
}) {
  return (
    <MermaidRenderContext.Provider value={variant}>{children}</MermaidRenderContext.Provider>
  );
}

export function InsideCanvasViewerProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <InsideCanvasViewerContext.Provider value={value}>
      {children}
    </InsideCanvasViewerContext.Provider>
  );
}

export function useMermaidBlockVariant(
  propVariant?: MermaidBlockVariant
): MermaidBlockVariant {
  const ctx = useContext(MermaidRenderContext);
  return propVariant ?? ctx;
}

export function useInsideCanvasViewer(): boolean {
  return useContext(InsideCanvasViewerContext);
}
