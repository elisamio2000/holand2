'use client';

/**
 * Same as force-graph-2d-bridge: explicit graphRef so next/dynamic does not drop ref.
 */

import { useEffect, type ComponentProps, type MutableRefObject, type RefObject } from 'react';
import ForceGraph3D from 'react-force-graph-3d';

type GraphRef = RefObject<any> | MutableRefObject<any | null> | MutableRefObject<any>;

export type ForceGraph3DBridgeProps = Omit<ComponentProps<typeof ForceGraph3D>, 'ref'> & {
  graphRef: GraphRef;
};

export default function ForceGraph3DBridge({ graphRef, ...props }: ForceGraph3DBridgeProps) {
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

  return <ForceGraph3D ref={graphRef as never} {...(props as ComponentProps<typeof ForceGraph3D>)} />;
}
