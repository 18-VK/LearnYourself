import { describe, expect, it } from 'vitest';
import { b64urlBreakdown, b64urlDecode, b64urlEncode, b64urlFromString, fromUtf8, utf8 } from '../../../src/viz/aspnet/jwt/b64';
import { DEMO_HEADER, demoPayload, traceDecoder } from '../../../src/viz/aspnet/jwt/decoder';
import { CLAIM_MEANING, describeClaims, parseJwt, signHs256, verifyHs256 } from '../../../src/viz/aspnet/jwt/jwt';
import { JWT_HEADER_JSON, JWT_NOTE_TOKEN, JWT_SIGNATURE_TEXT, NOTES } from '../../../src/viz/aspnet/sources';
import { noteText } from './helpers';

const note = noteText(NOTES.auth);
const NOW = 1_800_000_000;
const secret = utf8('a-demo-secret-that-is-32-bytes!!');

describe('base64url', () => {
  it("encodes the note's header exactly as the note shows it", () => {
    expect(b64urlFromString('{"alg":"HS256","typ":"JWT"}')).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(note).toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('round-trips every length and never pads', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      const s = b64urlEncode(bytes);
      expect(s).not.toMatch(/[=+/]/);
      expect([...b64urlDecode(s)]).toEqual([...bytes]);
      expect(s).toBe(Buffer.from(bytes).toString('base64url'));
    }
  });

  it('rejects characters outside the alphabet and impossible lengths', () => {
    expect(() => b64urlDecode('ab+c')).toThrow(/not a base64url character/);
    expect(() => b64urlDecode('abcde')).toThrow();
  });

  it('breaks "eyJh" into 6-bit groups that make the bytes {"a', () => {
    expect(b64urlBreakdown('eyJh', 4)).toEqual([
      { char: 'e', value: 30, bits: '011110' },
      { char: 'y', value: 50, bits: '110010' },
      { char: 'J', value: 9, bits: '001001' },
      { char: 'h', value: 33, bits: '100001' },
    ]);
    expect(fromUtf8(b64urlDecode('eyJh'))).toBe('{"a');
  });
});

describe('HS256', () => {
  it('reproduces the well-known jwt.io sample signature (a known test vector)', async () => {
    const t = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect((await verifyHs256(t, utf8('your-256-bit-secret'))).ok).toBe(true);
  });

  it("shows why the note's example token can't verify: its signature belongs to a different payload", async () => {
    expect(note).toContain(JWT_NOTE_TOKEN);
    const t = parseJwt(JWT_NOTE_TOKEN);
    expect(t.error).toBeNull();
    expect(t.header.json).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(t.payload.json).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1708345123, exp: 1708355123 });
    expect(t.signature.raw).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect((await verifyHs256(t.token, utf8('your-256-bit-secret'))).ok).toBe(false);
  });

  it('a signed demo token verifies; editing the payload breaks it; re-signing fixes it', async () => {
    const token = await signHs256(DEMO_HEADER, demoPayload(NOW), secret);
    expect((await verifyHs256(token, secret)).ok).toBe(true);
    expect((await verifyHs256(token, utf8('another-secret-another-secret-12'))).ok).toBe(false);
    const p = parseJwt(token);
    const edited = `${p.header.raw}.${b64urlFromString(JSON.stringify({ ...p.payload.json, role: 'SuperAdmin' }))}.${p.signature.raw}`;
    expect((await verifyHs256(edited, secret)).ok).toBe(false);
    const resigned = await signHs256(p.header.text!, { ...p.payload.json, role: 'SuperAdmin' }, secret);
    expect((await verifyHs256(resigned, secret)).ok).toBe(true);
  });

  it('parses broken tokens without throwing', () => {
    expect(parseJwt('abc.def').error).toMatch(/three parts/);
    expect(parseJwt('e30.!!!.x').payload.error).toMatch(/not a base64url character/);
    expect(parseJwt(`${b64urlFromString('[]')}.e30.AA`).header.error).toMatch(/not a JSON object/);
  });
});

