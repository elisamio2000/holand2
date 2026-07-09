'use client';

/**
 * Bridges graphRef into react-force-graph-2d. next/dynamic does not reliably
 * forward React refs to the loaded component, so the imperative API (zoom,
 * zoomToFit, d3ReheatSimulation, …) stays null unless ref is passed explicitly.
 */

import { useEffect, type ComponentProps, type MutableRefObject, type RefObject } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

type GraphRef = RefObject<any> | MutableRefObject<any | null> | MutableRefObject<any>;

export type ForceGraph2DBridgeProps = Omit<ComponentProps<typeof ForceGraph2D>, 'ref'> & {
  graphRef: GraphRef;
};

export default function ForceGraph2DBridge({ graphRef, ...props }: ForceGraph2DBridgeProps) {
  useEffect(() => {
    const ref = graphRef;
    return () => {
      try {
        ref.current?.pauseAnimation?.();
      } catch {
        /* instance may already be destroyed */
      }
      (ref as MutableRefObject<unknown | null>).current = null;
    };
  }, [graphRef]);

  return <ForceGraph2D ref={graphRef as never} {...(props as ComponentProps<typeof ForceGraph2D>)} />;
}
