import { lineOf } from '../../engine/code';
import type { Step, Trace } from '../../engine/types';
import { ZERO } from '../common/zero';
import { RSA_SIGN_TEXT, RSA_VERIFY_TEXT } from '../sources';
import { b64urlDecode, b64urlEncode, b64urlFromString, bigIntToBytes, buf, bytesToBigInt, equalBytes, hex, modPow, utf8 } from './b64';
import { parseJwt } from './jwt';

/**
 * RS256 = RSASSA-PKCS1-v1_5 with SHA-256 (RFC 7518 §3.3). The note writes it as `signature = hash ^ d mod n`;
 * the real algorithm first wraps the hash in the EMSA-PKCS1-v1_5 encoding (RFC 8017 §9.2):
 *   EM = 0x00 ‖ 0x01 ‖ 0xFF…0xFF ‖ 0x00 ‖ DigestInfo(SHA-256) ‖ hash
 * and signs EM (RSASP1, RFC 8017 §5.2.1). Verification raises the signature to e and checks that the result is
 * exactly that EM (RFC 8017 §8.2.2). The visualizer shows that padding and labels the note's line "simplified".
 * https://www.rfc-editor.org/rfc/rfc7518#section-3.3 · https://www.rfc-editor.org/rfc/rfc8017#section-9.2
 *
 * Keys are generated in the page with Web Crypto (2048-bit, as the note's `openssl genrsa ... 2048`), never stored
 * and never sent anywhere.
 */

/** DER prefix of DigestInfo for SHA-256 (RFC 8017 §9.2, Note 1). */
export const DIGEST_INFO_SHA256 = Uint8Array.from([0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20]);

export const RSA_ALG = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;

export interface DemoKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  n: bigint;
  e: bigint;
  /** modulus length in bytes (256 for 2048-bit) */
  k: number;
  /** a short fingerprint of the public key, to tell key pairs apart on screen */
  label: string;
}

export async function generateDemoKeyPair(label: string): Promise<DemoKeyPair> {
  const pair = (await crypto.subtle.generateKey(RSA_ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const nBytes = b64urlDecode(jwk.n!);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, n: bytesToBigInt(nBytes), e: bytesToBigInt(b64urlDecode(jwk.e!)), k: nBytes.length, label };
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf(data)));
}

/** EMSA-PKCS1-v1_5 encoding of a SHA-256 hash for a k-byte modulus. */
export function emsaPkcs1v15(hash: Uint8Array, k: number): Uint8Array {
  const t = new Uint8Array(DIGEST_INFO_SHA256.length + hash.length);
  t.set(DIGEST_INFO_SHA256);
  t.set(hash, DIGEST_INFO_SHA256.length);
  const em = new Uint8Array(k).fill(0xff);
  em[0] = 0x00;
  em[1] = 0x01;
  em[k - t.length - 1] = 0x00;
  em.set(t, k - t.length);
  return em;
}

/** signature ^ e mod n, as k bytes (RSAVP1). */
export function rsaPublicOp(signature: Uint8Array, key: Pick<DemoKeyPair, 'n' | 'e' | 'k'>): Uint8Array {
  return bigIntToBytes(modPow(bytesToBigInt(signature), key.e, key.n), key.k);
}

export interface EmParts {
  /** starts 00 01 FF…FF 00 */
  padding: boolean;
  digestInfo: boolean;
  /** the 32 bytes after DigestInfo, when the structure is right */
  hash: Uint8Array | null;
}

export function parseEm(em: Uint8Array): EmParts {
  const tLen = DIGEST_INFO_SHA256.length + 32;
  const sep = em.length - tLen - 1;
  let padding = em[0] === 0x00 && em[1] === 0x01 && em[sep] === 0x00;
  for (let i = 2; padding && i < sep; i++) if (em[i] !== 0xff) padding = false;
  const di = em.slice(sep + 1, sep + 1 + DIGEST_INFO_SHA256.length);
  const digestInfo = padding && equalBytes(di, DIGEST_INFO_SHA256);
  return { padding, digestInfo, hash: digestInfo ? em.slice(em.length - 32) : null };
}

export type Rs256Scenario = 'valid' | 'tampered' | 'forged';

export const RS256_SCENARIOS: { id: Rs256Scenario; label: string }[] = [
  { id: 'valid', label: 'Sign and verify' },
  { id: 'tampered', label: 'Payload tampered after signing' },
  { id: 'forged', label: "Signed with someone else's private key" },
];

export type RsPhase = 'sign' | 'verify';

