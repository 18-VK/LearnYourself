import type { VizLoader, VizModule } from '../engine/loader';

/**
 * Visualizers in this area, by the name the curriculum manifests use. Add entries as
 *   Name: () => import('./Name') as Promise<VizModule>,
 * (one per line, in exactly that shape: the smoke tests read these names to know which placements must mount).
 */
export const REGISTRY: Record<string, VizLoader> = {
  SearchVisualizer: () => import('./SearchVisualizer') as Promise<VizModule>,
  GraphSearchVisualizer: () => import('./GraphSearchVisualizer') as Promise<VizModule>,
};
