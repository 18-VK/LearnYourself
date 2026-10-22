import { beforeAll, describe, expect, it } from 'vitest';
import { b64urlFromString, buf, equalBytes, hex, utf8 } from '../../../src/viz/aspnet/jwt/b64';
import { DIGEST_INFO_SHA256, emsaPkcs1v15, generateDemoKeyPair, parseEm, rsaPublicOp, sha256, traceRs256, type DemoKeyPair } from '../../../src/viz/aspnet/jwt/rs256';
import { NOTES, RSA_SIGN_TEXT, RSA_SIGNING_CREDENTIALS_CODE, RSA_VERIFY_TEXT } from '../../../src/viz/aspnet/sources';
import { noteText } from './helpers';

let server: DemoKeyPair;
let other: DemoKeyPair;
beforeAll(async () => {
  [server, other] = await Promise.all([generateDemoKeyPair('auth server'), generateDemoKeyPair('attacker')]);
}, 60_000);

const NOW = 1_800_000_000;

describe('RS256 building blocks', () => {
  it('uses the SHA-256 DigestInfo prefix from RFC 8017 §9.2', () => {
    expect(hex(DIGEST_INFO_SHA256)).toBe('3031300d060960864801650304020105000420');
  });

  it('pads a hash as 00 01 FF…FF 00 DigestInfo hash', () => {
    const h = Uint8Array.from({ length: 32 }, (_, i) => i);
    const em = emsaPkcs1v15(h, 256);
    expect(em).toHaveLength(256);
    expect([em[0], em[1]]).toEqual([0, 1]);
    expect(em.slice(2, 256 - 51 - 1).every((b) => b === 0xff)).toBe(true);
    expect(em[256 - 52]).toBe(0);
    expect(parseEm(em)).toEqual({ padding: true, digestInfo: true, hash: h });
    expect(parseEm(new Uint8Array(256)).padding).toBe(false);
  });

  it('makes 2048-bit demo keys with e = 65537', () => {
    expect(server.k).toBe(256);
    expect(server.e).toBe(65537n);
    expect(server.n).not.toBe(other.n);
  });

  it("signature ^ e mod n recovers exactly the padded hash Web Crypto signed", async () => {
    const input = `${b64urlFromString('{"alg":"RS256"}')}.${b64urlFromString('{"sub":"1"}')}`;
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', server.privateKey, buf(utf8(input))));
    const em = rsaPublicOp(sig, server);
    expect(equalBytes(em, emsaPkcs1v15(await sha256(utf8(input)), 256))).toBe(true);
    expect(parseEm(rsaPublicOp(sig, other)).padding).toBe(false);
  });
});

describe('RS256 trace', () => {
  it('signs with the private key and verifies with the public key', async () => {
    const t = await traceRs256('valid', server, other, NOW);
    expect(t.map((s) => s.state.focus)).toEqual(['input', 'hash', 'em', 'sign', 'token', 'recompute', 'recover', 'compare']);
    expect(t.map((s) => s.state.phase)).toEqual(['sign', 'sign', 'sign', 'sign', 'sign', 'verify', 'verify', 'verify']);
    const last = t.at(-1)!.state;
    expect(last.valid).toBe(true);
    expect(last.webCryptoValid).toBe(true);
    expect(last.recovered!.hash).toBe(last.hash);
    expect(last.recomputed).toBe(last.hash);
    expect(t.at(-1)!.predict!.answer).toBe(0);
    expect(t.at(-1)!.action).toBe('done');
  });

  it('a payload changed after signing fails: the recovered hash is the signed one, the recomputed hash is not', async () => {
    const t = await traceRs256('tampered', server, other, NOW);
    const last = t.at(-1)!.state;
    expect(last.valid).toBe(false);
    expect(last.webCryptoValid).toBe(false);
    expect(last.recovered!.padding).toBe(true);
    expect(last.recovered!.hash).toBe(last.hash);
    expect(last.recomputed).not.toBe(last.hash);
    expect(last.received).not.toBe(last.token);
  });

  it("a token signed with someone else's private key fails: no padding comes out", async () => {
    const t = await traceRs256('forged', server, other, NOW);
    const last = t.at(-1)!.state;
    expect(last.signer).toBe('attacker');
    expect(last.verifier).toBe('auth server');
    expect(last.recovered!.padding).toBe(false);
    expect(last.valid).toBe(false);
    expect(last.webCryptoValid).toBe(false);
    expect(t.at(-1)!.predict!.answer).toBe(1);
  });

  it("highlights the note's own lines for each step", async () => {
    const t = await traceRs256('valid', server, other, NOW);
    const line = (s: (typeof t)[number]) => s.state.panelLines.map((l) => (s.state.panel === 'sign' ? RSA_SIGN_TEXT : RSA_VERIFY_TEXT).split('\n')[l - 1]!.split('=')[0]!.trim());
    expect(t.map(line)).toEqual([['signing_input'], ['hash'], ['signature'], ['signature'], [], ['recomputed_hash'], ['recovered_hash'], ['recomputed_hash', 'recovered_hash']]);
  });

  it('copies its code from the notes', () => {
    const n10 = noteText(NOTES.auth);
    expect(n10).toContain(RSA_SIGN_TEXT);
    expect(n10).toContain(RSA_VERIFY_TEXT);
    expect(noteText(NOTES.moreAuth)).toContain(RSA_SIGNING_CREDENTIALS_CODE);
  });
});