export interface RsState {
  phase: RsPhase;
  focus: 'input' | 'hash' | 'em' | 'sign' | 'token' | 'recompute' | 'recover' | 'compare';
  header: string;
  payload: string;
  signingInput: string;
  hash: string | null;
  em: { padding: string; digestInfo: string; hash: string } | null;
  signature: string | null;
  token: string | null;
  /** what the API sees (after any tampering) */
  received: string | null;
  recomputed: string | null;
  recovered: { head: string; hash: string | null; padding: boolean; digestInfo: boolean } | null;
  valid: boolean | null;
  /** Web Crypto's own verify() result, shown next to the step-by-step check */
  webCryptoValid: boolean | null;
  signer: string;
  verifier: string;
  /** which note snippet and lines the code panel highlights */
  panel: 'sign' | 'verify';
  panelLines: number[];
}

export type RsStep = Step<RsState>;

const L = {
  input: lineOf(RSA_SIGN_TEXT, 'signing_input ='),
  hash: lineOf(RSA_SIGN_TEXT, 'hash = SHA256'),
  sign: lineOf(RSA_SIGN_TEXT, 'signature = hash ^ d mod n'),
  recompute: lineOf(RSA_VERIFY_TEXT, 'recomputed_hash ='),
  recover: lineOf(RSA_VERIFY_TEXT, 'recovered_hash'),
};

/**
 * The demo payload: sub and email from 11.ASP_MoreOnAuth.md's GenerateJwtToken("123", "user@example.com", …), issuer, audience and
 * the 30-minute lifetime from its RS256 example. The role starts as User so tampering can try to raise it to Admin.
 */
export function rsDemoPayload(nowSeconds: number) {
  return { sub: '123', email: 'user@example.com', role: 'User', exp: nowSeconds + 30 * 60, iss: 'https://auth-server', aud: 'my-api' };
}
export const RS_HEADER = { alg: 'RS256', typ: 'JWT' };

/**
 * Signs with `signer`'s private key and verifies with `verifier`'s public key (the auth server's key pair for both
 * in the normal case). For 'tampered', the payload is changed in transit after signing.
 */
