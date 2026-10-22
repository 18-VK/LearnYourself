/**
 * Personal-data scan of the built site (dist/) before it goes public — `npm run scan:personal`.
 *
 * GitHub Pages sites are public, so this looks for anything that identifies a person or a machine:
 * emails, names, machine names, local file paths, connection strings, keys/tokens, private IP addresses,
 * plus metadata inside published PDFs and images. It writes personal-data-report.md (gitignored) for a
 * human to review and prints a summary. It never edits anything.
 *
 * Names to look for are read at run time from `git config user.name` / `user.email` and from the
 * LY_SCAN_NAMES environment variable (comma-separated), so no personal name is stored in this repository.
 *
 * Exit code: 0, unless --strict is given and a high-severity finding (private key, password in a
 * connection string) exists.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { SITE_ROOT } from './lib/paths';

const DIST = path.join(SITE_ROOT, 'dist');
const REPORT = path.join(SITE_ROOT, 'personal-data-report.md');
const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.svg', '.txt', '.map', '.webmanifest', '.md']);

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

// ── names to look for (from git config and LY_SCAN_NAMES; never hardcoded) ────────────────
const git = (key: string) => {
  try {
    return execFileSync('git', ['config', key], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};
const nameTokens = new Set<string>();
for (const raw of [git('user.name'), git('user.email').split('@')[0] ?? '', ...(process.env.LY_SCAN_NAMES ?? '').split(',')]) {
  for (const t of raw.split(/[\s._-]+/)) if (t.length >= 3 && /[a-z]/i.test(t)) nameTokens.add(t);
}
const emailDomain = git('user.email').split('@')[1]?.split('.')[0];
if (emailDomain && emailDomain.length >= 3) nameTokens.add(emailDomain);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Rule {
  id: string;
  label: string;
  severity: 'high' | 'review' | 'info';
  re: RegExp;
  /** Matches that are expected and safe (shown separately, not as findings). */
  benign?: (m: string) => boolean;
}
const RULES: Rule[] = [
  { id: 'private-key', label: 'Private key blocks', severity: 'high', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    id: 'conn-password',
    label: 'Passwords in connection strings / config',
    severity: 'high',
    re: /\b(?:Password|Pwd)\s*=\s*[^;"'<\s]{2,}/gi,
    benign: (m) => /=\s*(?:\{|<|\*{3}|your|yourpassword|password|pass@?word|xxx|\.\.\.)/i.test(m),
  },
  {
    id: 'email',
    label: 'Email addresses',
    severity: 'review',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    benign: (m) => /@(?:example\.(?:com|org|net)|test\.com|domain\.com|email\.com|company\.com|contoso\.com|noreply\.github\.com)$/i.test(m) || /\.(?:png|jpe?g|webp|svg|js|css)$/i.test(m),
  },
  { id: 'user-path', label: 'User profile paths (C:\\Users\\<name>)', severity: 'review', re: /[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+[^\\/\s"'<>]+/gi },
  // case-sensitive: "/Home/About" is an MVC route, "/home/alice" is a Linux profile
  { id: 'home-path', label: 'Linux/macOS home paths (/home/<name>, /Users/<name>)', severity: 'review', re: /(?<![\w.])(?:\/home\/[a-z_][a-z0-9_-]*|\/Users\/[a-z][a-z0-9_-]*)/g },
  { id: 'abs-path', label: 'Other absolute Windows paths', severity: 'info', re: /\b[A-Za-z]:\\(?!\\)[^\s"'<>|]{3,}/g },
  { id: 'machine', label: 'Machine / server instance names', severity: 'review', re: /\b(?:LAPTOP|DESKTOP|PC|WIN)-[A-Z0-9]{5,}\b|\\SQLEXPRESS\b|\(localdb\)\\[A-Za-z]+/gi },
  {
    id: 'conn-string',
    label: 'Connection-string parts (server / database / user)',
    severity: 'info',
    re: /\b(?:Server|Data Source|Initial Catalog|Database|User ID|Uid|Trusted_Connection|Integrated Security)\s*=\s*[^;"'<\n]{1,60}/gi,
  },
  { id: 'jwt', label: 'JWT-shaped tokens (check they are demo tokens)', severity: 'review', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'secret', label: 'API keys / secrets assigned in code', severity: 'review', re: /\b(?:api[_-]?key|client[_-]?secret|secret[_-]?key|access[_-]?token)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-/+=]{16,}["']/gi },
  { id: 'private-ip', label: 'Private IP addresses', severity: 'info', re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g },
];
if (nameTokens.size) {
  RULES.push({ id: 'name', label: `Names from git config / LY_SCAN_NAMES (${nameTokens.size} tokens)`, severity: 'review', re: new RegExp(`\\b(?:${[...nameTokens].map(escapeRe).join('|')})\\b`, 'gi') });
}

interface Hit {
  file: string;
  match: string;
  context: string;
}
const hits = new Map<string, Hit[]>();
const benign = new Map<string, Set<string>>();
const meta: string[] = [];

const add = (rule: Rule, file: string, text: string) => {
  for (const m of text.matchAll(rule.re)) {
    const match = m[0];
    if (rule.benign?.(match)) {
      (benign.get(rule.id) ?? benign.set(rule.id, new Set()).get(rule.id)!).add(match);
      continue;
    }
    const i = m.index ?? 0;
    const context = text.slice(Math.max(0, i - 50), i + match.length + 50).replace(/\s+/g, ' ');
    (hits.get(rule.id) ?? hits.set(rule.id, []).get(rule.id)!).push({ file, match, context });
  }
};

const decode = (s: string) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, (x) => x) // scripts kept: inline JSON can hold data too
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

/** Best-effort PDF text: metadata strings plus the contents of Flate-compressed streams. */
function pdfText(buf: Buffer): { text: string; info: string[] } {
  const raw = buf.toString('latin1');
  const info: string[] = [];
  for (const key of ['Author', 'Creator', 'Producer', 'Title', 'Subject', 'Keywords']) {
    const m = new RegExp(`/${key}\\s*\\(([^)]{0,200})\\)`).exec(raw);
    if (m?.[1]) info.push(`${key}: ${m[1]}`);
  }
  const xmp = /<dc:creator>[\s\S]*?<\/dc:creator>/.exec(raw);
  if (xmp) info.push(`XMP creator: ${xmp[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
  const parts: string[] = [raw];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const out = zlib.inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1');
      // text-showing operators: (…) Tj / [(…)] TJ
      parts.push([...out.matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((x) => x[1]).join(''));
    } catch {
      /* not Flate or not text */
    }
  }
  return { text: parts.join('\n'), info };
}

/** WebP/PNG/JPEG metadata chunks that could carry camera, author or location data. */
function imageMeta(buf: Buffer, ext: string): string[] {
  const out: string[] = [];
  const s = buf.toString('latin1');
  if (ext === '.webp' && /EXIF|XMP /.test(s.slice(0, 4096 * 4))) out.push('has EXIF/XMP chunk');
  if ((ext === '.jpg' || ext === '.jpeg') && s.includes('Exif\0\0')) out.push('has EXIF');
  if (ext === '.png' && /(?:tEXt|iTXt|eXIf)/.test(s)) out.push('has text/EXIF chunks');
  return out;
}

let scanned = 0;
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full);
      continue;
    }
    const rel = path.relative(DIST, full).split(path.sep).join('/');
    const ext = path.extname(e.name).toLowerCase();
    if (TEXT_EXT.has(ext)) {
      const text = decode(fs.readFileSync(full, 'utf8'));
      for (const r of RULES) add(r, rel, text);
      scanned++;
    } else if (ext === '.pdf') {
      const { text, info } = pdfText(fs.readFileSync(full));
      for (const r of RULES) add(r, rel, text);
      if (info.length) meta.push(`${rel}: ${info.join(' · ')}`);
      scanned++;
    } else if (['.webp', '.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
      const m = imageMeta(fs.readFileSync(full), ext);
      if (m.length) meta.push(`${rel}: ${m.join(', ')}`);
      scanned++;
    }
  }
};
walk(DIST);

// ── report ───────────────────────────────────────────────────────────────────────────────
const L: string[] = ['# Personal-data scan of dist/', '', `Generated by \`scripts/scan-personal.ts\`. ${scanned} files scanned. Review every "high" and "review" item before publishing.`, ''];
L.push('| Check | Severity | Findings | Distinct values |', '|---|---|---|---|');
for (const r of RULES) {
  const h = hits.get(r.id) ?? [];
  L.push(`| ${r.label} | ${r.severity} | ${h.length} | ${new Set(h.map((x) => x.match)).size} |`);
}
L.push(`| Metadata in PDFs/images | review | ${meta.length} | |`, '');
for (const r of RULES) {
  const h = hits.get(r.id) ?? [];
  if (!h.length) continue;
  L.push(`## ${r.label} (${r.severity})`, '');
  const byValue = new Map<string, Hit[]>();
  for (const x of h) (byValue.get(x.match) ?? byValue.set(x.match, []).get(x.match)!).push(x);
  for (const [value, list] of [...byValue].sort((a, b) => b[1].length - a[1].length)) {
    const files = [...new Set(list.map((x) => x.file))];
    L.push(`- \`${value.replace(/`/g, "'")}\` — ${list.length}× in ${files.length} file(s): ${files.slice(0, 4).join(', ')}${files.length > 4 ? ', …' : ''}`);
    L.push(`  - e.g. “…${list[0]!.context.replace(/`/g, "'").replace(/\|/g, '¦')}…”`);
  }
  L.push('');
}
if (meta.length) L.push('## Metadata in published PDFs and images', '', ...meta.map((m) => `- ${m}`), '');
const benignLines = [...benign].flatMap(([id, set]) => [...set].slice(0, 20).map((v) => `- ${id}: \`${v}\``));
if (benignLines.length) L.push('## Ignored as placeholders / sample values', '', ...benignLines, '');
fs.writeFileSync(REPORT, L.join('\n'));

const high = RULES.filter((r) => r.severity === 'high').reduce((n, r) => n + (hits.get(r.id)?.length ?? 0), 0);
const review = RULES.filter((r) => r.severity === 'review').reduce((n, r) => n + (hits.get(r.id)?.length ?? 0), 0);
console.log(`personal-data scan: ${scanned} files; ${high} high, ${review} to review, ${meta.length} metadata notes → personal-data-report.md`);
if (process.argv.includes('--strict') && high > 0) process.exit(1);
