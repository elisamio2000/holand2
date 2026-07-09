// ============================================
// Graph Force Worker — D3 Force Simulation in Web Worker
// Offloads expensive force calculations from the main thread
// ============================================

// WHY Web Worker: D3 force simulation is CPU-intensive. For graphs > 1K nodes,
// running it on the main thread causes UI jank. This worker handles all force
// ticking and sends back position updates per frame.

// ─── Message Types ────────────────────────────────────────────────────────────

export interface WorkerNodeData {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  community_id?: number | null;
}

export interface WorkerLinkData {
  source: string;
  target: string;
  strength?: number;
}

export interface WorkerInitMessage {
  type: 'init';
  nodes: WorkerNodeData[];
  links: WorkerLinkData[];
  config: {
    chargeStrength: number;
    linkDistance: number;
    collisionRadius: number;
    alphaDecay: number;
    velocityDecay: number;
  };
}

export interface WorkerUpdateConfigMessage {
  type: 'updateConfig';
  config: Partial<WorkerInitMessage['config']>;
}

export interface WorkerPinMessage {
  type: 'pin';
  nodeId: string;
  x: number;
  y: number;
}

export interface WorkerUnpinMessage {
  type: 'unpin';
  nodeId: string;
}

export interface WorkerStopMessage {
  type: 'stop';
}

export interface WorkerResumeMessage {
  type: 'resume';
}

export interface WorkerReheatMessage {
  type: 'reheat';
  alpha?: number;
}

export type WorkerInMessage =
  | WorkerInitMessage
  | WorkerUpdateConfigMessage
  | WorkerPinMessage
  | WorkerUnpinMessage
  | WorkerStopMessage
  | WorkerResumeMessage
  | WorkerReheatMessage;

export interface WorkerTickMessage {
  type: 'tick';
  /** Float32Array: [x0, y0, x1, y1, ...] interleaved positions */
  positions: Float32Array;
  /** Node IDs in the same order as positions */
  nodeIds: string[];
  alpha: number;
}

export interface WorkerDoneMessage {
  type: 'done';
}

export type WorkerOutMessage = WorkerTickMessage | WorkerDoneMessage;
