/**
 * What counts as personal data on this public site. Used by the pre-deploy scan of the built output
 * (scripts/scan-personal.ts, which reports for a human) and by the automatic curriculum
 * (scripts/lib/auto-curriculum.ts, which keeps a brand-new note off the site when it finds something).
 */
export interface Rule {
  id: string;
  label: string;
  severity: 'high' | 'review' | 'info';
  re: RegExp;
  /** Matches that are expected and safe (shown separately, not as findings). */
  benign?: (m: string) => boolean;
}

export const BASE_RULES: Rule[] = [
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

/**
 * The rules strong enough to hold a new note back, each with the tutorial placeholders the notes really use
 * (calibrated on the repo's 160 notes). Those stay visible in the pre-deploy scan; they just don't stop a note.
 * Names are not here on purpose: they come from the local git config, so a local build and CI would disagree.
 */
const HOLD_BACK: Record<string, RegExp | null> = {
  'private-key': null,
  'conn-password': /=\s*(?:strong|my_?pass|test\b|demo\b|sample\b|example\b|change_?me|secret\b|__|\$|@)|\(|string\./i,
  email: /^[a-z]{1,2}@|@x\.com$|^(?:user|name|someone|john|jane|alice|bob|admin|test)\d*@/i,
  'user-path': /[\\/](?:you|your\w*|username|user|name|public|default|admin|example)$/i,
  'home-path': /\/(?:you|user|username|name|app|ubuntu|runner|example)$/i,
  machine: /^\\SQLEXPRESS|^\(localdb\)|ABC|XYZ|EXAMPLE/i,
  secret: /your|example|placeholder/i,
};

export interface PersonalFinding {
  label: string;
  match: string;
  /** 1-based line of the first match. */
  line: number;
}

/** What in this text should keep it off the public site until the owner has looked. */
export function holdBackFindings(text: string): PersonalFinding[] {
  const out: PersonalFinding[] = [];
  for (const rule of BASE_RULES) {
    const placeholder = HOLD_BACK[rule.id];
    if (placeholder === undefined) continue;
    for (const m of text.matchAll(rule.re)) {
      if (rule.benign?.(m[0]) || placeholder?.test(m[0])) continue;
      out.push({ label: rule.label, match: m[0], line: text.slice(0, m.index).split('\n').length });
      break; // one match per rule is enough to explain the hold
    }
  }
  return out;
}
