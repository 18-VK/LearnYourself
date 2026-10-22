import type { VizLoader, VizModule } from '../engine/loader';

/**
 * Visualizers in this area, by the name the curriculum manifests use. Add entries as
 *   Name: () => import('./Name') as Promise<VizModule>,
 * (one per line, in exactly that shape: the smoke tests read these names to know which placements must mount).
 */
export const REGISTRY: Record<string, VizLoader> = {
  MiddlewarePipelineVisualizer: () => import('./MiddlewarePipelineVisualizer') as Promise<VizModule>,
  JwtDecoderVisualizer: () => import('./JwtDecoderVisualizer') as Promise<VizModule>,
  Rs256Visualizer: () => import('./Rs256Visualizer') as Promise<VizModule>,
  JwtSequenceVisualizer: () => import('./JwtSequenceVisualizer') as Promise<VizModule>,
  RateLimiterVisualizer: () => import('./RateLimiterVisualizer') as Promise<VizModule>,
  RouteMatcherVisualizer: () => import('./RouteMatcherVisualizer') as Promise<VizModule>,
  ModelBindingVisualizer: () => import('./ModelBindingVisualizer') as Promise<VizModule>,
  HttpClientPoolingVisualizer: () => import('./HttpClientPoolingVisualizer') as Promise<VizModule>,
  CorsPreflightVisualizer: () => import('./CorsPreflightVisualizer') as Promise<VizModule>,
  ProblemDetailsVisualizer: () => import('./ProblemDetailsVisualizer') as Promise<VizModule>,
  HttpsHstsVisualizer: () => import('./HttpsHstsVisualizer') as Promise<VizModule>,
  RefreshRotationVisualizer: () => import('./RefreshRotationVisualizer') as Promise<VizModule>,
  CapstoneTraceVisualizer: () => import('./CapstoneTraceVisualizer') as Promise<VizModule>,
};
