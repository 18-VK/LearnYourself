import type { VizLoader } from './engine/loader';
import { REGISTRY as aspnet } from './aspnet/registry';
import { REGISTRY as csharp } from './csharp/registry';
import { REGISTRY as desktop } from './desktop/registry';
import { REGISTRY as dsa } from './dsa/registry';
import { REGISTRY as flow } from './flow/registry';
import { REGISTRY as roadmap } from './roadmap/registry';
import { REGISTRY as searching } from './searching/registry';
import { REGISTRY as sorting } from './sorting/registry';
import { REGISTRY as sql } from './sql/registry';

/**
 * Every visualizer the lessons can place, by the name used in the curriculum manifests. Each area keeps
 * its own list in src/viz/<area>/registry.ts. Names that are placed but not listed anywhere render the
 * note's original text plus a "planned" note.
 */
export const VIZ_REGISTRY: Record<string, VizLoader> = {
  ...sorting,
  ...searching,
  ...dsa,
  ...sql,
  ...csharp,
  ...aspnet,
  ...desktop,
  ...flow,
  ...roadmap,
};
