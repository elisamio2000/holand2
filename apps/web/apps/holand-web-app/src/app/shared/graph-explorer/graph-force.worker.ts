// ============================================
// Graph Force Worker — Web Worker Implementation
// Runs D3 force simulation off the main thread
// ============================================

// WHY separate worker file: Next.js/webpack requires the worker code in a
// separate file that can be loaded via `new Worker(new URL(...))`. This file
// imports d3-force directly and runs the simulation loop in the worker context.

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type {
  WorkerInMessage,
  WorkerNodeData,
  WorkerLinkData,
} from './graph-worker.types';

// ─── Worker State ─────────────────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum {
  id: string;
  community_id?: number | null;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  strength?: number;
}

let simulation: ReturnType<typeof forceSimulation<SimNode>> | null = null;
let nodes: SimNode[] = [];
let nodeIds: string[] = [];
let stopped = false;

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      initSimulation(msg.nodes, msg.links, msg.config);
      break;

    case 'updateConfig':
      updateConfig(msg.config);
      break;

    case 'pin':
      pinNode(msg.nodeId, msg.x, msg.y);
      break;

    case 'unpin':
      unpinNode(msg.nodeId);
      break;

    case 'stop':
      stopped = true;
      simulation?.stop();
      break;

    case 'resume':
      stopped = false;
      simulation?.restart();
      break;

    case 'reheat':
      if (simulation && !stopped) {
        simulation.alpha(msg.alpha ?? 0.3).restart();
      }
      break;
  }
};

// ─── Simulation Setup ─────────────────────────────────────────────────────────

function initSimulation(
  rawNodes: WorkerNodeData[],
  rawLinks: WorkerLinkData[],
  config: { chargeStrength: number; linkDistance: number; collisionRadius: number; alphaDecay: number; velocityDecay: number }
) {
  // Clean up previous simulation
  if (simulation) {
    simulation.stop();
    simulation = null;
  }

  nodes = rawNodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    vx: n.vx ?? 0,
    vy: n.vy ?? 0,
    fx: n.fx,
    fy: n.fy,
    community_id: n.community_id,
  }));

  nodeIds = nodes.map((n) => n.id);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const links: SimLink[] = rawLinks
    .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
    .map((l) => ({
      source: nodeMap.get(l.source)!,
      target: nodeMap.get(l.target)!,
      strength: l.strength,
    }));

  stopped = false;

  simulation = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(config.linkDistance)
    )
    .force('charge', forceManyBody<SimNode>().strength(config.chargeStrength))
    .force('center', forceCenter(0, 0))
    .force(
      'collide',
      forceCollide<SimNode>().radius(config.collisionRadius).strength(0.7)
    )
    // WHY X/Y forces: Gently pull nodes toward center to prevent graph from drifting
    .force('x', forceX<SimNode>(0).strength(0.01))
    .force('y', forceY<SimNode>(0).strength(0.01))
    .alphaDecay(config.alphaDecay)
    .velocityDecay(config.velocityDecay)
    .on('tick', onTick)
    .on('end', onEnd);
}

// ─── Tick Handler ─────────────────────────────────────────────────────────────

function onTick() {
  if (stopped || !simulation) return;

  // WHY Float32Array: Transferable buffer — avoids structured clone overhead
  // when posting positions back to the main thread. ~4× faster than JSON.
  const positions = new Float32Array(nodes.length * 2);
  for (let i = 0; i < nodes.length; i++) {
    positions[i * 2] = nodes[i].x ?? 0;
    positions[i * 2 + 1] = nodes[i].y ?? 0;
  }

  self.postMessage(
    {
      type: 'tick',
      positions,
      nodeIds,
      alpha: simulation!.alpha(),
    },
    // Transfer the buffer for zero-copy messaging
    [positions.buffer] as any
  );
}

function onEnd() {
  self.postMessage({ type: 'done' });
}

// ─── Config Updates ───────────────────────────────────────────────────────────

function updateConfig(config: Partial<{
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  alphaDecay: number;
  velocityDecay: number;
}>) {
  if (!simulation) return;

  if (config.chargeStrength !== undefined) {
    simulation.force('charge', forceManyBody<SimNode>().strength(config.chargeStrength));
  }
  if (config.linkDistance !== undefined) {
    const linkForce = simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>> | undefined;
    linkForce?.distance(config.linkDistance);
  }
  if (config.collisionRadius !== undefined) {
    simulation.force(
      'collide',
      forceCollide<SimNode>().radius(config.collisionRadius).strength(0.7)
    );
  }
  if (config.alphaDecay !== undefined) {
    simulation.alphaDecay(config.alphaDecay);
  }
  if (config.velocityDecay !== undefined) {
    simulation.velocityDecay(config.velocityDecay);
  }

  simulation.alpha(0.3).restart();
}

// ─── Node Pin/Unpin ───────────────────────────────────────────────────────────

function pinNode(nodeId: string, x: number, y: number) {
  const node = nodes.find((n) => n.id === nodeId);
  if (node) {
    node.fx = x;
    node.fy = y;
  }
}

function unpinNode(nodeId: string) {
  const node = nodes.find((n) => n.id === nodeId);
  if (node) {
    node.fx = null;
    node.fy = null;
  }
}
