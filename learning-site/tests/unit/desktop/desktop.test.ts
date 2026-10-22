import { describe, expect, it } from 'vitest';
import { BINDING_LINES, bindingTrace } from '../../../src/viz/desktop/binding';
import { CODE, commandTrace } from '../../../src/viz/desktop/command';
import { BINDING_VM, dedent } from '../../../src/viz/desktop/csharp';
import { clampOptions, debounceTrace, keystrokeTimes } from '../../../src/viz/desktop/debounce';

describe('data binding trace', () => {
  const last = <T>(a: T[]) => a[a.length - 1]!;
  it('TwoWay follows both directions, OneWay follows the source, OneTime keeps its first value', () => {
    const t = bindingTrace();
    const end = last(t).state;
    expect(end.source).toEqual({ Name: 'Aman Kumar', Status: 'Name changed to: Aman Kumar' });
    expect(end.target).toEqual({ TwoWay: 'Aman Kumar', OneWay: 'Name changed to: Aman Kumar', OneTime: 'Aman' });
    // after binding, the OneTime label never changes again
    const bound = t.findIndex((s) => s.state.active === 'bind');
    for (const s of t.slice(bound)) expect(s.state.target.OneTime).toBe('Aman');
  });
  it('typing updates the source before anything is notified (target → source)', () => {
    const t = bindingTrace({ typed: 'Zoe' });
    const typed = t.find((s) => s.state.active === 'ui')!;
    expect(typed.state.target.TwoWay).toBe('Zoe');
    expect(typed.state.flows).toEqual([{ mode: 'TwoWay', to: 'source' }]);
    expect(t.some((s) => s.state.active === 'ui' && s.state.source.Name === 'Zoe')).toBe(true);
  });
  it('PropertyChanged is heard only by OneWay/TwoWay bindings on that property', () => {
    for (const s of bindingTrace()) {
      if (!s.state.event) continue;
      expect(s.state.event.heard).not.toContain('OneTime');
      if (s.state.event.property === 'Status') expect(s.state.event.heard).toEqual(['OneWay']);
      if (s.state.event.property === 'Name') expect(s.state.event.heard).toEqual(['TwoWay']);
      expect([BINDING_LINES.notifyName, BINDING_LINES.notifyStatus]).toContain(s.codeLine);
    }
  });
  it('without INotifyPropertyChanged, changes made in the ViewModel never reach the UI', () => {
    const end = bindingTrace({ notify: false }).at(-1)!.state;
    expect(end.source.Name).toBe('Aman Kumar');
    expect(end.target).toEqual({ TwoWay: 'Riya', OneWay: 'Waiting for input...', OneTime: 'Aman' });
  });
  it('typing the same value returns early from the setter', () => {
    const t = bindingTrace({ typed: 'Aman' });
    const ui = t.filter((s) => s.state.active === 'ui');
    expect(ui.map((s) => s.codeLine)).toEqual([0, BINDING_LINES.ifName]);
  });
  it('shows only the placed modes', () => {
    const t = bindingTrace({ modes: ['OneWay', 'OneTime'] });
    expect(t.some((s) => s.state.active === 'ui')).toBe(false);
    expect(t.at(-1)!.state.target.OneWay).toBe('Name changed to: Aman Kumar');
  });
  it('highlights real lines of the note code', () => {
    const n = BINDING_VM.split('\n').length;
    for (const s of bindingTrace()) expect(s.codeLine >= 0 && s.codeLine <= n).toBe(true);
    expect(BINDING_VM.split('\n')[BINDING_LINES.setName - 1]!.trim()).toBe('_name = value;');
    expect(dedent(BINDING_VM).split('\n')[0]).toBe('public string Name');
  });
});

