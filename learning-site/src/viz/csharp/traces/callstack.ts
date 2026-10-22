import type { Prediction, Trace } from '../../engine/types';
import { docOf, linesIn, Recorder, type CodeDoc } from '../shared/step';

/*
 * Exceptions travelling up the call stack, from 12.C#_ExceptionHandling/Note.md: the BasicExample
 * (try / two catches / finally), Re-Throwing exceptions (throw; from ProcessData to Main) and the custom
 * InsufficientFundsException example.
 *
 * Runtime facts beyond the note:
 *  - when an exception is thrown, the runtime looks for the first catch clause that matches, starting in
 *    the current method and going up the call stack; a finally block runs when control leaves its try,
 *    whether or not an exception was thrown:
 *    https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements
 *  - accessing an array outside its bounds throws IndexOutOfRangeException, whose message is
 *    "Index was outside the bounds of the array.":
 *    https://learn.microsoft.com/en-us/dotnet/api/system.indexoutofrangeexception
 *  - int.Parse throws FormatException for text that isn't a number; its message wording has changed between
 *    .NET versions, so it is shown as "…": https://learn.microsoft.com/en-us/dotnet/api/system.int32.parse
 */

export interface CsFrame {
  method: string;
  /** What the frame is doing: running normally, inside a catch, inside finally, or being unwound. */
  status: 'running' | 'catch' | 'finally' | 'unwinding' | 'waiting';
}

export interface CsException {
  type: string;
  message: string;
  /** Methods on the stack when it was thrown, innermost first (what ex.StackTrace lists). */
  trace: string[];
  /** Where it is now. */
  at: string;
  handled: boolean;
}

export interface CsState {
  /** Bottom (Main) first. */
  frames: CsFrame[];
  exception: CsException | null;
  output: string[];
  /** Catch clause being tested and whether it matched. */
  test: { clause: string; match: boolean } | null;
  /** Lines skipped because of the exception. */
  skipped: number[];
}

export interface CsPart {
  id: string;
  label: string;
  doc: CodeDoc;
  trace: Trace<CsState>;
}

class Stack {
  readonly r = new Recorder<CsState>();
  s: CsState = { frames: [], exception: null, output: [], test: null, skipped: [] };
  push(method: string): void {
    for (const f of this.s.frames) f.status = 'waiting';
    this.s.frames.push({ method, status: 'running' });
  }
  pop(): void {
    this.s.frames.pop();
    const top = this.s.frames[this.s.frames.length - 1];
    if (top) top.status = 'running';
  }
  top(): CsFrame {
    return this.s.frames[this.s.frames.length - 1]!;
  }
  step(line: number, narration: string, opts: { predict?: Prediction; action?: 'start' | 'call' | 'return' | 'branch' | 'write' | 'compare' | 'done' } = {}): void {
    const vars: Record<string, string | number> = { 'stack depth': this.s.frames.length };
    if (this.s.exception) vars.exception = `${this.s.exception.type}${this.s.exception.handled ? ' (handled)' : ''}`;
    this.r.push(this.s, { action: opts.action ?? 'call', line, narration, predict: opts.predict, vars });
    this.s.test = null;
  }
}

