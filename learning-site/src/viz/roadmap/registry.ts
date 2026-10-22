import type { VizLoader, VizModule } from '../engine/loader';

/**
 * Visualizers in this area, by the name the curriculum manifests use. Add entries as
 *   Name: () => import('./Name') as Promise<VizModule>,
 * (one per line, in exactly that shape: the smoke tests read these names to know which placements must mount).
 * RoadmapGraph is placed by the content pipeline itself at the top of every roadmap lesson (generate.ts).
 */
export const REGISTRY: Record<string, VizLoader> = {
  RoadmapGraph: () => import('./RoadmapGraph') as Promise<VizModule>,
};
