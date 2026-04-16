/**
 * Tree Layout — top-down Sugiyama-style for dependency trees.
 * 
 * Algorithm:
 * 1. BFS from root → assign layers (depth)
 * 2. Barycenter ordering → minimize crossings
 * 3. Assign x-coordinates, center each layer
 * 4. Route edges as cubic Bézier curves
 */

import { Token, Sentence } from './types';

export interface LayoutNode {
  token: Token;
  x: number;
  y: number;
  layer: number;
  width: number;
}

export interface LayoutEdge {
  source: LayoutNode;
  target: LayoutNode;
  deprel: string;
  path: string;  // SVG path d attribute
  labelX: number;
  labelY: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

// ── Config ────────────────────────────────────────────────
const LAYER_HEIGHT = 88;
const SIBLING_GAP = 18;
const NODE_PAD = 14;
const NODE_HEIGHT_NO_GLOSS = 38;
const NODE_HEIGHT_WITH_GLOSS = 52;

function nodeWidth(token: Token): number {
  // Approximate: each character ~8px, min 44px.
  // If a gloss exists, use its length too so the node isn't narrower than the gloss.
  const maxLen = token.gloss
    ? Math.max(token.form.length, token.lemma.length, token.gloss.length)
    : Math.max(token.form.length, token.lemma.length);
  const charW = maxLen * 8;
  return Math.max(44, charW + NODE_PAD * 2);
}

/*
 * Build parent→children map.
 * Returns { children, rootToken }
 */
function buildTree(tokens: Token[]): {
  children: Map<number, number[]>;
  root: Token;
  tokenById: Map<number, Token>;
} {
  const tokenById = new Map(tokens.map(t => [t.id, t]));
  const children = new Map<number, number[]>();
  const root = tokens.find(t => t.head === 0) || tokens[0];

  for (const t of tokens) {
    const p = t.head || 0;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(t.id);
  }
  // Sort children by original order (id)
  for (const ids of children.values()) ids.sort((a, b) => a - b);

  return { children, root, tokenById };
}

/*
 * Assign layers via BFS. Some tokens can be deeper than their siblings
 * when the tree has long non-projective jumps, so we track visited.
 */
function assignLayers(
  rootId: number,
  children: Map<number, number[]>,
  tokenById: Map<number, Token>,
): { layers: Map<number, number>; maxLayer: number } {
  const layers = new Map<number, number>();
  const visited = new Set<number>();
  const queue: [number, number][] = [[rootId, 0]];

  while (queue.length > 0) {
    const [id, layer] = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    layers.set(id, layer);
    for (const c of children.get(id) || []) {
      if (!visited.has(c)) queue.push([c, layer + 1]);
    }
  }

  // Assign orphans to layer 0
  for (const t of tokenById.values()) {
    if (!layers.has(t.id)) layers.set(t.id, 0);
  }

  return { layers, maxLayer: Math.max(...layers.values()) };
}

/*
 * Barycenter ordering — 2-pass (top-down, then bottom-up).
 */
function orderLayers(
  { layers, maxLayer }: { layers: Map<number, number>; maxLayer: number },
  tokens: Token[],
  children: Map<number, number[]>,
  tokenById: Map<number, Token>,
): Map<number, number[]> {
  const layerGroups = new Map<number, number[]>();
  for (const [id, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(id);
  }

  // Helper: position index within a layer
  const posInLayer = (layer: number, id: number): number => {
    const ids = layerGroups.get(layer) || [];
    return ids.indexOf(id);
  };

  // Top-down pass
  for (let l = 1; l <= maxLayer; l++) {
    const ids = layerGroups.get(l) || [];
    ids.sort((a, b) => {
      const pa = tokenById.get(a)?.head ?? 0;
      const pb = tokenById.get(b)?.head ?? 0;
      return posInLayer(l - 1, pa) - posInLayer(l - 1, pb);
    });
  }

  // Bottom-up pass
  for (let l = maxLayer - 1; l >= 0; l--) {
    const ids = layerGroups.get(l) || [];
    ids.sort((a, b) => {
      const ca = children.get(a) || [];
      const cb = children.get(b) || [];
      const avg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((s, c) => s + posInLayer(l + 1, c), 0) / arr.length : 0;
      return avg(ca) - avg(cb);
    });
  }

  return layerGroups;
}

/*
 * Assign x coordinates and center each layer.
 */
function positionLayers(
  layerGroups: Map<number, number[]>,
  tokenById: Map<number, Token>,
) {
  // First pass: assign raw x positions left-to-right
  const x = new Map<number, number>();
  let globalMaxWidth = 0;

  for (const ids of layerGroups.values()) {
    let cx = 0;
    for (const id of ids) {
      const w = nodeWidth(tokenById.get(id)!);
      x.set(id, cx + w / 2);
      cx += w + SIBLING_GAP;
    }
    globalMaxWidth = Math.max(globalMaxWidth, cx - SIBLING_GAP);
  }

  // Second pass: center each layer to the widest extent
  for (const ids of layerGroups.values()) {
    const leftmost = Math.min(...ids.map(id => x.get(id)! - nodeWidth(tokenById.get(id)!) / 2));
    const rightmost = Math.max(...ids.map(id => x.get(id)! + nodeWidth(tokenById.get(id)!) / 2));
    const lw = rightmost - leftmost;
    const offset = (globalMaxWidth - lw) / 2 - leftmost;
    for (const id of ids) x.set(id, x.get(id)! + offset);
  }

  return { x, globalMaxWidth: globalMaxWidth + 60 };
}

/*
 * Generate a smooth cubic Bézier curve from parent bottom to child top.
 */
function edgePath(parentX: number, parentBottom: number, childX: number, childTop: number): string {
  const dy = childTop - parentBottom;
  const midY = parentBottom + dy * 0.5;
  return `M ${parentX} ${parentBottom} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childTop}`;
}

export function layoutSentence(sentence: Sentence): LayoutResult {
  const { tokens } = sentence;
  if (!tokens.length) return { nodes: [], edges: [], width: 0, height: 0 };

  const { children, root, tokenById } = buildTree(tokens);
  const layerInfo = assignLayers(root.id, children, tokenById);
  const layerGroups = orderLayers(layerInfo, tokens, children, tokenById);
  const { x, globalMaxWidth } = positionLayers(layerGroups, tokenById);

  const nodes: LayoutNode[] = [];
  for (const [id, xPos] of x) {
    const t = tokenById.get(id)!;
    const layer = layerInfo.layers.get(id)!;
    nodes.push({
      token: t,
      x: xPos,
      y: layer * LAYER_HEIGHT + 50,
      layer,
      width: nodeWidth(t),
    });
  }

  const edges: LayoutEdge[] = [];
  for (const n of nodes) {
    if (n.token.head === 0) continue;
    const parent = nodes.find(p => p.token.id === n.token.head);
    if (!parent) continue;

    const pBottom = parent.y + 20;
    const cTop = n.y - 20;
    const path = edgePath(parent.x, pBottom, n.x, cTop);
    const midY = (pBottom + cTop) / 2;

    edges.push({
      source: parent,
      target: n,
      deprel: n.token.deprel,
      path,
      labelX: (parent.x + n.x) / 2,
      labelY: midY,
    });
  }

  const height = (layerInfo.maxLayer + 1) * LAYER_HEIGHT + 100;

  return { nodes, edges, width: globalMaxWidth, height };
}