/**
 * Base64url (RFC 4648 §5, as JWS uses it: RFC 7515 §2 "Base64url Encoding", no padding) and small byte helpers.
 * https://www.rfc-editor.org/rfc/rfc7515#section-2
 */

export const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export const utf8 = (s: string): Uint8Array => enc.encode(s);
export function fromUtf8(b: Uint8Array): string {
  return dec.decode(b);
}

export function b64urlEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64URL_ALPHABET[(n >> 18) & 63]! + B64URL_ALPHABET[(n >> 12) & 63]! + B64URL_ALPHABET[(n >> 6) & 63]! + B64URL_ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += B64URL_ALPHABET[(n >> 18) & 63]! + B64URL_ALPHABET[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64URL_ALPHABET[(n >> 18) & 63]! + B64URL_ALPHABET[(n >> 12) & 63]! + B64URL_ALPHABET[(n >> 6) & 63]!;
  }
  return out;
}

export const b64urlFromString = (s: string) => b64urlEncode(utf8(s));

/** Decodes base64url without padding. Throws on characters outside the alphabet or an impossible length. */
export function b64urlDecode(s: string): Uint8Array {
  if (s.length % 4 === 1) throw new Error('A base64url string can never be 1 character longer than a multiple of 4.');
  const vals: number[] = [];
  for (const ch of s) {
    const v = B64URL_ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`"${ch}" is not a base64url character (A–Z, a–z, 0–9, - and _).`);
    vals.push(v);
  }
  const out: number[] = [];
  for (let i = 0; i < vals.length; i += 4) {
    const a = vals[i]!;
    const b = vals[i + 1] ?? 0;
    const c = vals[i + 2];
    const d = vals[i + 3];
    out.push(((a << 2) | (b >> 4)) & 255);
    if (c !== undefined) out.push(((b << 4) | (c >> 2)) & 255);
    if (d !== undefined) out.push(((c! << 6) | d) & 255);
  }
  return new Uint8Array(out);
}

/** The first `chars` characters of a base64url string as 6-bit groups → bytes, for the "how decoding works" view. */
export function b64urlBreakdown(s: string, chars = 8): { char: string; value: number; bits: string }[] {
  return [...s.slice(0, chars)].map((char) => {
    const value = B64URL_ALPHABET.indexOf(char);
    return { char, value, bits: value < 0 ? '??????' : value.toString(2).padStart(6, '0') };
  });
}

export const hex = (b: Uint8Array, max = b.length) =>
  [...b.slice(0, max)].map((x) => x.toString(16).padStart(2, '0')).join('') + (b.length > max ? '…' : '');

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

/** Web Crypto wants a BufferSource backed by an ArrayBuffer (not a SharedArrayBuffer). */
export const buf = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

export function bytesToBigInt(b: Uint8Array): bigint {
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}

export function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(n & 255n);
    n >>= 8n;
  }
  return out;
}

/** base^exp mod m by square-and-multiply (used only with the small public exponent). */
export function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let r = 1n;
  let b = base % m;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}
