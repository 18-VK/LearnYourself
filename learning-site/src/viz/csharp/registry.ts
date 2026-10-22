import type { VizLoader, VizModule } from '../engine/loader';

/**
 * Visualizers in this area, by the name the curriculum manifests use. Add entries as
 *   Name: () => import('./Name') as Promise<VizModule>,
 * (one per line, in exactly that shape: the smoke tests read these names to know which placements must mount).
 */
export const REGISTRY: Record<string, VizLoader> = {
  StackHeapVisualizer: () => import('./StackHeapVisualizer') as Promise<VizModule>,
  AsyncTimelineVisualizer: () => import('./AsyncTimelineVisualizer') as Promise<VizModule>,
  ThreadInterleavingVisualizer: () => import('./ThreadInterleavingVisualizer') as Promise<VizModule>,
  LinqPipelineVisualizer: () => import('./LinqPipelineVisualizer') as Promise<VizModule>,
  DiLifetimesVisualizer: () => import('./DiLifetimesVisualizer') as Promise<VizModule>,
  EfCoreVisualizer: () => import('./EfCoreVisualizer') as Promise<VizModule>,
  InvocationListVisualizer: () => import('./InvocationListVisualizer') as Promise<VizModule>,
  CallStackVisualizer: () => import('./CallStackVisualizer') as Promise<VizModule>,
};
