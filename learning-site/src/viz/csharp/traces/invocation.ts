import type { Prediction, Trace } from '../../engine/types';
import { docOf, lineIn, linesIn, Recorder, type CodeDoc } from '../shared/step';

/*
 * Delegate invocation lists, from 5.C#_delegates/Note.md (Multicast behavior, the Notify example) and
 * 15.C#_AdvanceTopics/EventsNEventHandling.md (the Button and TemperatureSensor examples, Multicast and
 * ordering). A "try it" part applies the note's rules to operations the learner picks.
 *
 * Runtime facts beyond the notes:
 *  - delegates are immutable: += (Delegate.Combine) returns a new delegate whose invocation list is the old
 *    list followed by the new one: https://learn.microsoft.com/en-us/dotnet/api/system.delegate.combine
 *  - -= (Delegate.Remove) removes the last occurrence of the handler's list and returns null when nothing is
 *    left: https://learn.microsoft.com/en-us/dotnet/api/system.delegate.remove
 *  - invoking a multicast delegate calls the list in order; with a return value, the caller gets the last
 *    method's result: https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/delegates/using-delegates
 *    (checked on .NET: Func<int> 1 += 2 += 3 returns 3; A, B, A then -= A leaves A, B)
 */

export interface InvHandler {
  /** "() => Console.WriteLine(\"A\")", "alerts.SendEmail", "MyButton_Click" */
  label: string;
}

export interface InvDelegate {
  id: string;
  list: InvHandler[];
}

export interface InvState {
  /** Delegate variables, fields and events: what each refers to (null = no delegate). */
  holders: { name: string; ref: string | null }[];
  delegates: InvDelegate[];
  /** Delegate being invoked and the position in its list that is running. */
  invoking: { id: string; at: number } | null;
  output: string[];
  /** Return values seen during the current invocation (Func), and what the caller got. */
  returns: number[];
  result: string | null;
  error: string | null;
  /** Holder or delegate changed in this step. */
  changed: string | null;
}

export interface InvPart {
  id: string;
  label: string;
  doc: CodeDoc;
  trace: Trace<InvState>;
}

class Inv {
  readonly r = new Recorder<InvState>();
  s: InvState = { holders: [], delegates: [], invoking: null, output: [], returns: [], result: null, error: null, changed: null };
  private next = 1;
  holder(name: string): { name: string; ref: string | null } {
    let h = this.s.holders.find((x) => x.name === name);
    if (!h) {
      h = { name, ref: null };
      this.s.holders.push(h);
    }
    return h;
  }
  list(name: string): InvHandler[] {
    const ref = this.holder(name).ref;
    return ref ? [...this.s.delegates.find((d) => d.id === ref)!.list] : [];
  }
  /** holder = new delegate with `list` (or null when empty), like Combine/Remove do. */
  assign(name: string, list: InvHandler[]): void {
    const h = this.holder(name);
    if (!list.length) {
      h.ref = null;
    } else {
      const id = `#${this.next++}`;
      this.s.delegates.push({ id, list });
      h.ref = id;
    }
    // keep only delegates something still refers to (older ones are garbage)
    const live = new Set(this.s.holders.map((x) => x.ref));
    this.s.delegates = this.s.delegates.filter((d) => live.has(d.id));
    this.s.changed = name;
  }
  combine(name: string, add: InvHandler): void {
    this.assign(name, [...this.list(name), add]);
  }
  remove(name: string, label: string): boolean {
    const list = this.list(name);
    const k = list.map((x) => x.label).lastIndexOf(label);
    if (k < 0) return false;
    list.splice(k, 1);
    this.assign(name, list);
    return true;
  }
  step(line: number, narration: string, opts: { predict?: Prediction; action?: 'start' | 'call' | 'write' | 'return' | 'done' | 'read' } = {}): void {
    const vars: Record<string, string> = {};
    for (const h of this.s.holders) vars[h.name] = h.ref ? `${h.ref} (${this.list(h.name).length} in list)` : 'null';
    this.r.push(this.s, { action: opts.action ?? 'call', line, narration, predict: opts.predict, vars });
    this.s.changed = null;
  }
}