describe('the demo token follows the note', () => {
  it("uses the note's header and the note's claim names", () => {
    expect(note).toContain(JWT_HEADER_JSON);
    expect(JSON.parse(DEMO_HEADER)).toEqual({ alg: 'HS256', typ: 'JWT', kid: 'abc123' });
    const payload = demoPayload(NOW);
    expect(Object.keys(payload)).toEqual(['sub', 'name', 'email', 'role', 'department', 'exp', 'iat', 'iss', 'aud']);
    expect(Number(payload.exp) - Number(payload.iat)).toBe(1783200000 - 1783196400); // one hour, as in the note
    for (const k of ['sub', 'role', 'department', 'iss', 'aud'] as const) expect(note).toContain(`"${k}": ${JSON.stringify(payload[k])}`);
  });

  it("explains claims with the note's table", () => {
    for (const [claim, meaning] of Object.entries(CLAIM_MEANING)) expect(note).toMatch(new RegExp(`\\| \`${claim}\` \\| ${meaning.replace(/[()]/g, '\\$&')}\\s+\\|`));
    const rows = describeClaims({ exp: NOW - 120, nbf: NOW + 3600, iat: NOW, role: 'Admin' }, NOW);
    expect(rows.map((r) => [r.name, r.meaning, r.time?.bad ?? null])).toEqual([
      ['exp', 'Expiration time', true],
      ['nbf', 'Not valid before', true],
      ['iat', 'Issued at', false],
      ['role', 'Custom claim', null],
    ]);
    expect(rows[0]!.time!.note).toBe('expired 2 min ago');
  });
});

describe('decoder trace', () => {
  it('steps through split → base64url → header → payload → signature → recompute → compare → claims', async () => {
    const token = await signHs256(DEMO_HEADER, demoPayload(NOW), secret);
    const t = await traceDecoder(token, secret, NOW);
    expect(t.map((s) => s.state.focus)).toEqual(['all', 'b64', 'header', 'payload', 'signature', 'recompute', 'compare', 'claims']);
    expect(t.at(-1)!.state.valid).toBe(true);
    expect(t.at(-1)!.action).toBe('done');
    const compare = t.find((s) => s.state.focus === 'compare')!;
    expect(compare.predict!.answer).toBe(0);
    // the code panel highlights the note's signature formula
    const lines = JWT_SIGNATURE_TEXT.split('\n');
    expect(compare.state.panelLines.map((l) => lines[l - 1])).toEqual(['HMACSHA256(']);
    expect(note).toContain(JWT_SIGNATURE_TEXT);
  });

  it('an edited payload fails the comparison and says why', async () => {
    const token = await signHs256(DEMO_HEADER, demoPayload(NOW), secret);
    const p = parseJwt(token);
    const edited = `${p.header.raw}.${b64urlFromString(JSON.stringify({ ...p.payload.json, role: 'Owner' }))}.${p.signature.raw}`;
    const t = await traceDecoder(edited, secret, NOW, 'edited');
    const compare = t.find((s) => s.state.focus === 'compare')!;
    expect(compare.state.valid).toBe(false);
    expect(compare.predict!.answer).toBe(1);
    expect(compare.narration).toMatch(/payload was changed after signing/);
  });

  it("decodes the note's token but cannot verify it", async () => {
    const t = await traceDecoder(JWT_NOTE_TOKEN, secret, NOW, 'note');
    expect(t.at(-1)!.state.valid).toBe(false);
    expect(t.find((s) => s.state.focus === 'compare')!.narration).toMatch(/doesn't give the secret/);
  });

  it('decodes but does not claim to verify other algorithms', async () => {
    const rs = `${b64urlFromString('{"alg":"RS256","typ":"JWT"}')}.${b64urlFromString('{"sub":"1"}')}.AAAA`;
    const t = await traceDecoder(rs, secret, NOW, 'pasted');
    expect(t.at(-1)!.state.valid).toBeNull();
    expect(t.at(-1)!.narration).toMatch(/can decode the token but not verify it/);
  });

  it('stops early on malformed input', async () => {
    const t = await traceDecoder('not-a-token', secret, NOW, 'pasted');
    expect(t).toHaveLength(1);
    expect(t[0]!.narration).toMatch(/three parts/);
  });
});
