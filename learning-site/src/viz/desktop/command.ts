/**
 * Trace for CommandCanExecuteVisualizer, from 5.RelayCommandNOther.md: a Delete button bound to a
 * RelayCommand whose CanExecute is `SelectedTransaction != null`.
 *
 * - manual:  the note's "Manual RelayCommand (PURE MVVM)" example, where the setter calls
 *            DeleteCommand.RaiseCanExecuteChanged().
 * - commandmanager: the "Real example", where the setter calls CommandManager.InvalidateRequerySuggested()
 *            and the command's CanExecuteChanged is wired to CommandManager.RequerySuggested.
 * - none:    `SelectedTransaction { get; set; }` with nothing telling WPF the selection changed.
 */
import { lines } from '../engine/code';
import { COMMAND_AUTO, COMMAND_CM_CREATE, COMMAND_CM_EVENT, COMMAND_CM_VM, COMMAND_RELAY, COMMAND_VM } from './csharp';

export type CommandVariant = 'manual' | 'commandmanager' | 'none';
export type CodeFile = 'vm' | 'relay' | 'cmVm' | 'cmCreate' | 'cmEvent' | 'auto';
export const CODE: Record<CodeFile, { title: string; code: string }> = {
  vm: { title: 'TransactionViewModel', code: COMMAND_VM },
  relay: { title: 'RelayCommand (manual)', code: COMMAND_RELAY },
  cmVm: { title: 'SelectedTransaction (CommandManager)', code: COMMAND_CM_VM },
  cmCreate: { title: 'DeleteSelectedCommand', code: COMMAND_CM_CREATE },
  cmEvent: { title: 'RelayCommand.CanExecuteChanged', code: COMMAND_CM_EVENT },
  auto: { title: 'SelectedTransaction', code: COMMAND_AUTO },
};

export interface Row {
  id: number;
  category: string;
  amount: number;
}
export interface CommandState {
  rows: Row[];
  selected: number | null;
  button: 'enabled' | 'disabled';
  /** result of the latest CanExecute() call, null before the first one */
  canExecute: boolean | null;
  /** the notification raised in this step */
  event: 'CanExecuteChanged' | 'RequerySuggested' | null;
  /** the button is calling CanExecute() in this step */
  asking: boolean;
  /** the button was clicked in this step */
  clicked: boolean;
  /** the button's enabled state no longer matches CanExecute (nobody asked it again) */
  stale: boolean;
}
export interface CommandStep {
  state: CommandState;
  file: CodeFile;
  codeLine: number;
  narration: string;
}

const ROWS: Row[] = [
  { id: 1, category: 'Food', amount: 200 },
  { id: 2, category: 'Salary', amount: 50000 },
];

