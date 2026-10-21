import type { ComponentType } from 'react';

type Loader = () => Promise<{ default: ComponentType<Record<string, unknown>> }>;

/**
 * Every visualizer the lessons can place, by the name used in the curriculum manifests.
 * Names that are placed but not listed here render the note's original text plus a "planned" note.
 */
export const VIZ_REGISTRY: Record<string, Loader> = {
  SortVisualizer: () => import('./sorting/SortVisualizer') as Promise<{ default: ComponentType<Record<string, unknown>> }>,
  SortCompare: () => import('./sorting/SortCompare') as Promise<{ default: ComponentType<Record<string, unknown>> }>,
  SortSummaryTable: () => import('./sorting/SortSummaryTable') as Promise<{ default: ComponentType<Record<string, unknown>> }>,
  StabilityDemo: () => import('./sorting/StabilityDemo') as Promise<{ default: ComponentType<Record<string, unknown>> }>,
};