function basic(): CsPart {
  const doc = docOf('exBasic');
  const L = linesIn(doc, 0, {
    main: 'static void Main()',
    before: 'Console.WriteLine("Before exception");',
    parse: 'int x = int.Parse("not-a-number");',
    notRun: 'Console.WriteLine("This line will NOT run");',
    c1: 'catch (FormatException ex)',
    c1body: 'Console.WriteLine("Caught FormatException: " + ex.Message);',
    c2: 'catch (Exception ex) // fallback for unexpected exceptions',
    fin: 'finally',
    finBody: 'Console.WriteLine("Finally block: cleanup here");',
  });
  // Main's closing brace: the line before the class's closing brace
  const end = doc.parts[0]!.code.split('\n').length - 1;
  const st = new Stack();
  st.push('Main');
  st.step(L.main, 'Main starts: it is the only frame on the call stack.', { action: 'start' });
  st.s.output.push('Before exception');
  st.step(L.before, 'Inside the try block: prints "Before exception".');
  st.push('int.Parse');
  st.step(L.parse, 'Main calls int.Parse("not-a-number"), which gets its own frame on top of Main.');
  st.s.exception = { type: 'FormatException', message: '…', trace: ['int.Parse', 'Main'], at: 'int.Parse', handled: false };
  st.top().status = 'unwinding';
  st.step(L.parse, '"not-a-number" is not a number, so int.Parse throws a FormatException. int.Parse has no handler for it, so its frame is abandoned (unwound).', { action: 'branch' });
  st.pop();
  st.s.exception.at = 'Main';
  st.s.skipped.push(L.notRun);
  st.step(L.parse, 'The exception arrives in Main, inside the try block. The rest of the try is skipped: "This line will NOT run".', { action: 'branch' });
  st.s.test = { clause: 'catch (FormatException ex)', match: true };
  st.step(L.c1, 'The runtime checks Main’s catch clauses in order. The first one, catch (FormatException ex), matches.', {
    action: 'compare',
    predict: { question: 'Which catch block handles this exception?', options: ['catch (FormatException ex)', 'catch (Exception ex)', 'Both, in order'], answer: 0 },
  });
  st.top().status = 'catch';
  st.s.exception.handled = true;
  st.s.output.push('Caught FormatException: …');
  st.step(L.c1body, 'The catch block runs and prints the message (its exact wording depends on the .NET version, so it is shown as …). The exception is now handled.', { action: 'write' });
  st.s.skipped.push(L.c2 + 2);
  st.step(L.c2, 'Only the first matching catch runs, so catch (Exception ex) is skipped. "We can have multiple Catch blocks", checked top to bottom.', { action: 'branch' });
  st.top().status = 'finally';
  st.s.output.push('Finally block: cleanup here');
  st.step(L.finBody, 'Leaving the try/catch always runs finally: "Runs whether or not an exception was thrown".', {
    action: 'write',
    predict: { question: 'The exception was already caught. Does the finally block still run?', options: ['Yes', 'No'], answer: 0 },
  });
  st.top().status = 'running';
  st.s.exception = null;
  st.pop();
  st.step(end, 'Main returns normally. The program did not crash, because the exception was caught.', { action: 'done' });
  return { id: 'basic', label: 'try / catch / finally', doc, trace: st.r.steps };
}

export const INDEX_MESSAGE = 'Index was outside the bounds of the array.';

function rethrow(): CsPart {
  const doc = docOf('exRethrow');
  const L = linesIn(doc, 0, {
    main: 'static void Main()',
    call: 'ProcessData();',
    mainCatch: ['catch (Exception ex)', 1],
    mainPrint: 'Console.WriteLine("Exception caught in Main: " + ex.Message);',
    pd: 'static void ProcessData()',
    arr: 'int[] numbers = { 1, 2, 3 };',
    bad: 'Console.WriteLine(numbers[5]);',
    pdCatch: ['catch (Exception ex)', 2],
    pdPrint: 'Console.WriteLine("Exception caught in ProcessData: " + ex.Message);',
    rethrow: 'throw; // Re-throws the same exception',
  });
  // Main's closing brace sits two lines above `static void ProcessData()`
  const mainEnd = L.pd - 2;
  const st = new Stack();
  st.push('Main');
  st.step(L.main, 'Main starts.', { action: 'start' });
  st.push('ProcessData');
  st.step(L.call, 'Inside its try block, Main calls ProcessData(). The stack is now Main → ProcessData.');
  st.step(L.arr, 'ProcessData’s try block creates an array of three elements: indexes 0, 1 and 2.', { action: 'write' });
  st.s.exception = { type: 'IndexOutOfRangeException', message: INDEX_MESSAGE, trace: ['ProcessData', 'Main'], at: 'ProcessData', handled: false };
  st.step(L.bad, 'numbers[5] is outside the array, so the runtime throws IndexOutOfRangeException. Its stack trace records where it happened: ProcessData, called from Main.', { action: 'branch' });
  st.s.test = { clause: 'catch (Exception ex)', match: true };
  st.step(L.pdCatch, 'The search starts in the innermost frame. ProcessData’s catch (Exception ex) matches: IndexOutOfRangeException is an Exception.', { action: 'compare' });
  st.top().status = 'catch';
  st.s.exception.handled = true;
  st.s.output.push(`Exception caught in ProcessData: ${INDEX_MESSAGE}`);
  st.step(L.pdPrint, 'ProcessData logs the message…', { action: 'write' });
  st.s.exception.handled = false;
  st.top().status = 'unwinding';
  st.step(L.rethrow, '…then throw; re-throws the same exception object. "throw; keeps the original stack trace" (throw ex; would reset it to this line). ProcessData has no other handler, so its frame is unwound.', {
    action: 'branch',
    predict: { question: 'Where does the exception go after throw; ?', options: ['To Main’s catch block', 'Back into ProcessData’s try', 'The program crashes immediately'], answer: 0 },
  });
  st.pop();
  st.s.exception.at = 'Main';
  st.step(L.call, 'The exception arrives in Main, at the ProcessData() call inside Main’s try.', { action: 'branch' });
  st.s.test = { clause: 'catch (Exception ex)', match: true };
  st.step(L.mainCatch, 'Main’s catch (Exception ex) matches.', { action: 'compare' });
  st.top().status = 'catch';
  st.s.exception.handled = true;
  st.s.output.push(`Exception caught in Main: ${INDEX_MESSAGE}`);
  st.step(L.mainPrint, `Main logs it once more: "The exception is then caught again in Main(), where it's logged once more."`, { action: 'write' });
  st.s.exception = null;
  st.pop();
  st.step(mainEnd, 'Main returns. One exception, caught twice: once to log, once to handle.', { action: 'done' });
  return { id: 'rethrow', label: 'Re-throwing with throw;', doc, trace: st.r.steps };
}

