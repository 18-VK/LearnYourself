import { describe, expect, it } from 'vitest';
import {
  checkOrder,
  flowTokens,
  lineInProgram,
  MIDDLEWARE,
  NOTE_ORDER,
  ORDER_PRESETS,
  programFor,
  SAMPLES,
  traceInAndOut,
  tracePipeline,
  type MwId,
  type SampleId,
} from '../../../src/viz/aspnet/middleware/pipeline';
import { MIDDLEWARE_FLOW_TEXT, PRODUCTION_ORDER_CODE } from '../../../src/viz/aspnet/sources';
import { noteText } from './helpers';

const finalOutcome = (order: readonly MwId[], s: SampleId, fallbackPolicy = false) => tracePipeline(order, s, { fallbackPolicy }).at(-1)!.state.outcome!;
const visitedIn = (order: readonly MwId[], s: SampleId) =>
  tracePipeline(order, s)
    .filter((st) => st.state.dir === 'in' && st.state.at >= 0 && st.state.at < order.length)
    .map((st) => order[st.state.at]!);

describe('in-and-out flow (the note diagram)', () => {
  it('copies the diagram from the note', () => {
    expect(noteText('Phase2-ASP.NetAndBackend/ASP.Net Core/8.ASP_MiddlewareNMore.md')).toContain(MIDDLEWARE_FLOW_TEXT);
    expect(flowTokens()).toEqual([
      ['Request', 'Middleware A', 'Middleware B', 'Middleware C', 'Controller'],
      ['Middleware C', 'Middleware B', 'Middleware A', 'Response'],
    ]);
  });

  it('runs A, B, C in, the controller, then C, B, A out, exactly as the diagram reads', () => {
    const t = traceInAndOut();
    const path = t.map((s) => (s.state.at < 0 ? 'Request' : s.state.at >= s.state.rows.length ? 'Response' : s.state.rows[s.state.at]));
    expect(path).toEqual(['Request', 'Middleware A', 'Middleware B', 'Middleware C', 'Controller', 'Middleware C', 'Middleware B', 'Middleware A', 'Response']);
    // every step points at the diagram token with the same name
    const tokens = flowTokens();
    for (const [k, s] of t.entries()) expect(tokens[s.state.hop!.line]![s.state.hop!.index]).toBe(path[k]);
    expect(t.at(-1)!.action).toBe('done');
  });

  it('short-circuits at B: C and the controller never run, and only A runs on the way out', () => {
    const t = traceInAndOut(['A', 'B', 'C'], 1);
    const path = t.map((s) => `${s.state.dir}:${s.state.at}`);
    expect(path).toEqual(['in:-1', 'in:0', 'in:1', 'out:0', 'out:4']);
    const last = t.at(-1)!.state;
    expect(last.status).toEqual(['out', 'short', 'idle', 'idle']);
    expect(last.skipped).toEqual([
      { line: 0, index: 3 },
      { line: 0, index: 4 },
      { line: 1, index: 1 },
      { line: 1, index: 0 },
    ]);
  });

  it('short-circuiting at the first middleware returns straight to the client', () => {
    const t = traceInAndOut(['A', 'B', 'C'], 0);
    expect(t.map((s) => s.state.at)).toEqual([-1, 0, 4]);
  });

  it('asks a prediction only where the next step is a real choice', () => {
    const t = traceInAndOut(['A', 'B', 'C'], 2);
    const asked = t.filter((s) => s.predict).map((s) => [s.state.at, s.predict!.answer]);
    expect(asked).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });
});

