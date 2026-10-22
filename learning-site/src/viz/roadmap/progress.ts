/** Pure progress logic for RoadmapGraph (unit-tested): which keys a node stands for and how done it is. */
import type { RoadmapNode } from './types';

/**
 * The keys a node's checkbox covers: its own items and every descendant's. A node with no items and no
 * children (a heading with only prose under it) is tracked by its own key.
 */
export function nodeKeys(n: RoadmapNode): string[] {
  const own = n.items.length ? n.items.map((i) => i.key) : n.children.length ? [] : [n.key];
  return [...own, ...n.children.flatMap(nodeKeys)];
}

export interface NodeProgress {
  done: number;
  total: number;
  state: 'done' | 'partial' | 'todo';
}

export function progressOf(keys: string[], ticked: Record<string, boolean>): NodeProgress {
  const done = keys.filter((k) => ticked[k]).length;
  return { done, total: keys.length, state: keys.length && done === keys.length ? 'done' : done ? 'partial' : 'todo' };
}

/** A node is "coming soon" when everything it links to is a planned module (no lesson yet). */
export const comingSoon = (n: RoadmapNode): boolean => n.links.length > 0 && n.links.every((l) => l.planned);

/** Applies a tick to every key (on) or clears them (off). Returns the new map; the input is not changed. */
export function setKeys(ticked: Record<string, boolean>, keys: string[], on: boolean): Record<string, boolean> {
  const next = { ...ticked };
  for (const k of keys) {
    if (on) next[k] = true;
    else delete next[k];
  }
  return next;
}
