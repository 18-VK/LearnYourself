import type { VerbatimCheck } from './engine/loader';
import { VERBATIM as aspnet } from './aspnet/verbatim';
import { VERBATIM as csharp } from './csharp/verbatim';
import { VERBATIM as desktop } from './desktop/verbatim';
import { VERBATIM as dsa } from './dsa/verbatim';
import { VERBATIM as flow } from './flow/verbatim';
import { VERBATIM as roadmap } from './roadmap/verbatim';
import { VERBATIM as searching } from './searching/verbatim';
import { VERBATIM as sorting } from './sorting/verbatim';
import { VERBATIM as sql } from './sql/verbatim';

/** Every code panel copied from a note, checked by the content pipeline on each build. */
export const VERBATIM_CHECKS: VerbatimCheck[] = [...sorting, ...searching, ...dsa, ...sql, ...csharp, ...aspnet, ...desktop, ...flow, ...roadmap];