export async function traceRs256(scenario: Rs256Scenario, server: DemoKeyPair, other: DemoKeyPair, nowSeconds: number): Promise<Trace<RsState>> {
  const signer = scenario === 'forged' ? other : server;
  const verifier = server;
  const payloadObj = rsDemoPayload(nowSeconds);
  const header = JSON.stringify(RS_HEADER);
  const payload = JSON.stringify(scenario === 'forged' ? { ...payloadObj, role: 'Admin' } : payloadObj);
  const signingInput = `${b64urlFromString(header)}.${b64urlFromString(payload)}`;
  const hash = await sha256(utf8(signingInput));
  const em = emsaPkcs1v15(hash, signer.k);
  const sig = new Uint8Array(await crypto.subtle.sign(RSA_ALG.name, signer.privateKey, buf(utf8(signingInput))));
  const token = `${signingInput}.${b64urlEncode(sig)}`;

  let received = token;
  if (scenario === 'tampered') {
    const t = parseJwt(token);
    const changed = JSON.stringify({ ...JSON.parse(t.payload.text!), role: 'Admin' });
    received = `${t.header.raw}.${b64urlFromString(changed)}.${t.signature.raw}`;
  }
  const r = parseJwt(received);
  const recomputed = await sha256(utf8(r.signingInput));
  const recoveredEm = rsaPublicOp(r.signature.bytes!, verifier);
  const parts = parseEm(recoveredEm);
  const valid = Boolean(parts.hash && equalBytes(parts.hash, recomputed));
  const webCryptoValid = await crypto.subtle.verify(RSA_ALG.name, verifier.publicKey, buf(r.signature.bytes!), buf(utf8(r.signingInput)));

  const steps: RsStep[] = [];
  let state: RsState = {
    phase: 'sign',
    focus: 'input',
    header,
    payload,
    signingInput,
    hash: null,
    em: null,
    signature: null,
    token: null,
    received: null,
    recomputed: null,
    recovered: null,
    valid: null,
    webCryptoValid: null,
    signer: signer.label,
    verifier: verifier.label,
    panel: 'sign',
    panelLines: [L.input],
  };
  const push = (patch: Partial<RsState>, action: RsStep['action'], narration: string, variables: Record<string, string | number | boolean> = {}, predict?: RsStep['predict']) => {
    state = { ...state, ...patch };
    steps.push({ state, highlights: {}, action, codeLine: 0, narration, variables, counters: ZERO, predict });
  };
  const who = scenario === 'forged' ? 'An attacker' : 'The auth server';

  push(
    {},
    'start',
    `${who} builds the token: header ${header} and the payload, each base64url-encoded and joined with a dot. That string is the signing input.${scenario === 'forged' ? " The attacker wants role Admin and signs with their own private key, because they don't have the auth server's." : ''}`,
    { 'signing input': `${signingInput.length} chars` },
  );
  push({ focus: 'hash', hash: hex(hash), panelLines: [L.hash] }, 'call', `SHA-256 of the signing input: 32 bytes, ${hex(hash, 8)}. Any change to the header or payload gives a completely different hash.`, { hash: hex(hash, 6) });
  push(
    {
      focus: 'em',
      em: { padding: `00 01 ${'FF '.repeat(3)}… FF 00 (${em.length - 32 - DIGEST_INFO_SHA256.length - 3} × FF)`, digestInfo: hex(DIGEST_INFO_SHA256), hash: hex(hash) },
      panelLines: [L.sign],
    },
    'call',
    `Before the RSA step, RS256 pads the hash to the key size (${signer.k} bytes): 00 01, a run of FF bytes, 00, a fixed DigestInfo prefix that says "SHA-256", then the hash. The note writes this step as just "hash"; the padding is what makes the result checkable.`,
    { 'EM bytes': em.length },
  );
  push(
    { focus: 'sign', signature: hex(sig, 16), panelLines: [L.sign] },
    'call',
    `The private key signs: signature = EM ^ d mod n, where d is the private exponent only the ${scenario === 'forged' ? "attacker's key" : 'auth server'} holds (here Web Crypto does it with ${signer.label}'s private key). The result is ${sig.length} bytes.`,
    { signer: signer.label, 'signature bytes': sig.length },
  );
  push(
    { focus: 'token', token, panelLines: [] },
    'write',
    `base64url(signature) is appended: header.payload.signature. The token goes to the client and then to the API.${scenario === 'tampered' ? ' On the way, someone edits the payload to say role "Admin" (base64url is not encryption, so that is easy) but keeps the signature.' : ''}`,
    { 'token length': token.length },
  );
  push(
    { phase: 'verify', focus: 'recompute', received, recomputed: hex(recomputed), panel: 'verify', panelLines: [L.recompute] },
    'call',
    `The API never creates a signature. It hashes the token's own header.payload again: recomputed_hash = ${hex(recomputed, 8)}${scenario === 'tampered' ? ' This is the tampered payload, so the hash differs from the one that was signed.' : ''}`,
    { recomputed: hex(recomputed, 6) },
  );
  push(
    {
      focus: 'recover',
      recovered: { head: hex(recoveredEm, 12), hash: parts.hash ? hex(parts.hash) : null, padding: parts.padding, digestInfo: parts.digestInfo },
      panelLines: [L.recover],
    },
    'call',
    parts.hash
      ? `With the public key (n and e = ${verifier.e}) the API computes signature ^ e mod n. Out comes the padded block again: 00 01 FF … 00, the DigestInfo, and the hash that was signed: ${hex(parts.hash, 8)}.`
      : `With ${verifier.label}'s public key the API computes signature ^ e mod n, but the result (${hex(recoveredEm, 8)}) is random-looking bytes, not 00 01 FF … 00: this signature was not made with the matching private key.`,
    { 'public key': verifier.label, 'padding ok': parts.padding },
  );
  push(
    { focus: 'compare', valid, webCryptoValid, panelLines: [L.recompute, L.recover] },
    'compare',
    valid
      ? `recomputed_hash == recovered_hash, so the token is valid: it was signed by the holder of ${verifier.label}'s private key and nothing changed since. (Web Crypto's verify() agrees: ${webCryptoValid}.)`
      : scenario === 'tampered'
        ? `recovered_hash (what was signed) ≠ recomputed_hash (what arrived), so the token is rejected: the payload was changed after signing. (Web Crypto's verify() agrees: ${webCryptoValid}.)`
        : `There is no valid hash to compare, so the token is rejected. Without the auth server's private key, nobody can make a signature its public key accepts. (Web Crypto's verify() agrees: ${webCryptoValid}.)`,
    { valid },
    { question: 'Does the API accept this token?', options: ['Yes: the hashes match', 'No: verification fails'], answer: valid ? 0 : 1 },
  );
  steps[steps.length - 1]!.action = 'done';
  return steps;
}