export const CUSTOM_MESSAGE = 'Cannot withdraw 700. Available balance is 500.';

function custom(): CsPart {
  const doc = docOf('exCustomThrow', 'exCustomCatch');
  const B = linesIn(doc, 0, {
    ctor: 'public BankAccount(decimal initialBalance)',
    init: 'balance = initialBalance;',
    withdraw: 'public void Withdraw(decimal amount)',
    check: 'if (amount > balance)',
    thr: 'throw new InsufficientFundsException(',
    sub: 'balance -= amount;',
  });
  const M = linesIn(doc, 1, {
    main: 'static void Main()',
    make: 'BankAccount account = new BankAccount(500);',
    call: 'account.Withdraw(700);',
    c1: 'catch (InsufficientFundsException ex)',
    c1body: 'Console.WriteLine($"Custom Exception Caught: {ex.Message}");',
    c2: 'catch (Exception ex)',
  });
  const st = new Stack();
  st.push('Main');
  st.step(M.main, 'Main starts.', { action: 'start' });
  st.push('BankAccount (constructor)');
  st.step(B.init, 'new BankAccount(500) runs the constructor in its own frame: balance = 500.', { action: 'write' });
  st.pop();
  st.step(M.make, 'The constructor returns; account is ready.', { action: 'return' });
  st.push('Withdraw');
  st.step(B.withdraw, 'Inside Main’s try, account.Withdraw(700) gets a frame on top of Main.');
  st.step(B.check, '700 > 500, so the if block runs.', { action: 'compare' });
  st.s.exception = { type: 'InsufficientFundsException', message: CUSTOM_MESSAGE, trace: ['Withdraw', 'Main'], at: 'Withdraw', handled: false };
  st.top().status = 'unwinding';
  st.s.skipped.push(B.sub, B.sub + 1);
  st.step(B.thr, `Withdraw throws the custom exception: "${CUSTOM_MESSAGE}". Withdraw has no try/catch, so its frame is unwound: balance -= amount and the success message never run.`, {
    action: 'branch',
    predict: { question: 'Does balance -= amount run?', options: ['Yes, before the exception leaves', 'No, the rest of Withdraw is skipped'], answer: 1 },
  });
  st.pop();
  st.s.exception.at = 'Main';
  st.s.test = { clause: 'catch (InsufficientFundsException ex)', match: true };
  st.step(M.c1, 'Back in Main, the first catch clause names exactly this exception type, so it matches.', {
    action: 'compare',
    predict: { question: 'Which catch block runs?', options: ['catch (InsufficientFundsException ex)', 'catch (Exception ex)'], answer: 0 },
  });
  st.top().status = 'catch';
  st.s.exception.handled = true;
  st.s.output.push(`Custom Exception Caught: ${CUSTOM_MESSAGE}`);
  st.step(M.c1body, 'The handler prints the custom message.', { action: 'write' });
  st.s.skipped.push(M.c2 + 2);
  st.step(M.c2, 'catch (Exception ex) is skipped: the more specific handler already ran. Put specific catches before general ones.', { action: 'branch' });
  st.s.exception = null;
  st.pop();
  st.step(M.main, 'Main returns.', { action: 'done' });
  return { id: 'custom', label: 'Custom exception', doc, trace: st.r.steps };
}

export const CS_PARTS = [
  { id: 'basic', label: 'try / catch / finally' },
  { id: 'rethrow', label: 'Re-throwing with throw;' },
  { id: 'custom', label: 'Custom exception' },
] as const;

export function csPart(id: string): CsPart {
  return id === 'rethrow' ? rethrow() : id === 'custom' ? custom() : basic();
}
