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
    return { ok: true, errors: [] };
  }
  try {
    await publishRunner({ log: log.info });
    const check = await runRunnableCheck({ log: log.info });
    return { ok: check.ok, errors: check.errors };
  } catch (e) {
    return { ok: false, errors: [`runner: ${(e as Error).message}`] };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const r = await runnerBuildStep({ info: (m) => console.log(m), warn: (m) => console.warn(m) });
  for (const e of r.errors) console.error(`• ${e}`);
  process.exit(r.ok ? 0 : 1);
}
