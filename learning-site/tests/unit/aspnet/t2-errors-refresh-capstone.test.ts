import { describe, expect, it } from 'vitest';
import { STORIES, traceRefresh, REFRESH_CODE, type Action } from '../../../src/viz/aspnet/auth/refresh';
import { CAP_SCENARIOS, SNIPPETS, traceCapstone, type CapScenario } from '../../../src/viz/aspnet/capstone/trace';
import { EXCEPTIONS, FLOW_LINES, IMPLS, traceProblem, type ExceptionId, type ImplId } from '../../../src/viz/aspnet/errors/problem';
import * as T2 from '../../../src/viz/aspnet/sources-t2';
import { noteText } from './helpers';

const N9 = noteText('Phase2-ASP.NetAndBackend/ASP.Net Core/9.ASP_GlobalExceptionHandling.md');
const N12 = noteText('Phase2-ASP.NetAndBackend/ASP.Net Core/12.ASP_AuthServer.md');
const CAP = 'Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API/';

describe('ProblemDetails', () => {
  it('copies its code from the note and the capstone', () => {
    for (const c of [T2.EXCEPTION_HANDLER_CODE, T2.EXCEPTION_FLOW_TEXT, T2.EXCEPTION_MIDDLEWARE_CODE]) expect(N9).toContain(c);
    const mw = noteText(`${CAP}Src/API/Middlewares/GlobalExceptionMiddleware.cs`);
    expect(mw).toContain(T2.CAP_EXCEPTION_INVOKE);
    expect(mw).toContain(T2.CAP_EXCEPTION_HANDLE);
  });

  const expected: Record<ImplId, Record<ExceptionId, number>> = {
    capstone: { Exception: 500, ArgumentException: 400, KeyNotFoundException: 404, UnauthorizedAccessException: 401, NotFoundException: 404, ValidationException: 400 },
    'note-handler': { Exception: 500, ArgumentException: 500, KeyNotFoundException: 404, UnauthorizedAccessException: 401, NotFoundException: 500, ValidationException: 500 },
    'note-middleware': { Exception: 500, ArgumentException: 400, KeyNotFoundException: 404, UnauthorizedAccessException: 500, NotFoundException: 500, ValidationException: 500 },
  };
  for (const impl of Object.keys(IMPLS) as ImplId[])
    for (const ex of EXCEPTIONS)
      it(`${impl}: ${ex.id} → ${expected[impl][ex.id]}`, () => {
        const t = traceProblem(impl, ex.id);
        const last = t.at(-1)!.state;
        expect(last.status).toBe(expected[impl][ex.id]);
        expect(t.at(-1)!.action).toBe('done');
        // the switch arms are tried in order and the first match wins
        expect(last.armsTried).toEqual(Array.from({ length: last.matched! }, (_, i) => i));
        const q = t.find((s) => s.predict)!.predict!;
        expect(q.options[q.answer]).toBe(String(expected[impl][ex.id]));
      });

  it('the capstone hides the message for 500s, the note handler does not', () => {
    const cap = Object.fromEntries(traceProblem('capstone', 'Exception').at(-1)!.state.body!);
    expect(cap).toMatchObject({ title: 'Internal Server Error', status: 500, detail: 'Internal server error', instance: '/api/products' });
    const note = Object.fromEntries(traceProblem('note-handler', 'Exception').at(-1)!.state.body!);
    expect(note.detail).toBe('Database failed');
    expect(N9).toContain('"detail": "Database failed"');
    const mw = traceProblem('note-middleware', 'KeyNotFoundException').at(-1)!.state.body!.map(([k]) => k);
    expect(mw).toEqual(['message', 'status', 'traceId']);
  });

  it("follows the note's Full Execution Flow and highlights real lines", () => {
    const t = traceProblem('capstone', 'ArgumentException');
    const flow = T2.EXCEPTION_FLOW_TEXT.split('\n');
    expect(flow[FLOW_LINES.catchLine - 1]).toBe('catch block runs ✅');
    const lines = IMPLS.capstone.code.split('\n');
    const arm = t.find((s) => s.state.matched !== null)!;
    expect(lines[arm.state.codeLines[0]! - 1]!.trim()).toBe('ArgumentException => (StatusCodes.Status400BadRequest, "Bad request"),');
    const order = t.map((s) => s.state.flowLine).filter((l, i, a) => l !== a[i - 1]);
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });
});

