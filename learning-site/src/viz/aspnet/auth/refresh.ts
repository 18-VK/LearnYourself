import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import { REFRESH_LOGIN_CODE, REFRESH_LOOKUP_CODE, REFRESH_REUSE_CODE, REFRESH_ROTATE_CODE } from '../sources-t2';

/**
 * Refresh-token rotation and reuse detection as 12.ASP_AuthServer.md › Refresh Token walks through it, using the
 * custom auth server's design: the database stores only a hash of each refresh token; every refresh revokes the
 * presented token and issues a new one in the same family; presenting an already-revoked token revokes the whole
 * family. Token values and hashes for rt-001 and rt-002 are the note's examples; later ones are placeholders.
 */

export type Who = 'user' | 'attacker';
export type Action = { kind: 'login' } | { kind: 'refresh'; who: Who } | { kind: 'steal' };

export interface Row {
  id: string;
  family: string;
  hash: string;
  revokedAt: string | null;
  replacedBy: string | null;
  /** why it was revoked, for the table */
  why: '' | 'rotation' | 'reuse detection';
}

export interface RefreshState {
  rows: Row[];
  /** refresh token each party holds (row id), or null */
  holds: Record<Who, string | null>;
  /** whether each party currently has a valid access token */
  access: Record<Who, boolean>;
  /** rows to highlight: looked up / created / revoked in this step */
  lookedUp: string | null;
  created: string | null;
  revokedNow: string[];
  clock: string;
  /** what the response to the current request is */
  response: { status: number; text: string } | null;
  actor: Who | null;
  /** which note snippet explains this step */
  code: 'login' | 'lookup' | 'rotate' | 'reuse' | null;
  codeLines: number[];
  reuseDetection: boolean;
}

export type RefreshStep = Step<RefreshState>;

const RAW: Record<number, string> = { 1: 'Xk92mQp7…', 2: 'Qm5vLpR8…' };
const HASH: Record<number, string> = { 1: '4f8a2c...', 2: '9b3e71...' };
export const rawOf = (id: string) => RAW[Number(id.slice(3))] ?? `(random value #${Number(id.slice(3))})`;
const hashOf = (n: number) => HASH[n] ?? `SHA256(value #${n})`;

export const STORIES: { id: string; label: string; actions: Action[] }[] = [
  { id: 'rotation', label: 'Rotation: refresh every 15 min', actions: [{ kind: 'login' }, { kind: 'refresh', who: 'user' }, { kind: 'refresh', who: 'user' }, { kind: 'refresh', who: 'user' }] },
  {
    id: 'stolen',
    label: 'Stolen token replayed late (step 5)',
    actions: [{ kind: 'login' }, { kind: 'refresh', who: 'user' }, { kind: 'steal' }, { kind: 'refresh', who: 'user' }, { kind: 'refresh', who: 'user' }, { kind: 'refresh', who: 'attacker' }, { kind: 'refresh', who: 'user' }],
  },
  {
    id: 'race',
    label: 'Attacker wins the race',
    actions: [{ kind: 'login' }, { kind: 'refresh', who: 'user' }, { kind: 'steal' }, { kind: 'refresh', who: 'attacker' }, { kind: 'refresh', who: 'user' }, { kind: 'refresh', who: 'attacker' }],
  },
];

export type CodeKey = NonNullable<RefreshState['code']>;

/** The note's snippet for each kind of step, and the lines in it that the step is about. */
export const REFRESH_CODE: Record<CodeKey, { code: string; title: string; lines: number[] }> = {
  login: { code: REFRESH_LOGIN_CODE, title: 'Step 1 — initial login, from the note', lines: [lineOf(REFRESH_LOGIN_CODE, 'Guid.NewGuid()'), lineOf(REFRESH_LOGIN_CODE, '_dbContext.RefreshTokens.Add(')] },
  lookup: { code: REFRESH_LOOKUP_CODE, title: 'Step 3 — inside RefreshTokenAsync, from the note', lines: [lineOf(REFRESH_LOOKUP_CODE, 'HashToken('), lineOf(REFRESH_LOOKUP_CODE, 'FirstOrDefaultAsync(')] },
  rotate: { code: REFRESH_ROTATE_CODE, title: 'Step 3 — rotation, from the note', lines: [lineOf(REFRESH_ROTATE_CODE, 'existing.RevokedAtUtc = DateTime.UtcNow'), lineOf(REFRESH_ROTATE_CODE, 'GenerateRefreshToken('), lineOf(REFRESH_ROTATE_CODE, 'existing.ReplacedByTokenId')] },
  reuse: { code: REFRESH_REUSE_CODE, title: 'Step 5 — reuse detection, from the note', lines: [lineOf(REFRESH_REUSE_CODE, 'if (existing.RevokedAtUtc is not null)'), lineOf(REFRESH_REUSE_CODE, 'RevokeFamilyAsync(')] },
};

