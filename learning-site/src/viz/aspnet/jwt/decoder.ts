import { lineOf } from '../../engine/code';
import type { Step, Trace } from '../../engine/types';
import { ZERO } from '../common/zero';
import { JWT_HEADER_JSON, JWT_SIGNATURE_TEXT } from '../sources';
import { b64urlBreakdown, b64urlDecode, b64urlEncode } from './b64';
import { describeClaims, hmacSha256, parseJwt, type ClaimRow, type ParsedJwt } from './jwt';

/**
 * The JWT decoder's step-through: split → base64url → header → payload → signature → recompute → compare →
 * claims. The HMAC is computed with Web Crypto before the trace is built, so the trace itself is plain data.
 */

/** The note's header (10.ASP_AuthenticationNAuthorisation.md › 1. Header), serialised compactly. */
export const DEMO_HEADER = JSON.stringify(JSON.parse(JWT_HEADER_JSON) as object);

/**
 * The note's example payload (› 2. Payload) with neutral name and email, and times relative to now
 * (the note's exp is iat + 3600: one hour).
 */
export function demoPayload(nowSeconds: number): Record<string, string | number> {
  return {
    sub: '12345',
    name: 'Demo User',
    email: 'demo@example.com',
    role: 'Admin',
    department: 'Engineering',
    exp: nowSeconds + 3600,
    iat: nowSeconds,
    iss: 'https://auth.company.com',
    aud: 'TaskManagementAPI',
  };
}

export type TokenSource = 'demo' | 'edited' | 'resigned' | 'note' | 'pasted';

export type DecoderFocus = 'all' | 'b64' | 'header' | 'payload' | 'signature' | 'recompute' | 'compare' | 'claims';

export interface DecoderState {
  focus: DecoderFocus;
  parsed: ParsedJwt;
  b64: { char: string; value: number; bits: string }[];
  b64Bytes: number[];
  /** base64url of the recomputed HMAC, once computed */
  expected: string | null;
  /** null = can't be checked here (not HS256, or the token is malformed) */
  valid: boolean | null;
  claims: ClaimRow[];
  /** which note snippet the code panel shows, and the lines to highlight */
  panel: 'header' | 'signature' | null;
  panelLines: number[];
}

export type DecoderStep = Step<DecoderState>;

const SIG = {
  hmac: lineOf(JWT_SIGNATURE_TEXT, 'HMACSHA256('),
  input: lineOf(JWT_SIGNATURE_TEXT, 'base64UrlEncode(header)'),
  secret: lineOf(JWT_SIGNATURE_TEXT, 'secret'),
};