export function commandTrace(opts: { variant?: CommandVariant; select?: number } = {}): CommandStep[] {
  const variant = opts.variant ?? 'manual';
  const pick = ROWS.find((r) => r.id === opts.select) ?? ROWS[0]!;
  const steps: CommandStep[] = [];
  let st: CommandState = { rows: [], selected: null, button: 'disabled', canExecute: null, event: null, asking: false, clicked: false, stale: false };
  const push = (file: CodeFile, codeLine: number, narration: string, change: Partial<CommandState> = {}) => {
    st = { ...st, event: null, asking: false, clicked: false, ...change };
    steps.push({ state: st, file, codeLine, narration });
  };
  const rowText = `${pick.category} ${pick.amount}`;

  if (variant === 'manual') {
    const vm = lines(COMMAND_VM, {
      add: 'Transactions.Add(new Transaction { Id = 1',
      create: 'DeleteCommand = new RelayCommand(Delete, CanDelete);',
      set: '_selectedTransaction = value;',
      notify: 'OnPropertyChanged();',
      raise: 'DeleteCommand.RaiseCanExecuteChanged();',
      canDelete: '=> SelectedTransaction != null;',
      remove: 'Transactions.Remove(SelectedTransaction);',
      clear: 'SelectedTransaction = null;',
    });
    const rc = lines(COMMAND_RELAY, { can: '=> _canExecute == null || _canExecute();', exec: '=> _execute();', invoke: '=> CanExecuteChanged?.Invoke(this, EventArgs.Empty);' });
    push('vm', vm.add, 'TransactionViewModel() adds two transactions: Food 200 and Salary 50000.', { rows: ROWS });
    push('vm', vm.create, 'DeleteCommand = new RelayCommand(Delete, CanDelete): Delete is what Execute runs, CanDelete is what CanExecute asks.');
    push('relay', rc.can, 'App starts. The button asks the command: CanExecute()?', { asking: true });
    push('vm', vm.canDelete, 'SelectedTransaction = null, so CanDelete() → false. Button disabled.', { canExecute: false, button: 'disabled' });
    push('vm', vm.set, `You select a row (${rowText}). The SelectedTransaction setter runs: _selectedTransaction = value;`, { selected: pick.id });
    push('vm', vm.notify, 'OnPropertyChanged() tells the UI the selection changed. The button is not asked anything by this.');
    push('vm', vm.raise, 'DeleteCommand.RaiseCanExecuteChanged(): explicitly notify the command.');
    push('relay', rc.invoke, 'RaiseCanExecuteChanged raises CanExecuteChanged.', { event: 'CanExecuteChanged' });
    push('relay', rc.can, 'The button handles CanExecuteChanged by asking CanExecute() again.', { asking: true });
    push('vm', vm.canDelete, 'SelectedTransaction is set, so CanDelete() → true. The button becomes enabled.', { canExecute: true, button: 'enabled' });
    push('relay', rc.exec, 'You click Delete. Execute() runs the Delete action.', { clicked: true });
    push('vm', vm.remove, `Transactions.Remove(SelectedTransaction) removes ${rowText}.`, { rows: st.rows.filter((r) => r.id !== pick.id) });
    push('vm', vm.clear, 'SelectedTransaction = null; runs the setter again… The button still shows enabled until someone asks CanExecute() again.', { selected: null, stale: true });
    push('vm', vm.raise, '…which calls DeleteCommand.RaiseCanExecuteChanged() again.', { stale: true });
    push('relay', rc.invoke, 'CanExecuteChanged is raised.', { event: 'CanExecuteChanged', stale: true });
    push('relay', rc.can, 'The button asks CanExecute() again.', { asking: true, stale: true });
    push('vm', vm.canDelete, 'Nothing is selected, so CanDelete() → false. Button disabled again.', { canExecute: false, button: 'disabled', stale: false });
    return steps;
  }

  if (variant === 'commandmanager') {
    const cm = lines(COMMAND_CM_VM, { set: '_selectedTransaction = value;', notify: 'OnPropertyChanged();', invalidate: 'CommandManager.InvalidateRequerySuggested();' });
    const cr = lines(COMMAND_CM_CREATE, { create: 'DeleteSelectedCommand =', lambda: '() => SelectedTransaction != null' });
    const ev = lines(COMMAND_CM_EVENT, { add: 'add    { CommandManager.RequerySuggested += value; }' });
    push('cmCreate', cr.create, 'The ViewModel has two transactions and creates DeleteSelectedCommand with CanExecute = () => SelectedTransaction != null.', { rows: ROWS });
    push('cmEvent', ev.add, "The button subscribes to the command's CanExecuteChanged, which this RelayCommand forwards to CommandManager.RequerySuggested.");
    push('cmCreate', cr.lambda, 'No row selected: CanExecute → false. Button disabled.', { canExecute: false, button: 'disabled', asking: true });
    push('cmVm', cm.set, `You select a row (${rowText}). The setter runs: _selectedTransaction = value;`, { selected: pick.id });
    push('cmVm', cm.notify, 'OnPropertyChanged() tells the UI the selection changed.');
    push('cmVm', cm.invalidate, 'CommandManager.InvalidateRequerySuggested(): "Re-check all commands NOW."');
    push('cmEvent', ev.add, 'CommandManager raises RequerySuggested.', { event: 'RequerySuggested' });
    push('cmCreate', cr.lambda, 'Button asks Command: CanExecute? A row is selected, so → true.', { asking: true, canExecute: true });
    push('cmCreate', cr.lambda, 'Button enables. Result: no row selected → Disabled, row selected → Enabled.', { button: 'enabled' });
    return steps;
  }

  // none: an auto-property, so nothing tells WPF the selection changed
  const au = lines(COMMAND_AUTO, { set: 'public Transaction SelectedTransaction { get; set; }' });
  const cr = lines(COMMAND_CM_CREATE, { lambda: '() => SelectedTransaction != null' });
  push('cmCreate', cr.lambda, 'App starts with two transactions. CanExecute → false: no row is selected. Button disabled.', { rows: ROWS, canExecute: false, button: 'disabled', asking: true });
  push('auto', au.set, `You select a row (${rowText}). SelectedTransaction is a plain { get; set; } property: the value changes and nothing else happens.`, { selected: pick.id, stale: true });
  push('auto', au.set, "When selection changes: no keyboard event, no mouse event, so WPF doesn't automatically re-evaluate commands. The button stays disabled although a row is selected.", { stale: true });
  push('cmCreate', cr.lambda, 'Later, keyboard focus changes, one of the things that makes WPF call CanExecute() again. CanExecute → true and the button enables: "sometimes your button updates even when you didn\'t do anything."', {
    asking: true,
    canExecute: true,
    button: 'enabled',
    stale: false,
  });
  return steps;
}