function action(): InvPart {
  const doc = docOf('delAction');
  const L = linesIn(doc, 0, { a: 'Action a = () => Console.WriteLine("A");', b: 'a += () => Console.WriteLine("B");', call: 'a(); // prints A then B' });
  const m = new Inv();
  const A = { label: '() => Console.WriteLine("A")' };
  const B = { label: '() => Console.WriteLine("B")' };
  m.assign('a', [A]);
  m.step(L.a, 'a refers to a delegate whose invocation list has one method: the lambda that prints A.', { action: 'start' });
  m.combine('a', B);
  m.step(L.b, 'a += … does not change the old delegate (delegates are immutable). It builds a new one whose list is the old list followed by the new lambda, and a now refers to it.', {
    action: 'write',
    predict: { question: 'After a += …, in which order are the two lambdas in the list?', options: ['A then B', 'B then A'], answer: 0 },
  });
  const id = m.s.holders[0]!.ref!;
  m.s.invoking = { id, at: 0 };
  m.s.output.push('A');
  m.step(L.call, 'a() calls every method in the list, in order. First: prints A.', { action: 'call' });
  m.s.invoking = { id, at: 1 };
  m.s.output.push('B');
  m.step(L.call, 'Then the second: prints B. "For Action (void) all handlers are invoked in order."', { action: 'call' });
  m.s.invoking = null;
  m.step(L.call, 'Done: A then B, as the comment says.', { action: 'done' });
  return { id: 'action', label: 'Action a += …', doc, trace: m.r.steps };
}

function notify(): InvPart {
  const doc = docOf('delNotify');
  const L = linesIn(doc, 0, {
    email: 'public void SendEmail() => Console.WriteLine("Email sent");',
    sms: 'public void SendSMS() => Console.WriteLine("SMS sent");',
    first: 'Notify notify = alerts.SendEmail;',
    add: 'notify += alerts.SendSMS;',
    call: 'notify(); // Calls both methods',
  });
  const m = new Inv();
  m.assign('notify', [{ label: 'alerts.SendEmail' }]);
  m.step(L.first, 'notify refers to a Notify delegate holding one method, SendEmail, bound to the alerts object.', { action: 'start' });
  m.combine('notify', { label: 'alerts.SendSMS' });
  m.step(L.add, 'notify += alerts.SendSMS makes a new delegate with both methods; notify now refers to it.', { action: 'write' });
  const id = m.s.holders[0]!.ref!;
  m.s.invoking = { id, at: 0 };
  m.s.output.push('Email sent');
  m.step(L.email, 'notify() runs the list in order: SendEmail prints "Email sent".', {
    predict: { question: 'notify() is called. What prints first?', options: ['Email sent', 'SMS sent'], answer: 0 },
  });
  m.s.invoking = { id, at: 1 };
  m.s.output.push('SMS sent');
  m.step(L.sms, 'Then SendSMS prints "SMS sent".');
  m.s.invoking = null;
  m.step(L.call, 'Done: "Calls both methods", in the order they were added.', { action: 'done' });
  return { id: 'notify', label: 'Notify (multicast)', doc, trace: m.r.steps };
}

function button(): InvPart {
  const doc = docOf('evButton');
  const L = linesIn(doc, 0, {
    sub: 'myButton.Click += MyButton_Click;',
    sim1: ['myButton.SimulateClick();', 1],
    being: 'Console.WriteLine("Button is being clicked...");',
    invoke: 'Click?.Invoke(this, EventArgs.Empty);',
    handler: 'Console.WriteLine("Button was clicked! (Handler executed)");',
    unsub: 'myButton.Click -= MyButton_Click;',
    sim2: ['myButton.SimulateClick();', 2],
  });
  const m = new Inv();
  m.holder('myButton.Click');
  m.step(lineIn(doc, 0, 'Button myButton = new Button();'), 'A new Button. Its Click event has no subscribers: the delegate behind it is null.', { action: 'start' });
  m.combine('myButton.Click', { label: 'MyButton_Click' });
  m.step(L.sub, 'Subscribing with += puts MyButton_Click in the event’s invocation list.', { action: 'write' });
  m.s.output.push('Button is being clicked...');
  m.step(L.being, 'SimulateClick() prints its message first.', { action: 'call' });
  const id = m.s.holders[0]!.ref!;
  m.s.invoking = { id, at: 0 };
  m.s.output.push('Button was clicked! (Handler executed)');
  m.step(L.handler, 'Click?.Invoke(…): Click is not null, so the handler runs.', { action: 'call' });
  m.s.invoking = null;
  m.remove('myButton.Click', 'MyButton_Click');
  m.step(L.unsub, 'Unsubscribing with -= removes MyButton_Click. The list is now empty, so Click is null again.', {
    action: 'write',
    predict: { question: 'After -=, what does the Click event hold?', options: ['An empty list', 'null'], answer: 1 },
  });
  m.s.output.push('Button is being clicked...');
  m.step(L.being, 'The second SimulateClick() prints its message…', { action: 'call' });
  m.step(L.invoke, '…and Click?.Invoke does nothing, because Click is null: "Simulate again, no output from handler".', {
    action: 'read',
    predict: { question: 'Does the handler print this time?', options: ['Yes', 'No'], answer: 1 },
  });
  m.step(L.sim2, 'Done.', { action: 'done' });
  return { id: 'button', label: 'Button.Click (+= and -=)', doc, trace: m.r.steps };
}