describe('refresh-token rotation', () => {
  it('copies the code from the note', () => {
    for (const c of [T2.REFRESH_LOGIN_CODE, T2.REFRESH_LOOKUP_CODE, T2.REFRESH_ROTATE_CODE, T2.REFRESH_REUSE_CODE]) expect(N12).toContain(c);
    for (const k of Object.keys(REFRESH_CODE) as (keyof typeof REFRESH_CODE)[]) expect(REFRESH_CODE[k].lines.length).toBeGreaterThan(0);
  });

  it('rotation builds the chain rt-001 → rt-002 → …, only the newest one active', () => {
    const last = traceRefresh(STORIES[0]!.actions).at(-1)!.state;
    expect(last.rows.map((r) => [r.id, r.revokedAt !== null, r.replacedBy])).toEqual([
      ['rt-001', true, 'rt-002'],
      ['rt-002', true, 'rt-003'],
      ['rt-003', true, 'rt-004'],
      ['rt-004', false, null],
    ]);
    expect(last.holds.user).toBe('rt-004');
    expect(last.rows.every((r) => r.family === 'family-A')).toBe(true);
  });

  it("the note's step 5: a stolen rt-002 replayed after the user moved on revokes the whole family", () => {
    const t = traceRefresh(STORIES.find((s) => s.id === 'stolen')!.actions);
    const reuse = t.find((s) => s.state.code === 'reuse')!;
    expect(reuse.state.lookedUp).toBe('rt-002');
    expect(reuse.state.revokedNow).toEqual(['rt-004']);
    expect(reuse.state.response).toEqual({ status: 401, text: 'Refresh token reuse detected; all sessions revoked.' });
    const last = t.at(-1)!.state;
    expect(last.rows.every((r) => r.revokedAt)).toBe(true);
    expect(last.response!.status).toBe(401); // the real user is logged out too
  });

  it('the race: whoever refreshes first wins, the second caller triggers the family-wide revoke', () => {
    const t = traceRefresh(STORIES.find((s) => s.id === 'race')!.actions);
    const attackerWin = t.find((s) => s.state.actor === 'attacker' && s.state.code === 'rotate')!;
    expect(attackerWin.state.created).toBe('rt-003');
    const reuse = t.find((s) => s.state.code === 'reuse')!;
    expect(reuse.state.actor).toBe('user');
    expect(reuse.state.revokedNow).toEqual(['rt-003']);
    expect(t.at(-1)!.state.response!.status).toBe(401);
  });

  it('without reuse detection the attacker keeps a working chain', () => {
    const actions: Action[] = STORIES.find((s) => s.id === 'race')!.actions;
    const t = traceRefresh(actions, false);
    expect(t.some((s) => s.state.code === 'reuse')).toBe(false);
    const last = t.at(-1)!.state;
    expect(last.rows.find((r) => r.id === last.holds.attacker)!.revokedAt).toBeNull();
  });

  it('asks the right prediction before each decision', () => {
    for (const st of STORIES)
      for (const s of traceRefresh(st.actions).filter((x) => x.predict)) {
        const next = s.state.lookedUp!;
        const wasRevoked = s.state.rows.find((r) => r.id === next)!.revokedAt !== null;
        expect(s.predict!.answer).toBe(wasRevoked ? 1 : 0);
      }
  });
});

describe('capstone trace', () => {
  it('shows only real code from the capstone files', () => {
    for (const sn of Object.values(SNIPPETS)) expect(noteText(`Phase2-ASP.NetAndBackend/ASP.Net Core/${sn.file}`)).toContain(sn.code);
  });

  const outcome: Record<CapScenario, number> = { created: 201, 'validation-failed': 400, duplicate: 409, 'not-found': 404 };
  for (const { id } of CAP_SCENARIOS)
    it(`${id} ends with ${outcome[id]}`, () => {
      const t = traceCapstone(id);
      expect(t.at(-1)!.state.response!.status).toBe(outcome[id]);
      expect(t.at(-1)!.action).toBe('done');
      for (const s of t) {
        const lines = SNIPPETS[s.state.snippet].code.split('\n');
        for (const l of s.state.lines) expect(l).toBeLessThanOrEqual(lines.length);
      }
    });

  it('validation failure never reaches the service, repository or database', () => {
    const layers = new Set(traceCapstone('validation-failed').map((s) => s.state.layer));
    expect([...layers]).toEqual(['controller', 'validation-filter']);
  });

  it('a successful create goes all the way down and back', () => {
    const layers = traceCapstone('created').map((s) => s.state.layer);
    for (const l of ['controller', 'validation-filter', 'service', 'repository', 'ef-core', 'result', 'response-mapping']) expect(layers).toContain(l);
    const last = traceCapstone('created').at(-1)!;
    expect(SNIPPETS.create.code.split('\n')[last.state.lines[0]! - 1]!.trim()).toBe('return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);');
  });

  it('expected failures come back as Result<T>, not exceptions', () => {
    const nf = traceCapstone('not-found').find((s) => s.state.layer === 'result')!;
    expect(nf.state.data!.fields).toContainEqual(['StatusCode', '404']);
    const dup = traceCapstone('duplicate').find((s) => s.state.layer === 'result')!;
    expect(dup.state.data!.fields).toContainEqual(['StatusCode', '409']);
  });

  it('can be limited to some layers', () => {
    const t = traceCapstone('created', ['controller', 'service']);
    expect(new Set(t.map((s) => s.state.layer))).toEqual(new Set(['controller', 'service']));
  });
});
