/**
 * Every diagram FlowDiagram can show, by the id the manifests use (`diagram: <id>`). Each one is its own
 * small chunk, loaded only when its placement scrolls into view. tests/unit/flow checks that this list
 * matches the files in this folder and every `diagram:` placement.
 */
import type { FlowDiagramData } from '../types';

type Loader = () => Promise<{ default: FlowDiagramData }>;

export const DIAGRAMS: Record<string, Loader> = {
  'aspnet-architecture': () => import('./aspnet-architecture'),
  'auth-three-parties': () => import('./auth-three-parties'),
  'mvvm-layers': () => import('./mvvm-layers'),
  'sql-server-hierarchy': () => import('./sql-server-hierarchy'),
};
