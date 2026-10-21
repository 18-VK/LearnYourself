import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import sharp from 'sharp';
import { abs, OUT_DATA, OUT_PUBLIC } from './paths';
import type { AssetEntry } from './schema';

export interface AssetOut {
  file: string;
  slug: string;
  title: string;
  kind: 'image' | 'pdf' | 'document';
  authorship: string;
  credit: string | null;
  alt: string | null;
  usedBy: string | null;
  /** Paths are relative to the site base (no leading slash). */
  src?: string;
  srcset?: string;
  width?: number;
  height?: number;
  /** For documents: the route that shows the converted, read-only page. */
  page?: string;
}

const ASSET_DIR = path.join(OUT_PUBLIC, 'assets');
const DOC_DIR = path.join(OUT_DATA, 'documents');
const CACHE_FILE = path.join(OUT_PUBLIC, 'assets-cache.json');

/** URL-safe file name: "Modern Wpf Practice Project — Design.pdf" → "modern-wpf-practice-project-design". */
export function assetSlug(rel: string): string {
  const slugify = (s: string) =>
    s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const base = slugify(path.basename(rel).replace(/\.[^.]+$/, ''));
  const parent = slugify(path.basename(path.dirname(rel)));
  return base.length < 4 ? `${parent}-${base}` : base;
}

type Cache = Record<string, { mtime: number; out: AssetOut }>;
const readCache = (): Cache => {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as Cache;
  } catch {
    return {};
  }
};

export async function processAssets(entries: AssetEntry[], _repo: string): Promise<AssetOut[]> {
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  fs.mkdirSync(DOC_DIR, { recursive: true });
  const cache = readCache();
  const next: Cache = {};
  const out: AssetOut[] = [];
  const used = new Set<string>();

  for (const e of entries) {
    const source = abs(e.file);
    const mtime = fs.statSync(source).mtimeMs;
    let slug = assetSlug(e.file);
    while (used.has(slug)) slug += '-2';
    used.add(slug);
    const base: AssetOut = {
      file: e.file,
      slug,
      title: path.basename(e.file).replace(/\.[^.]+$/, ''),
      kind: 'image',
      authorship: e.authorship,
      credit: e.credit ?? null,
      alt: e.alt ?? null,
      usedBy: e.usedBy,
    };
    const hit = cache[e.file];
    if (hit && hit.mtime === mtime && hit.out.slug === slug && outputsExist(hit.out)) {
      next[e.file] = { mtime, out: { ...hit.out, ...base, kind: hit.out.kind } };
      out.push(next[e.file]!.out);
      continue;
    }
    const ext = path.extname(e.file).toLowerCase();
    let result: AssetOut;
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      result = await image(source, base, ext === '.gif');
    } else if (ext === '.pdf') {
      fs.copyFileSync(source, path.join(ASSET_DIR, `${slug}.pdf`));
      result = { ...base, kind: 'pdf', src: `generated/assets/${slug}.pdf` };
    } else if (ext === '.docx') {
      const { value: html } = await mammoth.convertToHtml({ path: source });
      fs.writeFileSync(path.join(DOC_DIR, `${slug}.json`), JSON.stringify({ slug, title: base.title, file: e.file, credit: base.credit, authorship: base.authorship, usedBy: base.usedBy, html }));
      result = { ...base, kind: 'document', page: `documents/${slug}/` };
    } else {
      throw new Error(`Unsupported asset type for ${e.file}`);
    }
    next[e.file] = { mtime, out: result };
    out.push(result);
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(next, null, 2));
  // remove outputs of assets no longer published
  const keep = new Set(out.flatMap((a) => outputFiles(a)));
  for (const f of fs.readdirSync(ASSET_DIR)) if (!keep.has(path.join(ASSET_DIR, f))) fs.rmSync(path.join(ASSET_DIR, f));
  for (const f of fs.readdirSync(DOC_DIR)) if (!keep.has(path.join(DOC_DIR, f))) fs.rmSync(path.join(DOC_DIR, f));
  return out;
}

async function image(source: string, base: AssetOut, animated: boolean): Promise<AssetOut> {
  const meta = await sharp(source, { animated }).metadata();
  const width = meta.width ?? 1200;
  const height = (meta.pageHeight ?? meta.height) ?? 800;
  const isAnimated = animated && (meta.pages ?? 1) > 1;
  const targets = isAnimated ? [Math.min(width, 900)] : [...new Set([640, 1280].filter((w) => w < width).concat(Math.min(width, 1600)))].sort((a, b) => a - b);
  for (const w of targets) {
    await sharp(source, { animated: isAnimated })
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: isAnimated ? 70 : 78, effort: 5 })
      .toFile(path.join(ASSET_DIR, `${base.slug}-${w}.webp`));
  }
  const largest = targets[targets.length - 1]!;
  return {
    ...base,
    kind: 'image',
    src: `generated/assets/${base.slug}-${largest}.webp`,
    srcset: targets.map((w) => `generated/assets/${base.slug}-${w}.webp ${w}w`).join(', '),
    width: largest,
    height: Math.round((height * largest) / width),
  };
}

function outputFiles(a: AssetOut): string[] {
  if (a.kind === 'document') return [path.join(DOC_DIR, `${a.slug}.json`)];
  const rels = a.srcset ? a.srcset.split(', ').map((s) => s.split(' ')[0]!) : a.src ? [a.src] : [];
  return rels.map((r) => path.join(OUT_PUBLIC, ...r.replace(/^generated\//, '').split('/')));
}
function outputsExist(a: AssetOut): boolean {
  return outputFiles(a).every((f) => fs.existsSync(f));
}
