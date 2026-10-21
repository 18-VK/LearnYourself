import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** learning-site/ */
export const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The repository root that holds the notes. */
export const REPO_ROOT = path.resolve(SITE_ROOT, '..');
export const CURRICULUM_DIR = path.join(SITE_ROOT, 'curriculum');
export const OUT_LESSONS = path.join(SITE_ROOT, 'src', 'content', 'lessons');
export const OUT_LANDING = path.join(SITE_ROOT, 'src', 'content', 'landing');
export const OUT_DATA = path.join(SITE_ROOT, 'src', 'data', 'generated');
export const OUT_PUBLIC = path.join(SITE_ROOT, 'public', 'generated');
export const COVERAGE_REPORT = path.join(SITE_ROOT, 'coverage-report.md');

/** Repo-relative POSIX path → absolute OS path. */
export const abs = (rel: string): string => path.join(REPO_ROOT, ...rel.split('/'));
/** Absolute OS path → repo-relative POSIX path. */
export const rel = (absPath: string): string => path.relative(REPO_ROOT, absPath).split(path.sep).join('/');

/** Folders never scanned for notes. */
export const SKIP_DIRS = new Set(['bin', 'obj', '.git', '.github', '.vs', '.vscode', 'node_modules', 'learning-site']);
/** Files that are not notes. */
export const SKIP_FILES = new Set(['CLAUDE.md', 'WEBSITE_BUILD_PROMPT.md']);