export function traceRefresh(actions: readonly Action[], reuseDetection = true): RefreshStep[] {
  const L = (k: CodeKey, _which: string) => REFRESH_CODE[k].lines;
  const rows: Row[] = [];
  const holds: Record<Who, string | null> = { user: null, attacker: null };
  const access: Record<Who, boolean> = { user: false, attacker: false };
  let n = 0;
  let minutes = 10 * 60;
  const clock = () => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const steps: RefreshStep[] = [];
  const push = (patch: Partial<RefreshState>, action: RefreshStep['action'], narration: string, predict?: RefreshStep['predict']) => {
    steps.push({
      state: {
        rows: rows.map((r) => ({ ...r })),
        holds: { ...holds },
        access: { ...access },
        lookedUp: null,
        created: null,
        revokedNow: [],
        clock: clock(),
        response: null,
        actor: null,
        code: null,
        codeLines: [],
        reuseDetection,
        ...patch,
      },
      highlights: {},
      action,
      codeLine: 0,
      narration,
      variables: { time: clock(), 'user holds': holds.user ?? '—', 'attacker holds': holds.attacker ?? '—' },
      counters: ZERO,
      predict,
    });
  };
  const mint = (family: string) => {
    n++;
    const id = `rt-${String(n).padStart(3, '0')}`;
    rows.push({ id, family, hash: hashOf(n), revokedAt: null, replacedBy: null, why: '' });
    return id;
  };
  let families = 0;

  push({}, 'start', `Nobody is logged in yet. The access token lives 15 minutes; the refresh token is the longer-lived credential${reuseDetection ? '' : ' (reuse detection is switched off in this run)'}.`);
  for (const a of actions) {
    if (a.kind === 'login') {
      families++;
      const family = `family-${String.fromCharCode(64 + families)}`;
      const id = mint(family);
      holds.user = id;
      access.user = true;
      push(
        { created: id, actor: 'user', code: 'login', codeLines: L('login', 'all'), response: { status: 200, text: 'access + refresh token' } },
        'write',
        `The user logs in with email and password. The server starts ${family} (TokenFamilyId = Guid.NewGuid()), issues a 15-minute access token and refresh token ${id} (${rawOf(id)}), and stores only its hash, ${rows.at(-1)!.hash}. The raw value exists only in the response and the client's storage.`,
      );
      continue;
    }
    if (a.kind === 'steal') {
      if (!holds.user) continue;
      holds.attacker = holds.user;
      push(
        { actor: 'attacker' },
        'read',
        `An attacker steals the user's current refresh token ${holds.user} (${rawOf(holds.user)}), for example through XSS or a compromised proxy. Both now hold the same bytes; the server can't tell them apart.`,
      );
      continue;
    }
    // refresh
    const who = a.who;
    const tokenId = holds[who];
    if (!tokenId) continue;
    minutes += who === 'user' ? 15 : 3;
    access[who] = false;
    const row = rows.find((r) => r.id === tokenId)!;
    const label = who === 'user' ? "The user's app" : 'The attacker';
    push(
      { actor: who, lookedUp: row.id, code: 'lookup', codeLines: L('lookup', 'all') },
      'call',
      `${label} calls POST /api/auth/refresh with ${row.id} (${rawOf(row.id)})${who === 'user' ? ' because its access token expired (a routine 401)' : ''}. The server hashes the value and finds row ${row.id} by its hash.`,
      {
        question: `What does the server do with ${row.id}?`,
        options: ['Rotate: revoke it and issue a new one', reuseDetection ? 'Reuse detected: revoke the whole family' : 'Reject it: it is revoked'],
        answer: row.revokedAt ? 1 : 0,
      },
    );
    if (row.revokedAt) {
      if (reuseDetection) {
        const fam = rows.filter((r) => r.family === row.family);
        const newlyRevoked = fam.filter((r) => !r.revokedAt).map((r) => r.id);
        for (const r of fam) {
          if (!r.revokedAt) {
            r.revokedAt = clock();
            r.why = 'reuse detection';
          }
        }
        for (const w of ['user', 'attacker'] as Who[]) if (holds[w] && rows.find((r) => r.id === holds[w])?.family === row.family) access[w] = false;
        push(
          { actor: who, lookedUp: row.id, revokedNow: newlyRevoked, code: 'reuse', codeLines: L('reuse', 'all'), response: { status: 401, text: 'Refresh token reuse detected; all sessions revoked.' } },
          'branch',
          newlyRevoked.length
            ? `${row.id} was already revoked: a revoked token presented again means someone is replaying a stolen token. RevokeFamilyAsync kills everything in ${row.family}: ${newlyRevoked.join(', ')} ${newlyRevoked.length === 1 ? 'is' : 'are'} revoked now, including whatever the real user holds. Everyone in this family has to log in again.`
            : `${row.id} is revoked, and so is the rest of ${row.family} (it was already burned by reuse detection). The request fails; ${who === 'user' ? 'the user has to log in again with their password' : 'the attacker gets nothing'}.`,
        );
      } else {
        push(
          { actor: who, lookedUp: row.id, code: 'lookup', codeLines: L('lookup', 'all'), response: { status: 401, text: 'refresh token revoked' } },
          'branch',
          `${row.id} is revoked, so this refresh is refused. Without reuse detection that is all that happens: the rest of ${row.family} stays valid${rows.some((r) => r.family === row.family && !r.revokedAt) ? `, so whoever holds ${rows.filter((r) => r.family === row.family && !r.revokedAt).map((r) => r.id).join(', ')} keeps a working chain` : ''}.`,
        );
      }
      continue;
    }
    // rotation
    row.revokedAt = clock();
    row.why = 'rotation';
    const id = mint(row.family);
    row.replacedBy = id;
    holds[who] = id;
    access[who] = true;
    push(
      { actor: who, lookedUp: row.id, created: id, revokedNow: [row.id], code: 'rotate', codeLines: L('rotate', 'all'), response: { status: 200, text: `new access token + ${id}` } },
      'write',
      `${row.id} is valid (not revoked, not expired), so the server rotates: ${row.id}.RevokedAtUtc = now, a new ${id} is minted in the same ${row.family}, and ${row.id}.ReplacedByTokenId = ${id}. ${who === 'user' ? `The client silently swaps its stored token for ${id}.` : `The attacker now holds ${id} and a valid access token: they won the race.`}`,
    );
  }
  const last = steps.at(-1)!;
  last.action = 'done';
  return steps;
}