describe('CanExecute trace', () => {
  it('manual: the button follows CanDelete() only after RaiseCanExecuteChanged', () => {
    const t = commandTrace({ variant: 'manual', select: 2 });
    for (const s of t) {
      if (s.state.button === 'enabled' && !s.state.stale) expect(s.state.selected).not.toBeNull();
      expect(s.codeLine).toBeGreaterThan(0);
      expect(s.codeLine).toBeLessThanOrEqual(CODE[s.file].code.split('\n').length);
    }
    const enabledAt = t.findIndex((s) => s.state.button === 'enabled');
    expect(t.slice(0, enabledAt).some((s) => s.state.event === 'CanExecuteChanged')).toBe(true);
    expect(t.filter((s) => s.state.event === 'CanExecuteChanged')).toHaveLength(2);
    const end = t.at(-1)!.state;
    expect(end.rows.map((r) => r.category)).toEqual(['Food']);
    expect(end.button).toBe('disabled');
    expect(end.selected).toBeNull();
  });
  it('CommandManager: InvalidateRequerySuggested → RequerySuggested → CanExecute → enabled', () => {
    const t = commandTrace({ variant: 'commandmanager' });
    const i = t.findIndex((s) => s.state.event === 'RequerySuggested');
    expect(i).toBeGreaterThan(0);
    expect(t[i - 1]!.narration).toContain('InvalidateRequerySuggested');
    expect(t.slice(i + 1).some((s) => s.state.asking && s.state.canExecute === true)).toBe(true);
    expect(t.at(-1)!.state.button).toBe('enabled');
  });
  it('without a notification the button is stale until WPF re-queries on its own', () => {
    const t = commandTrace({ variant: 'none' });
    const stale = t.filter((s) => s.state.stale);
    expect(stale.length).toBeGreaterThan(0);
    for (const s of stale) {
      expect(s.state.selected).not.toBeNull();
      expect(s.state.button).toBe('disabled');
    }
    expect(t.at(-1)!.state).toMatchObject({ button: 'enabled', stale: false });
  });
});

describe('debounce trace', () => {
  const searches = (o: Parameters<typeof debounceTrace>[0]) => debounceTrace(o).at(-1)!.state.searches;
  it('"Task" typed quickly searches once, after the interval', () => {
    const t = debounceTrace({ text: 'Task', gapMs: 120, delayMs: 300 });
    const end = t.at(-1)!.state;
    expect(end.searches).toEqual([{ t: 360 + 300, text: 'Task' }]);
    expect(end.naive.map((n) => n.text)).toEqual(['T', 'Ta', 'Tas', 'Task']);
    expect(end.timers.map((x) => x.status)).toEqual(['cancelled', 'cancelled', 'cancelled', 'fired']);
  });
  it('typing slower than the interval searches every time', () => {
    expect(searches({ text: 'Task', gapMs: 400, delayMs: 300 }).map((s) => s.text)).toEqual(['T', 'Ta', 'Tas', 'Task']);
  });
  it('a pause in the middle runs one search for the prefix and one at the end', () => {
    expect(searches({ text: 'Task', gapMs: 100, delayMs: 300, pauseAfter: 2 }).map((s) => s.text)).toEqual(['Ta', 'Task']);
    expect(keystrokeTimes(clampOptions({ text: 'Task', gapMs: 100, delayMs: 300, pauseAfter: 2 }))).toEqual([0, 100, 800, 900]);
  });
  it('keeps time moving forward with at most one countdown pending', () => {
    for (const o of [{}, { gapMs: 350 }, { text: 'debounce', gapMs: 60, pauseAfter: 4 }]) {
      const t = debounceTrace(o);
      let time = 0;
      for (const s of t) {
        expect(s.state.time).toBeGreaterThanOrEqual(time);
        time = s.state.time;
        expect(s.state.timers.filter((x) => x.status === 'pending').length).toBeLessThanOrEqual(1);
        for (const x of s.state.timers) if (x.status === 'cancelled') expect(x.end!).toBeLessThan(x.due);
      }
    }
  });
  it('clamps learner input', () => {
    expect(clampOptions({ text: '  ', gapMs: 1, delayMs: 99999, pauseAfter: 50 })).toEqual({ text: 'Task', gapMs: 40, delayMs: 1000, pauseAfter: 3 });
  });
});
