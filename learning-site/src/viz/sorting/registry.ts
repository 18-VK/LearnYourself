import type { VizLoader, VizModule } from '../engine/loader';

export const REGISTRY: Record<string, VizLoader> = {
  SortVisualizer: () => import('./SortVisualizer') as Promise<VizModule>,
  SortCompare: () => import('./SortCompare') as Promise<VizModule>,
  SortSummaryTable: () => import('./SortSummaryTable') as Promise<VizModule>,
  StabilityDemo: () => import('./StabilityDemo') as Promise<VizModule>,
};