function sensor(): InvPart {
  const doc = docOf('evSensor');
  const L = linesIn(doc, 0, {
    subscribe: 'display.Subscribe(sensor);',
    add: 'sensor.TemperatureChanged += Sensor_TemperatureChanged;',
    t1: 'sensor.Temperature = 22.5; // publishing new data',
    t2: 'sensor.Temperature = 23.0; // publishing new data',
    copy: 'var handler = TemperatureChanged;',
    raise: 'handler?.Invoke(this, new TemperatureChangedEventArgs(oldVal, newVal)); // raise the event',
    print: 'Console.WriteLine($"Temp changed from {e.Old} to {e.New}");',
    setter: 'OnTemperatureChanged(old, _temp);',
  });
  const m = new Inv();
  m.holder('sensor.TemperatureChanged');
  m.step(L.subscribe, 'The sensor (publisher) and the display (subscriber) exist. TemperatureChanged has no subscribers yet.', { action: 'start' });
  m.combine('sensor.TemperatureChanged', { label: 'display.Sensor_TemperatureChanged' });
  m.step(L.add, 'Subscribe adds the display’s handler to the event’s invocation list.', { action: 'write' });
  const raise = (oldV: string, newV: string, line: number) => {
    m.step(line, `sensor.Temperature = ${newV === '23' ? '23.0' : newV} runs the property's setter.`, { action: 'call' });
    m.step(L.setter, `The new value differs from ${oldV}, so the setter stores it and calls OnTemperatureChanged(${oldV}, ${newV}).`, { action: 'call' });
    m.s.holders.push({ name: 'handler (local copy)', ref: m.s.holders[0]!.ref });
    m.s.changed = 'handler (local copy)';
    m.step(L.copy, 'OnTemperatureChanged copies the delegate into a local first ("capture local copy for thread-safety"), so the list it invokes can’t change under it.', { action: 'read' });
    m.s.invoking = { id: m.s.holders[0]!.ref!, at: 0 };
    m.s.output.push(`Temp changed from ${oldV} to ${newV}`);
    m.step(L.print, `handler?.Invoke(…) runs the display’s handler: "Temp changed from ${oldV} to ${newV}".`, { action: 'call' });
    m.s.invoking = null;
    m.s.holders = m.s.holders.filter((h) => h.name !== 'handler (local copy)');
  };
  raise('0', '22.5', L.t1);
  raise('22.5', '23', L.t2);
  m.step(L.t2, 'Done. Note the second line prints 23, not 23.0: a double formats without trailing zeros.', { action: 'done' });
  return { id: 'sensor', label: 'TemperatureChanged event', doc, trace: m.r.steps };
}

// ── "Try it": the note's rules on operations the learner picks ───────────────────────────────

export type SandboxOp = { kind: 'add' | 'remove'; handler: 'A' | 'B' | 'C' } | { kind: 'invoke' };
export interface SandboxOptions {
  /** Func<int>: A returns 1, B returns 2, C returns 3. Otherwise Action, printing its letter. */
  returnsValue: boolean;
  /** B throws an exception when called. */
  bThrows: boolean;
}
export const DEFAULT_OPS: SandboxOp[] = [
  { kind: 'add', handler: 'A' },
  { kind: 'add', handler: 'B' },
  { kind: 'add', handler: 'C' },
  { kind: 'invoke' },
  { kind: 'remove', handler: 'B' },
  { kind: 'invoke' },
];

export function sandboxCode(ops: readonly SandboxOp[], o: SandboxOptions): string {
  const lines = [o.returnsValue ? 'Func<int> h = null;' : 'Action h = null;'];
  for (const op of ops) {
    if (op.kind === 'invoke') lines.push(o.returnsValue ? 'int result = h();' : 'h();');
    else lines.push(`h ${op.kind === 'add' ? '+=' : '-='} ${op.handler};`);
  }
  return lines.join('\n');
}

