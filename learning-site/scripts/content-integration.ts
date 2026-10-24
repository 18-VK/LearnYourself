import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AstroIntegration } from 'astro';
import { buildContent } from './lib/generate';
import { CURRICULUM_DIR, REPO_ROOT, SITE_ROOT, SKIP_DIRS } from './lib/paths';
import { runnerBuildStep } from './runner/step';
import { runSqlCheck } from './sqlrun/check';

/**
 * Astro caches rendered Markdown by each file's content, not by the remark/rehype plugins that render it.
 * When a plugin changes, drop that cache so every lesson is rendered again.
 */
function resetRenderCacheIfPluginsChanged(): void {
  const dir = path.join(SITE_ROOT, 'src', 'markdown');
  const hash = createHash('sha256');
  for (const f of [...fs.readdirSync(dir).sort().map((f) => path.join(dir, f)), path.join(SITE_ROOT, 'astro.config.ts')]) hash.update(fs.readFileSync(f));
  const digest = hash.digest('hex');
  const marker = path.join(SITE_ROOT, '.astro', 'markdown-plugins.hash');
  const previous = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '';
  if (previous === digest) return;
  // Astro 7 keeps the content cache in node_modules/.astro; older versions used .astro
  fs.rmSync(path.join(SITE_ROOT, 'node_modules', '.astro', 'data-store.json'), { force: true });
  fs.rmSync(path.join(SITE_ROOT, '.astro', 'data-store.json'), { force: true });
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, digest);
}

/**
 * Runs the content pipeline before `astro dev` / `astro build`, and again in dev whenever a note or a
 * curriculum manifest changes. A failed pipeline fails the build (in dev it only logs, so the server
 * keeps running while you fix the note).
 */
export function contentPipeline(): AstroIntegration {
  return {
    name: 'learnyourself-content',
    hooks: {
      'astro:config:setup': async ({ command, logger }) => {
        if (command === 'preview') return;
        resetRenderCacheIfPluginsChanged();
        const result = await buildContent({ mode: command === 'dev' ? 'dev' : 'build', log: (m) => logger.info(m) });
        if (!result.ok) {
          for (const e of result.errors) logger.error(e);
          if (command === 'build') throw new Error(`Content pipeline found ${result.errors.length} problem(s). See the log above and coverage-report.md.`);
        }
        // runnable SQL (sql.js, no SDK needed): which SQL blocks get Run buttons, from the generated lessons
        if (result.ok) {
          const sql = await runSqlCheck({ log: (m) => logger.info(m) });
          for (const e of sql.errors) logger.error(e);
          if (!sql.ok && command === 'build') throw new Error(`The runnable-SQL check found ${sql.errors.length} problem(s). See the log above and sqlrun-report.md.`);
        }
        // C# runner (builds only): publish the browser bundle and decide which C# blocks get Run buttons.
        // Needs the generated lessons, so it runs here, after the pipeline. Skipped with a warning without a .NET SDK.
        if (command === 'build' && result.ok) {
          const runner = await runnerBuildStep({ info: (m) => logger.info(m), warn: (m) => logger.warn(m) });
          for (const e of runner.errors) logger.error(e);
          if (!runner.ok) throw new Error(`The C# runner check found ${runner.errors.length} problem(s). See the log above and runnable-report.md.`);
        }
      },
      'astro:server:setup': ({ server, logger }) => {
        const roots = fs
          .readdirSync(REPO_ROOT, { withFileTypes: true })
          .filter((e) => (e.isDirectory() ? !SKIP_DIRS.has(e.name) && !e.name.startsWith('.') : /\.(md|txt)$/i.test(e.name)))
          .map((e) => path.join(REPO_ROOT, e.name));
        server.watcher.add([...roots, CURRICULUM_DIR]);

        let timer: ReturnType<typeof setTimeout> | undefined;
        let running = false;
        let again = false;
        const rebuild = async () => {
          if (running) {
            again = true;
            return;
          }
          running = true;
          try {
            const r = await buildContent({ mode: 'dev', log: (m) => logger.info(m) });
            for (const e of r.errors) logger.error(e);
            if (r.ok) for (const e of (await runSqlCheck({ log: (m) => logger.info(m) })).errors) logger.error(e);
          } finally {
            running = false;
            if (again) {
              again = false;
              void rebuild();
            }
          }
        };
        server.watcher.on('all', (_event, file) => {
          const inSite = file.startsWith(SITE_ROOT + path.sep);
          const isNote = !inSite && /\.(md|txt)$/i.test(file);
          const isManifest = file.startsWith(CURRICULUM_DIR + path.sep) && /\.ya?ml$/i.test(file);
          if (!isNote && !isManifest) return;
          clearTimeout(timer);
          timer = setTimeout(() => void rebuild(), 250);
        });
      },
    },
  };
}