export async function traceDecoder(token: string, secret: Uint8Array, nowSeconds: number, source: TokenSource = 'demo'): Promise<Trace<DecoderState>> {
  const parsed = parseJwt(token);
  const steps: DecoderStep[] = [];
  const base: DecoderState = { focus: 'all', parsed, b64: [], b64Bytes: [], expected: null, valid: null, claims: [], panel: null, panelLines: [] };
  let state = base;
  const push = (patch: Partial<DecoderState>, action: DecoderStep['action'], narration: string, variables: Record<string, string | number | boolean> = {}, predict?: DecoderStep['predict']) => {
    state = { ...state, ...patch };
    steps.push({ state, highlights: {}, action, codeLine: 0, narration, variables, counters: ZERO, predict });
  };

  if (parsed.error) {
    push({ focus: 'all' }, 'done', `${parsed.error} A JWT looks like header.payload.signature.`, { parts: parsed.token.split('.').length });
    return steps;
  }
  const h = parsed.header;
  const p = parsed.payload;

  push(
    { focus: 'all' },
    'start',
    `This token has three parts separated by dots: the header, the payload and the signature. Each part is base64url text (${h.raw.length}, ${p.raw.length} and ${parsed.signature.raw.length} characters).`,
    { parts: 3 },
  );

  // base64url, shown on the first 4 characters of the header
  const b64 = b64urlBreakdown(h.raw, 4);
  let bytes: number[] = [];
  try {
    bytes = [...b64urlDecode(h.raw.slice(0, 4))];
  } catch {
    bytes = [];
  }
  const asText = bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
  push(
    { focus: 'b64', b64, b64Bytes: bytes },
    'read',
    b64.length === 4 && bytes.length === 3
      ? `Base64url maps each character to 6 bits: ${b64.map((x) => `${x.char} = ${x.value}`).join(', ')}. Four characters make 24 bits, which is 3 bytes: ${bytes.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ')}, the text ${asText}.${h.raw.startsWith('eyJ') ? ' That is why almost every JWT starts with eyJ: it encodes {" , the start of a JSON object.' : ''}`
      : 'Base64url maps each character to 6 bits; every 4 characters make 3 bytes.',
    { chars: b64.map((x) => x.char).join(''), bytes: bytes.length },
    h.raw.startsWith('eyJ') ? { question: 'Why does almost every JWT start with "eyJ"?', options: ['It is {" in base64url', 'It is a version number', 'It is the encrypted algorithm name'], answer: 0 } : undefined,
  );

  // header
  if (!h.json) {
    push({ focus: 'header' }, 'done', `The header part doesn't decode to a JSON object: ${h.error}`);
    return steps;
  }
  const alg = typeof h.json.alg === 'string' ? h.json.alg : null;
  const isNoteHeader = JSON.stringify(h.json) === DEMO_HEADER;
  push(
    { focus: 'header', panel: isNoteHeader ? 'header' : null, panelLines: isNoteHeader ? ['"alg"', '"typ"', '"kid"'].map((m) => lineOf(JWT_HEADER_JSON, m)) : [] },
    'read',
    `Decoded header: ${h.text}. ${alg ? `alg = ${alg} is the algorithm used for signing` : 'There is no alg'}${'typ' in h.json ? `, typ = ${String(h.json.typ)} is the token type` : ''}${'kid' in h.json ? `, kid = ${String(h.json.kid)} is the key ID (used to match the correct public key in JWKS)` : ''}.`,
    { alg: alg ?? 'missing' },
  );

  // payload
  if (!p.json) {
    push({ focus: 'payload', panel: null, panelLines: [] }, 'done', `The payload part doesn't decode to a JSON object: ${p.error}`);
    return steps;
  }
  const claims = describeClaims(p.json, nowSeconds);
  push(
    { focus: 'payload', panel: null, panelLines: [], claims },
    'read',
    `Decoded payload: ${claims.length} claims (${claims.map((c) => c.name).join(', ')}). Base64url is only an encoding: a JWT is signed, not encrypted, so anyone holding it can read these claims.`,
    { claims: claims.length },
  );

  // signature
  const sigLen = parsed.signature.bytes?.length ?? 0;
  push(
    { focus: 'signature' },
    'read',
    parsed.signature.error
      ? `The signature part isn't valid base64url: ${parsed.signature.error}`
      : `The signature part decodes to ${sigLen} bytes${alg === 'HS256' && sigLen === 32 ? ', the size of an HMAC-SHA256 result' : ''}. It isn't JSON: it is the proof that the header and payload haven't changed since they were signed.`,
    { 'signature bytes': sigLen },
  );

  if (alg !== 'HS256') {
    push(
      { focus: 'recompute', valid: null, panel: 'signature', panelLines: [] },
      'done',
      `alg is ${alg ?? 'missing'}. Checking this signature needs the issuer's key for that algorithm; this decoder only holds the HS256 demo secret, so it can decode the token but not verify it.`,
    );
    return steps;
  }

  const expectedBytes = await hmacSha256(parsed.signingInput, secret);
  const expected = b64urlEncode(expectedBytes);
  const valid = expected === parsed.signature.raw;
  push(
    { focus: 'recompute', expected, panel: 'signature', panelLines: [SIG.hmac, SIG.input, SIG.secret] },
    'call',
    `To verify, the API recomputes HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret) over the token's own first two parts with the demo secret. Result: ${expected.slice(0, 16)}…`,
    { recomputed: `${expected.slice(0, 12)}…` },
  );
  const why: Record<TokenSource, string> = {
    demo: 'The header and payload are exactly what the key holder signed.',
    resigned: 'The token was re-signed with the demo secret after the edit, so the new signature covers the new payload.',
    edited: 'The payload was changed after signing, so its base64url text changed and the recomputed HMAC no longer matches. Without the secret, nobody can produce a matching signature for the new payload.',
    note: "This is the note's example token. The note doesn't give the secret it was signed with, so it can't match the demo secret. (Its signature is the jwt.io sample's, which was computed over a different payload: see CONTENT_ISSUES.md.)",
    pasted: 'A pasted token can only match if it was signed with this page\'s demo secret.',
  };
  push(
    { focus: 'compare', valid, panel: 'signature', panelLines: [SIG.hmac] },
    'compare',
    valid
      ? `The recomputed signature equals the token's signature: valid. ${why[source]}`
      : `The recomputed signature ${expected.slice(0, 10)}… differs from the token's ${parsed.signature.raw.slice(0, 10)}…: invalid, so the API rejects the token with 401. ${why[source]}`,
    { valid },
    { question: "Does the recomputed signature match the token's signature?", options: ['Yes, the token is intact', 'No, the API rejects it'], answer: valid ? 0 : 1 },
  );

  const exp = claims.find((c) => c.name === 'exp');
  push(
    { focus: 'claims', panel: null, panelLines: [] },
    'done',
    `${valid ? 'With the signature valid' : 'Even with a valid signature'}, the API still checks the claims: iss (expected issuer), aud (meant for this API) and exp (${exp?.time ? `${exp.time.iso}, ${exp.time.note}` : 'missing'}).`,
    { exp: exp?.time?.note ?? 'missing' },
  );
  return steps;
}

