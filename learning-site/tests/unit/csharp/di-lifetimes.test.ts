import { describe, expect, it } from 'vitest';
import { SNIPPETS } from '../../../src/viz/csharp/snippets';
import { captivePart, LIFETIMES, lifetimesPart, outputLine, scopeFactoryPart, type Lifetime } from '../../../src/viz/csharp/traces/di-lifetimes';
import { expectWellFormed } from './helpers';

/** The note's output block for a lifetime, without the "← …" remarks. */
const NOTE_OUT: Record<Lifetime, string> = {
  Transient: SNIPPETS.diTransientOut.code,
  Scoped: SNIPPETS.diScopedOut.code,
  Singleton: SNIPPETS.diSingletonOut.code,
};
const noteLines = (l: Lifetime) => NOTE_OUT[l].split('\n').map((x) => x.replace(/\s*←.*$/, ''));

describe('DI lifetimes (Dependency_Injection.md › Scoped vs Transient)', () => {
  for (const l of LIFETIMES) {
    it(`${l}: prints exactly the note's output for two requests`, () => {
      const part = lifetimesPart(l);
      expectWellFormed(part.trace, part.doc);
      expect(part.trace.at(-1)!.state.output).toEqual(noteLines(l));
    });
  }
  it('builds 4, 2 and 1 Counters for transient, scoped and singleton', () => {
    expect(LIFETIMES.map((l) => lifetimesPart(l).trace.at(-1)!.state.constructed)).toEqual([4, 2, 1]);
  });
  it('asks whether ServiceB shares ServiceA’s Counter, with the right answer for each lifetime', () => {
    for (const l of LIFETIMES) {
      const q = lifetimesPart(l).trace.find((s) => s.predict?.question.startsWith('ServiceB'))!;
      expect(q.predict!.options[q.predict!.answer]).toBe(l === 'Transient' ? 'No, a different one' : 'Yes, the same instance');
    }
  });
  it('lets scoped instances go with their request but keeps the singleton', () => {
    const scoped = lifetimesPart('Scoped').trace.at(-1)!.state;
    expect(scoped.instances.filter((x) => x.type === 'Counter').every((x) => x.disposed)).toBe(true);
    const single = lifetimesPart('Singleton').trace.at(-1)!.state;
    expect(single.instances.find((x) => x.type === 'Counter')).toMatchObject({ owner: 'root' });
    expect(single.instances.find((x) => x.type === 'Counter')!.disposed).toBeFalsy();
  });
  it('formats lines like the note', () => {
    expect(outputLine(1, 1, 2)).toBe('Request 1:  ServiceA gets Counter #1,  ServiceB gets Counter #2');
  });
});

describe('captive dependency', () => {
  it('without validation, request 2 reuses the scoped service built in request 1', () => {
    const part = captivePart(false);
    expectWellFormed(part.trace, part.doc);
    const s = part.trace.at(-1)!.state;
    expect(s.scopes.map((x) => x.graph[0]!.target)).toEqual(['ScopedService #1', 'ScopedService #1']);
    expect(s.instances.find((x) => x.type === 'IScopedService')).toMatchObject({ owner: 'root' });
    expect(s.error).toBeNull();
  });
  it('with scope validation on, resolving the singleton throws InvalidOperationException', () => {
    const part = captivePart(true);
    expectWellFormed(part.trace, part.doc);
    expect(part.trace.at(-1)!.state.error).toMatch(/^InvalidOperationException/);
    expect(part.trace.at(-1)!.state.instances).toEqual([]);
  });
  it('the IServiceScopeFactory fix disposes the DbContext with its scope', () => {
    const part = scopeFactoryPart();
    expectWellFormed(part.trace, part.doc);
    const s = part.trace.at(-1)!.state;
    expect(s.instances.find((x) => x.name === 'AppDbContext #1')).toMatchObject({ owner: 1, disposed: true });
    expect(s.instances.filter((x) => x.owner === 'root').map((x) => x.name)).toEqual(['MyBackgroundService', 'IServiceScopeFactory']);
  });
});
