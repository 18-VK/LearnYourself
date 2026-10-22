import { describe, expect, it } from 'vitest';
import { DEFAULT_OPS, INV_SCENARIOS, invPart, sandboxCode, sandboxPart, type SandboxOp } from '../../../src/viz/csharp/traces/invocation';
import { expectWellFormed } from './helpers';

const finalOut = (id: string) => invPart(id).trace.at(-1)!.state.output;

describe('invocation lists from the notes', () => {
  for (const id of ['action', 'notify', 'button', 'sensor']) {
    it(`${id} is well formed`, () => {
      const p = invPart(id);
      expectWellFormed(p.trace, p.doc);
    });
  }
  it('Action a += …: prints A then B, from a new delegate object', () => {
    expect(finalOut('action')).toEqual(['A', 'B']);
    const t = invPart('action').trace;
    expect(t[0]!.state.holders[0]!.ref).not.toBe(t[1]!.state.holders[0]!.ref);
  });
  it('Notify: Email sent, then SMS sent', () => {
    expect(finalOut('notify')).toEqual(['Email sent', 'SMS sent']);
  });
  it('Button: the handler runs once; after -= the event is null and the second click prints only the button message', () => {
    expect(finalOut('button')).toEqual(['Button is being clicked...', 'Button was clicked! (Handler executed)', 'Button is being clicked...']);
    const t = invPart('button').trace;
    const afterUnsub = t.find((s) => s.narration.startsWith('Unsubscribing'))!;
    expect(afterUnsub.state.holders[0]!.ref).toBeNull();
    expect(afterUnsub.state.delegates).toEqual([]);
  });
  it('TemperatureSensor prints both changes, formatting 23.0 as 23', () => {
    expect(finalOut('sensor')).toEqual(['Temp changed from 0 to 22.5', 'Temp changed from 22.5 to 23']);
  });
  it('each scenario offers the note examples plus Try it', () => {
    expect(INV_SCENARIOS['multicast-delegate'].parts.map((p) => p.id)).toEqual(['action', 'notify', 'sandbox']);
    expect(INV_SCENARIOS['event-subscribers'].parts.map((p) => p.id)).toEqual(['button', 'sensor', 'sandbox']);
  });
});

describe('Try it: the note’s multicast rules', () => {
  const run = (ops: SandboxOp[], returnsValue = false, bThrows = false) => sandboxPart(ops, { returnsValue, bThrows });
  it('the default operations print A B C, then A C after removing B', () => {
    const p = run(DEFAULT_OPS);
    expectWellFormed(p.trace, p.doc);
    expect(p.trace.at(-1)!.state.output).toEqual(['A', 'B', 'C', 'A', 'C']);
  });
  it('the caller of a Func gets the last return value', () => {
    const p = run([{ kind: 'add', handler: 'A' }, { kind: 'add', handler: 'B' }, { kind: 'add', handler: 'C' }, { kind: 'invoke' }], true);
    expect(p.trace.at(-1)!.state.result).toBe('3');
    const q = p.trace.find((s) => s.predict)!;
    expect(q.predict!.options[q.predict!.answer]).toBe('3');
  });
  it('-= removes the last occurrence (A, B, A then -= A leaves A, B), and removing everything gives null', () => {
    const p = run([{ kind: 'add', handler: 'A' }, { kind: 'add', handler: 'B' }, { kind: 'add', handler: 'A' }, { kind: 'remove', handler: 'A' }, { kind: 'invoke' }]);
    expect(p.trace.at(-1)!.state.output).toEqual(['A', 'B']);
    const q = run([{ kind: 'add', handler: 'A' }, { kind: 'remove', handler: 'A' }]);
    expect(q.trace.at(-1)!.state.holders[0]!.ref).toBeNull();
  });
  it('a throwing handler stops the rest of the list', () => {
    const p = run([{ kind: 'add', handler: 'A' }, { kind: 'add', handler: 'B' }, { kind: 'add', handler: 'C' }, { kind: 'invoke' }], false, true);
    expect(p.trace.at(-1)!.state.output).toEqual(['A']);
    expect(p.trace.some((s) => s.state.error === 'Exception thrown by B')).toBe(true);
  });
  it('calling a null delegate is a NullReferenceException', () => {
    const p = run([{ kind: 'invoke' }]);
    expect(p.trace.some((s) => s.state.error === 'NullReferenceException')).toBe(true);
  });
  it('one code line per operation, highlighted in order', () => {
    const p = run(DEFAULT_OPS);
    expect(sandboxCode(DEFAULT_OPS, { returnsValue: false, bThrows: false }).split('\n')).toEqual(['Action h = null;', 'h += A;', 'h += B;', 'h += C;', 'h();', 'h -= B;', 'h();']);
    const lines = p.trace.map((s) => s.codeLine);
    for (let i = 1; i < lines.length; i++) expect(lines[i]).toBeGreaterThanOrEqual(lines[i - 1]!);
  });
});