describe('production order pipeline', () => {
  it("uses the note's Program.cs lines verbatim, in any order", () => {
    expect(noteText('Phase2-ASP.NetAndBackend/ASP.Net Core/8.ASP_MiddlewareNMore.md')).toContain(PRODUCTION_ORDER_CODE);
    expect(programFor(NOTE_ORDER)).toBe(PRODUCTION_ORDER_CODE);
    const swapped: MwId[] = ['exception', 'static', 'routing', 'cors', 'authz', 'authn', 'ratelimit'];
    for (const line of programFor(swapped).split('\n')) expect(PRODUCTION_ORDER_CODE.split('\n')).toContain(line);
    expect(lineInProgram(NOTE_ORDER, 'authz')).toBe(10);
    expect(lineInProgram(swapped, 'authz')).toBe(5);
    expect(lineInProgram(swapped, 'endpoint')).toBe(8);
  });

  it('highlights the line of the middleware that is running', () => {
    for (const s of tracePipeline(NOTE_ORDER, 'valid-token')) {
      const { at } = s.state;
      if (at < 0 || at > NOTE_ORDER.length) expect(s.codeLine).toBe(0);
      else {
        const line = PRODUCTION_ORDER_CODE.split('\n')[s.codeLine - 1]!;
        expect(line).toBe(at === NOTE_ORDER.length ? 'app.MapControllers();          // 8. Execute endpoint' : MIDDLEWARE[NOTE_ORDER[at]!].line);
      }
    }
  });

  it("in the note's order a valid token reaches the action and goes back out through every middleware", () => {
    const t = tracePipeline(NOTE_ORDER, 'valid-token');
    expect(t.map((s) => `${s.state.dir}${s.state.at}`)).toEqual(['in-1', 'in0', 'in1', 'in2', 'in3', 'in4', 'in5', 'in6', 'in7', 'out6', 'out5', 'out4', 'out3', 'out2', 'out1', 'out0', 'out8']);
    expect(finalOutcome(NOTE_ORDER, 'valid-token')).toMatchObject({ status: 200 });
  });

  it.each([
    ['valid-token', 200],
    ['no-token', 401],
    ['wrong-role', 403],
    ['throws', 500],
    ['static-file', 200],
    ['cross-origin', 401],
    ['rate-limited', 503],
  ] as [SampleId, number][])("note's order: %s → %i", (s, status) => {
    const o = finalOutcome(NOTE_ORDER, s);
    expect(o.status).toBe(status);
    expect(o.blocked).toBeFalsy();
  });

  it('static files short-circuit before routing and auth run', () => {
    expect(visitedIn(NOTE_ORDER, 'static-file')).toEqual(['exception', 'static']);
    const t = tracePipeline(NOTE_ORDER, 'static-file');
    expect(t.at(-1)!.state.shortAt).toBe(1);
    expect(t.at(-1)!.state.status.slice(2)).toEqual(['skipped', 'skipped', 'skipped', 'skipped', 'skipped', 'skipped']);
  });

  it('authorization before authentication rejects a valid token with 401', () => {
    const order: MwId[] = ['exception', 'static', 'routing', 'cors', 'authz', 'authn', 'ratelimit'];
    expect(finalOutcome(order, 'valid-token').status).toBe(401);
    const authz = tracePipeline(order, 'valid-token').find((s) => s.state.at === 4 && s.state.dir === 'in')!;
    expect(authz.narration).toMatch(/UseAuthentication hasn't run yet/);
    expect(authz.state.ctx.user).toBe('anonymous');
    // authentication never runs: authorization short-circuited first
    expect(visitedIn(order, 'valid-token')).not.toContain('authn');
  });

  it('authorization before routing cannot see [Authorize], and the endpoint refuses to run (500)', () => {
    const order: MwId[] = ['exception', 'static', 'cors', 'authn', 'authz', 'routing', 'ratelimit'];
    const t = tracePipeline(order, 'valid-token');
    expect(t.find((s) => s.state.ctx.exception === 'InvalidOperationException')).toBeTruthy();
    expect(finalOutcome(order, 'valid-token').status).toBe(500);
    // without a fallback policy even an anonymous caller gets past authorization
    expect(visitedIn(order, 'no-token')).toContain('routing');
    // with the fallback policy, an anonymous caller is challenged by it
    expect(finalOutcome(order, 'no-token', true).status).toBe(401);
  });

  it('an exception handler placed last still catches the action, but protects nothing before it', () => {
    const order: MwId[] = ['static', 'routing', 'cors', 'authn', 'authz', 'ratelimit', 'exception'];
    expect(finalOutcome(order, 'throws').status).toBe(500);
    expect(tracePipeline(order, 'throws').at(-1)!.state.covered).toEqual([6, 7]);
    expect(tracePipeline(NOTE_ORDER, 'throws').at(-1)!.state.covered).toEqual([0, 7]);
    expect(checkOrder(order).find((r) => r.id === 'exception-first')!.ok).toBe(false);
  });

  it('static files after authorization are only blocked when a fallback policy requires a user', () => {
    const order: MwId[] = ['exception', 'routing', 'cors', 'authn', 'authz', 'static', 'ratelimit'];
    expect(finalOutcome(order, 'static-file').status).toBe(200);
    expect(visitedIn(order, 'static-file')).toEqual(['exception', 'routing', 'cors', 'authn', 'authz', 'static']);
    expect(finalOutcome(order, 'static-file', true).status).toBe(401);
    // before authorization, the fallback policy never sees static files
    expect(finalOutcome(NOTE_ORDER, 'static-file', true).status).toBe(200);
  });

  it('CORS after authorization: the 401 has no CORS header, so the browser blocks it', () => {
    const order: MwId[] = ['exception', 'static', 'routing', 'authn', 'authz', 'cors', 'ratelimit'];
    const o = finalOutcome(order, 'cross-origin');
    expect(o).toMatchObject({ status: 401, blocked: true });
    expect(tracePipeline(NOTE_ORDER, 'cross-origin').at(-1)!.state.ctx.cors).toBe(true);
  });

  it('a rate limiter before routing cannot see [EnableRateLimiting], so the 8th request gets through', () => {
    const order: MwId[] = ['exception', 'ratelimit', 'static', 'routing', 'cors', 'authn', 'authz'];
    expect(finalOutcome(order, 'rate-limited').status).toBe(200);
    expect(finalOutcome(NOTE_ORDER, 'rate-limited').status).toBe(503);
  });

  it("every rule holds for the note's order, and each preset breaks at least one", () => {
    expect(checkOrder(NOTE_ORDER).every((r) => r.ok)).toBe(true);
    for (const pr of ORDER_PRESETS.filter((x) => x.id !== 'note')) {
      expect(checkOrder(pr.order).some((r) => !r.ok), pr.id).toBe(true);
      expect([...pr.order].sort()).toEqual([...NOTE_ORDER].sort());
    }
  });

  it('every trace is well formed for every preset and sample', () => {
    for (const pr of ORDER_PRESETS)
      for (const s of Object.keys(SAMPLES) as SampleId[])
        for (const fallbackPolicy of [false, true]) {
          const t = tracePipeline(pr.order, s, { fallbackPolicy });
          expect(t[0]!.action).toBe('start');
          expect(t.at(-1)!.action).toBe('done');
          expect(t.at(-1)!.state.outcome).not.toBeNull();
          for (const st of t) {
            expect(st.narration.length).toBeGreaterThan(10);
            if (st.predict) expect(st.predict.answer).toBeLessThan(st.predict.options.length);
            expect(st.state.at).toBeGreaterThanOrEqual(-1);
            expect(st.state.at).toBeLessThanOrEqual(pr.order.length + 1);
          }
          // the response never goes back out through a middleware the request didn't pass on the way in
          const ins = new Set(t.filter((x) => x.state.dir === 'in').map((x) => x.state.at));
          for (const st of t.filter((x) => x.state.dir === 'out' && x.state.at <= pr.order.length)) expect(ins.has(st.state.at)).toBe(true);
        }
  });
});
