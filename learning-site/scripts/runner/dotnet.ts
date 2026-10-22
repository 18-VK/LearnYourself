/**
 * Finds the .NET SDK for the C# runner and runs `dotnet` commands.
 * Order: a portable SDK in learning-site/.tools/dotnet (see scripts/local-env.sh), then `dotnet` on PATH.
 * The runner needs SDK 10 or newer (runner/global.json); an older SDK counts as "not available".
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SITE_ROOT } from '../lib/paths';

export const RUNNER_DIR = path.join(SITE_ROOT, 'runner');
export const MIN_SDK_MAJOR = 10;

export interface Dotnet {
  exe: string;
  version: string;
  env: NodeJS.ProcessEnv;
}

export function dotnetEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    // NuGet must not ask questions or fall back to machine-wide caches on another drive
    NUGET_PACKAGES: process.env.NUGET_PACKAGES ?? path.join(SITE_ROOT, '.cache', 'nuget'),
  };
  const portable = path.join(SITE_ROOT, '.tools', 'dotnet');
  if (fs.existsSync(path.join(portable, process.platform === 'win32' ? 'dotnet.exe' : 'dotnet'))) {
    env.DOTNET_ROOT = portable;
    env.PATH = `${portable}${path.delimiter}${env.PATH ?? ''}`;
  }
  return env;
}

let found: Dotnet | null | undefined;

/** The SDK to use, or null when none (or only an older one) is installed. */
export function findDotnet(): Dotnet | null {
  if (found !== undefined) return found;
  const env = dotnetEnv();
  const portable = path.join(SITE_ROOT, '.tools', 'dotnet', process.platform === 'win32' ? 'dotnet.exe' : 'dotnet');
  const exe = fs.existsSync(portable) ? portable : 'dotnet';
  const r = spawnSync(exe, ['--version'], { cwd: RUNNER_DIR, env, encoding: 'utf8', shell: false });
  const version = (r.stdout ?? '').trim();
  const major = Number(version.split('.')[0]);
  found = r.status === 0 && major >= MIN_SDK_MAJOR ? { exe, version, env } : null;
  return found;
}

/** Runs `dotnet <args>` in runner/, streaming output with a prefix. Rejects on a non-zero exit code. */
export function runDotnet(d: Dotnet, args: string[], opts: { quiet?: boolean; cwd?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(d.exe, args, { cwd: opts.cwd ?? RUNNER_DIR, env: d.env, shell: false });
    let out = '';
    const onData = (buf: Buffer) => {
      const text = buf.toString();
      out += text;
      if (!opts.quiet) process.stdout.write(text.replace(/^(?=.)/gm, '  [dotnet] '));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`dotnet ${args.join(' ')} exited with ${code}\n${out.slice(-4000)}`))));
  });
}
