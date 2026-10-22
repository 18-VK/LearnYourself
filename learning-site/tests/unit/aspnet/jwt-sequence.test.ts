import { describe, expect, it } from 'vitest';
import { CONFIG, PHASES, SEQ_LINES, SEQ_SCENARIOS, traceJwtSequence, type SeqScenario } from '../../../src/viz/aspnet/jwt/sequence';
import { JWT_VALIDATION_CODE, NOTES } from '../../../src/viz/aspnet/sources';
import { noteText } from './helpers';

const note = noteText(NOTES.auth);

describe('JWT sequence', () => {
  it("copies the validation setup from the note and uses its appsettings values", () => {
    expect(note).toContain(JWT_VALIDATION_CODE);
    expect(note).toContain(`"Issuer": "${CONFIG.issuer}"`);
    expect(note).toContain(`"Audience": "${CONFIG.audience}"`);
    expect(JWT_VALIDATION_CODE).toContain(`ClockSkew = TimeSpan.FromMinutes(${CONFIG.clockSkewMinutes})`);
  });

  it.each([
    ['ok', 200],
    ['expired', 401],
    ['bad-signature', 401],
    ['wrong-audience', 401],
    ['no-token', 401],
    ['missing-role', 403],
  ] as [SeqScenario, number][])('%s ends with %i', (scenario, status) => {
    const t = traceJwtSequence(scenario);
    expect(t.at(-1)!.state.outcome!.status).toBe(status);
    expect(t.at(-1)!.action).toBe('done');
    expect(t.at(-1)!.state.events.at(-1)!.to).toBe('client');
  });

  it('checks the signature before the claims, and stops at the first failure', () => {
    const order = (s: SeqScenario) => traceJwtSequence(s).at(-1)!.state.checks.map((c) => c.result);
    expect(order('ok')).toEqual(['pass', 'pass', 'pass', 'pass', 'pass']);
    expect(order('bad-signature')).toEqual(['fail', 'skipped', 'skipped', 'skipped', 'skipped']);
    expect(order('wrong-audience')).toEqual(['pass', 'pass', 'fail', 'skipped', 'skipped']);
    expect(order('expired')).toEqual(['pass', 'pass', 'pass', 'fail', 'skipped']);
    expect(order('missing-role')).toEqual(['pass', 'pass', 'pass', 'pass', 'fail']);
    expect(order('no-token')).toEqual(['pending', 'pending', 'pending', 'pending', 'fail'].map((r, i) => (i < 4 ? 'skipped' : r)));
  });

  it('never reaches the controller when validation fails', () => {
    for (const { id } of SEQ_SCENARIOS) {
      const ev = traceJwtSequence(id).at(-1)!.state.events;
      expect(ev.some((e) => e.to === 'ctrl')).toBe(id === 'ok');
    }
  });

  it('the no-token caller never logs in, the others go login → token → call → validation', () => {
    const phases = (s: SeqScenario) => [...new Set(traceJwtSequence(s).at(-1)!.state.events.map((e) => e.phase))];
    expect(phases('ok')).toEqual(PHASES);
    expect(phases('no-token')).toEqual(['api-call', 'validation']);
  });

  it('can show only some phases', () => {
    const t = traceJwtSequence('ok', ['api-call', 'validation']);
    expect(t.every((s) => s.state.events.every((e) => e.phase === 'api-call' || e.phase === 'validation'))).toBe(true);
  });

  it('highlights the TokenValidationParameters line of each check', () => {
    const lines = JWT_VALIDATION_CODE.split('\n');
    const text = (ls: number[]) => ls.map((l) => lines[l - 1]!.trim());
    expect(text(SEQ_LINES.signature)).toEqual(['ValidateIssuerSigningKey = true,', 'IssuerSigningKey = new SymmetricSecurityKey(']);
    expect(text(SEQ_LINES.issuer)).toEqual(['ValidateIssuer = true,', 'ValidIssuer = builder.Configuration["Jwt:Issuer"],']);
    expect(text(SEQ_LINES.audience)).toEqual(['ValidateAudience = true,', 'ValidAudience = builder.Configuration["Jwt:Audience"],']);
    expect(text(SEQ_LINES.lifetime)).toEqual(['ValidateLifetime = true,', 'ClockSkew = TimeSpan.FromMinutes(1)']);
    const exp = traceJwtSequence('expired').find((s) => s.state.events.at(-1)!.label.startsWith('exp'))!;
    expect(exp.state.codeLines).toEqual(SEQ_LINES.lifetime);
    expect(exp.predict!.answer).toBe(1);
  });

  it('every step is well formed', () => {
    for (const { id } of SEQ_SCENARIOS)
      for (const s of traceJwtSequence(id)) {
        expect(s.narration.length).toBeGreaterThan(20);
        expect(s.state.current).toBe(s.state.events.length - 1);
        if (s.predict) expect(s.predict.answer).toBeLessThan(s.predict.options.length);
      }
  });
});
