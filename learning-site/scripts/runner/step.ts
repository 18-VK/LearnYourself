/**
 * The C# runner's part of `npm run build` (called from scripts/content-integration.ts after the content pipeline):
 * publish the browser bundle (scripts/runner/publish.ts), then decide which blocks are runnable and record their
 * output (scripts/runner/check.ts).
 *
 * Without a .NET SDK 10+ the site still builds, just without Run buttons, and a warning says so; with
 * LY_REQUIRE_RUNNER=1 (set in CI) a missing SDK fails the build instead.
 *
 * `npm run runner` runs the same step on its own (useful with `npm run dev`, which doesn't run it).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPracticeCheck } from '../practice/check';
import { runRunnableCheck, writeUnavailable } from './check';
import { findDotnet } from './dotnet';
import { publishRunner } from './publish';

export interface StepLog {
  info: (m: string) => void;
  warn: (m: string) => void;
}

export async function runnerBuildStep(log: StepLog): Promise<{ ok: boolean; errors: string[] }> {
  const required = process.env.LY_REQUIRE_RUNNER === '1';
  const dotnet = findDotnet();
  if (!dotnet) {
    writeUnavailable('No .NET SDK 10+ was found when the site was built.');
    const msg = 'runner: no .NET SDK 10 or newer found, so the C# blocks get no Run buttons. Install it (README, "C# runner") or put a portable SDK in .tools/dotnet.';
    if (required) return { ok: false, errors: [`${msg} LY_REQUIRE_RUNNER=1 makes this an error.`] };
    log.warn(msg);
    // the exercises' data files are still checked (their C# isn't run, and the pages show no exercises)
    const practice = await runPracticeCheck({ log: log.info, verify: false });
    return { ok: practice.ok, errors: practice.errors };
  }
  try {
    await publishRunner({ log: log.info });
    const check = await runRunnableCheck({ log: log.info });
    if (!check.ok) return { ok: false, errors: check.errors };
    // practice mode: every exercise is compiled and run with the same tool (scripts/practice/check.ts)
    const practice = await runPracticeCheck({ log: log.info });
    return { ok: practice.ok, errors: practice.errors };
  } catch (e) {
    return { ok: false, errors: [`runner: ${(e as Error).message}`] };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const r = await runnerBuildStep({ info: (m) => console.log(m), warn: (m) => console.warn(m) });
  for (const e of r.errors) console.error(`• ${e}`);
  process.exit(r.ok ? 0 : 1);
}