export function sandboxPart(ops: readonly SandboxOp[], o: SandboxOptions): InvPart {
  const code = sandboxCode(ops, o);
  const doc: CodeDoc = { parts: [{ key: null, title: 'Your operations, applying the note’s rules', code }] };
  const m = new Inv();
  const VALUE: Record<string, number> = { A: 1, B: 2, C: 3 };
  m.holder('h');
  m.step(1, `h starts as null. ${o.returnsValue ? 'Handlers A, B and C return 1, 2 and 3.' : 'Handlers A, B and C print their letter.'}${o.bThrows ? ' B throws an exception.' : ''}`, { action: 'start' });
  ops.forEach((op, k) => {
    const line = k + 2;
    if (op.kind === 'add') {
      m.combine('h', { label: op.handler });
      m.step(line, `h += ${op.handler}: a new delegate with ${op.handler} appended at the end of the list.`, { action: 'write' });
    } else if (op.kind === 'remove') {
      const before = m.list('h').map((x) => x.label);
      const ok = m.remove('h', op.handler);
      m.step(
        line,
        ok
          ? `h -= ${op.handler}: removes the last occurrence of ${op.handler}${before.filter((x) => x === op.handler).length > 1 ? ' (it was in the list more than once)' : ''}.${m.list('h').length ? '' : ' Nothing is left, so h is null.'}`
          : `h -= ${op.handler}: ${op.handler} is not in the list, so nothing changes (no error).`,
        { action: 'write' },
      );
    } else {
      const ref = m.holder('h').ref;
      if (!ref) {
        m.s.error = 'NullReferenceException';
        m.step(line, 'h is null, so calling h() throws a NullReferenceException. (That is why events are raised with ?.Invoke.)', { action: 'call' });
        m.s.error = null;
        return;
      }
      const list = m.list('h');
      m.s.returns = [];
      m.s.result = null;
      for (let i = 0; i < list.length; i++) {
        const name = list[i]!.label;
        m.s.invoking = { id: ref, at: i };
        if (o.bThrows && name === 'B') {
          m.s.error = 'Exception thrown by B';
          m.step(line, `B throws. "If any handler throws, invocation stops and exception propagates": ${list.length - i - 1 ? `the ${list.length - i - 1} handler(s) after B never run` : 'B was the last handler anyway'}, and the caller gets the exception instead of a result.`, {
            action: 'call',
            predict: i < list.length - 1 ? { question: 'B throws. Do the handlers after it still run?', options: ['Yes', 'No'], answer: 1 } : undefined,
          });
          m.s.error = null;
          m.s.invoking = null;
          return;
        }
        if (o.returnsValue) m.s.returns.push(VALUE[name]!);
        else m.s.output.push(name);
        m.step(line, o.returnsValue ? `${name} runs and returns ${VALUE[name]}.` : `${name} runs and prints ${name}.`, { action: 'call' });
      }
      m.s.invoking = null;
      if (o.returnsValue) {
        m.s.result = String(m.s.returns[m.s.returns.length - 1]);
        m.s.output.push(`result = ${m.s.result}`);
        m.step(line, `Every handler ran, but "only the last return value is provided to the caller": result = ${m.s.result}.`, {
          action: 'return',
          predict: { question: `The handlers returned ${m.s.returns.join(', ')}. What does the caller get?`, options: [...new Set([String(m.s.returns[0]), String(m.s.returns.reduce((a, b) => a + b, 0)), m.s.result])], answer: 0 },
        });
        const pr = m.r.steps[m.r.steps.length - 1]!.predict!;
        pr.answer = pr.options.indexOf(m.s.result);
        if (pr.options.length < 2) delete m.r.steps[m.r.steps.length - 1]!.predict;
      }
    }
  });
  m.step(ops.length + 1, 'Done. Add more operations above, or change the options.', { action: 'done' });
  return { id: 'sandbox', label: 'Try it', doc, trace: m.r.steps };
}

export type InvScenario = 'multicast-delegate' | 'event-subscribers';
export const INV_SCENARIOS: Record<InvScenario, { title: string; parts: { id: string; label: string }[] }> = {
  'multicast-delegate': {
    title: 'Multicast delegates: the invocation list',
    parts: [
      { id: 'action', label: 'Action a += …' },
      { id: 'notify', label: 'Notify (multicast)' },
      { id: 'sandbox', label: 'Try it' },
    ],
  },
  'event-subscribers': {
    title: 'Events: subscribers in the invocation list',
    parts: [
      { id: 'button', label: 'Button.Click (+= and -=)' },
      { id: 'sensor', label: 'TemperatureChanged event' },
      { id: 'sandbox', label: 'Try it' },
    ],
  },
};

export function toInvScenario(s: unknown): InvScenario {
  return s === 'event-subscribers' ? 'event-subscribers' : 'multicast-delegate';
}

export function invPart(id: string): InvPart {
  if (id === 'notify') return notify();
  if (id === 'button') return button();
  if (id === 'sensor') return sensor();
  return action();
}
