import { b64urlDecode, b64urlFromString, b64urlEncode, buf, equalBytes, fromUtf8, utf8 } from './b64';

/**
 * Just enough JWT for the visualizers (RFC 7519 on top of JWS compact serialization, RFC 7515 §7.1):
 * three base64url parts joined by dots. Everything runs locally with Web Crypto on demo keys made in the page.
 * https://www.rfc-editor.org/rfc/rfc7519 · https://www.rfc-editor.org/rfc/rfc7515#section-7.1
 */

export interface DecodedPart {
  raw: string;
  bytes: Uint8Array | null;
  text: string | null;
  json: Record<string, unknown> | null;
  error: string | null;
}

export interface ParsedJwt {
  /** the token with whitespace removed */
  token: string;
  header: DecodedPart;
  payload: DecodedPart;
  signature: { raw: string; bytes: Uint8Array | null; error: string | null };
  /** structural error (wrong number of parts) */
  error: string | null;
  signingInput: string;
}

function decodePart(raw: string): DecodedPart {
  try {
    const bytes = b64urlDecode(raw);
    let text: string;
    try {
      text = fromUtf8(bytes);
    } catch {
      return { raw, bytes, text: null, json: null, error: 'These bytes are not valid UTF-8 text.' };
    }
    try {
      const j = JSON.parse(text) as unknown;
      if (!j || typeof j !== 'object' || Array.isArray(j)) return { raw, bytes, text, json: null, error: 'Decoded, but it is not a JSON object.' };
      return { raw, bytes, text, json: j as Record<string, unknown>, error: null };
    } catch {
      return { raw, bytes, text, json: null, error: 'Decoded, but it is not valid JSON.' };
    }
  } catch (e) {
    return { raw, bytes: null, text: null, json: null, error: (e as Error).message };
  }
}

export function parseJwt(input: string): ParsedJwt {
  const token = input.replace(/\s+/g, '');
  const parts = token.split('.');
  const empty: DecodedPart = { raw: '', bytes: null, text: null, json: null, error: 'missing' };
  if (parts.length !== 3) {
    return {
      token,
      header: parts[0] ? decodePart(parts[0]) : empty,
      payload: parts[1] ? decodePart(parts[1]) : empty,
      signature: { raw: parts[2] ?? '', bytes: null, error: 'missing' },
      error: `A JWT has exactly three parts separated by dots; this has ${parts.length}.`,
      signingInput: parts.slice(0, 2).join('.'),
    };
  }
  const [h, p, s] = parts as [string, string, string];
  let sig: ParsedJwt['signature'];
  try {
    sig = { raw: s, bytes: b64urlDecode(s), error: null };
  } catch (e) {
    sig = { raw: s, bytes: null, error: (e as Error).message };
  }
  return { token, header: decodePart(h), payload: decodePart(p), signature: sig, error: null, signingInput: `${h}.${p}` };
}

// ── HS256 (HMAC with SHA-256, RFC 7518 §3.2) ─────────────────────────────────────────────────

export async function hmacSha256(message: string, secret: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(utf8(message))));
}

/** Encodes a header and payload exactly as given (strings are used verbatim, objects are serialised compactly). */
export function encodeParts(header: string | object, payload: string | object): string {
  const h = typeof header === 'string' ? header : JSON.stringify(header);
  const p = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return `${b64urlFromString(h)}.${b64urlFromString(p)}`;
}

export async function signHs256(header: string | object, payload: string | object, secret: Uint8Array): Promise<string> {
  const input = encodeParts(header, payload);
  return `${input}.${b64urlEncode(await hmacSha256(input, secret))}`;
}

export interface Hs256Check {
  ok: boolean;
  expected: string;
  actual: string;
}

/** Recomputes the HMAC over the token's own header.payload and compares it with the token's signature. */
export async function verifyHs256(token: string, secret: Uint8Array): Promise<Hs256Check> {
  const t = parseJwt(token);
  const expected = await hmacSha256(t.signingInput, secret);
  const actual = t.signature.bytes;
  return { ok: Boolean(actual) && equalBytes(expected, actual!), expected: b64urlEncode(expected), actual: t.signature.raw };
}

export function randomSecret(bytes = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(bytes));
}

// ── claims ───────────────────────────────────────────────────────────────────────────────────

/** Registered claims as the note's table describes them (10.ASP_AuthenticationNAuthorisation.md › 2. Payload). */
export const CLAIM_MEANING: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject (user ID)',
  aud: 'Audience (intended API/client)',
  exp: 'Expiration time',
  nbf: 'Not valid before',
  iat: 'Issued at',
  jti: 'Unique token ID',
};
export const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat']);

export interface ClaimRow {
  name: string;
  value: string;
  meaning: string;
  registered: boolean;
  /** for exp / nbf / iat: the time as an ISO string and its state relative to `now` */
  time?: { iso: string; note: string; bad: boolean };
}

export function describeClaims(payload: Record<string, unknown>, nowSeconds: number): ClaimRow[] {
  return Object.entries(payload).map(([name, v]) => {
    const value = typeof v === 'string' ? v : JSON.stringify(v);
    const registered = name in CLAIM_MEANING;
    const row: ClaimRow = { name, value, meaning: CLAIM_MEANING[name] ?? 'Custom claim', registered };
    if (TIME_CLAIMS.has(name) && typeof v === 'number' && Number.isFinite(v)) {
      const iso = new Date(v * 1000).toISOString().replace('.000Z', 'Z');
      const diff = v - nowSeconds;
      const rel = relative(diff);
      if (name === 'exp') row.time = { iso, note: diff > 0 ? `expires ${rel}` : `expired ${rel === 'just now' ? 'just now' : rel}`, bad: diff <= 0 };
      else if (name === 'nbf') row.time = { iso, note: diff > 0 ? `not valid until ${rel}` : `valid since ${rel}`, bad: diff > 0 };
      else row.time = { iso, note: rel === 'just now' ? 'issued just now' : `issued ${rel}`, bad: false };
    }
    return row;
  });
}

function relative(diffSeconds: number): string {
  const a = Math.abs(diffSeconds);
  if (a < 5) return 'just now';
  const unit = a < 120 ? `${Math.round(a)} s` : a < 7200 ? `${Math.round(a / 60)} min` : a < 172800 ? `${Math.round(a / 3600)} h` : `${Math.round(a / 86400)} days`;
  return diffSeconds >= 0 ? `in ${unit}` : `${unit} ago`;
}
