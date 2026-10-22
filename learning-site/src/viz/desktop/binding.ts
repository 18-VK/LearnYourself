/**
 * Trace for DataBindingVisualizer: the note's MainViewModel (Name, Status) bound to a TextBox (TwoWay,
 * UpdateSourceTrigger=PropertyChanged), a TextBlock (OneWay) and a Label (OneTime), as in the note's
 * "Example how to setup things". The learner types into the TextBox, then the ViewModel changes Name in
 * code. With `notify: false` the setters' OnPropertyChanged() raises nothing (the note's "No
 * INotifyPropertyChanged?" pitfall).
 */
import { lines } from '../engine/code';
import { BINDING_VM } from './csharp';

export type BindingMode = 'TwoWay' | 'OneWay' | 'OneTime';
export const MODES: BindingMode[] = ['TwoWay', 'OneWay', 'OneTime'];

export interface BindingRow {
  mode: BindingMode;
  control: string;
  property: string;
  path: 'Name' | 'Status';
  xaml: string;
}
/** The three bindings from the note's MainWindow XAML (whitespace collapsed). */
export const ROWS: Record<BindingMode, BindingRow> = {
  TwoWay: { mode: 'TwoWay', control: 'TextBox', property: 'Text', path: 'Name', xaml: '<TextBox Text="{Binding Name, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"/>' },
  OneWay: { mode: 'OneWay', control: 'TextBlock', property: 'Text', path: 'Status', xaml: '<TextBlock Text="{Binding Status, Mode=OneWay}"/>' },
  OneTime: { mode: 'OneTime', control: 'Label', property: 'Content', path: 'Name', xaml: '<Label Content="{Binding Name, Mode=OneTime}"/>' },
};

export interface BindingState {
  source: { Name: string; Status: string };
  /** what each bound control shows ('' = not bound yet) */
  target: Record<BindingMode, string>;
  /** PropertyChanged raised in this step, and which bindings react to it */
  event: { property: 'Name' | 'Status'; heard: BindingMode[] } | null;
  /** value copies happening in this step */
  flows: { mode: BindingMode; to: 'source' | 'target' }[];
  /** which side is being edited, for highlighting */
  active: 'ui' | 'code' | 'ctor' | 'bind' | 'done';
}
export interface BindingStep {
  state: BindingState;
  /** 1-based line in BINDING_VM, 0 = no line (XAML or UI) */
  codeLine: number;
  narration: string;
}

const L = lines(BINDING_VM, {
  ifName: 'if (_name == value) return;',
  setName: '_name = value;',
  notifyName: ['OnPropertyChanged();', 1],
  status: 'Status = $"Name changed to: {_name}";',
  ifStatus: 'if (_status == value) return;',
  setStatus: '_status = value;',
  notifyStatus: ['OnPropertyChanged();', 2],
});
export const BINDING_LINES = L;

export function bindingTrace(opts: { typed?: string; codeValue?: string; notify?: boolean; modes?: BindingMode[] } = {}): BindingStep[] {
  const typed = opts.typed ?? 'Riya';
  const codeValue = opts.codeValue ?? 'Aman Kumar';
  const notify = opts.notify ?? true;
  const modes = MODES.filter((m) => (opts.modes ?? MODES).includes(m));
  const has = (m: BindingMode) => modes.includes(m);
  const steps: BindingStep[] = [];
  let st: BindingState = { source: { Name: 'Aman', Status: 'Waiting for input...' }, target: { TwoWay: '', OneWay: '', OneTime: '' }, event: null, flows: [], active: 'ctor' };
  const push = (codeLine: number, narration: string, change: Partial<BindingState> = {}) => {
    st = { ...st, event: null, flows: [], ...change, source: { ...st.source, ...(change.source ?? {}) }, target: { ...st.target, ...(change.target ?? {}) } };
    steps.push({ state: st, codeLine, narration });
  };
  /** who reacts to PropertyChanged(prop): OneWay/TwoWay bindings on that path; OneTime never listens */
  const listeners = (prop: 'Name' | 'Status') => (notify ? modes.filter((m) => m !== 'OneTime' && ROWS[m].path === prop) : []);
  const pushTo = (prop: 'Name' | 'Status', value: string) => {
    const heard = listeners(prop);
    const target: Partial<Record<BindingMode, string>> = {};
    for (const m of heard) target[m] = value;
    return { event: { property: prop, heard }, target: target as Record<BindingMode, string>, flows: heard.map((m) => ({ mode: m, to: 'target' as const })) };
  };
  const pcText = (prop: string) => (notify ? `OnPropertyChanged() raises PropertyChanged("${prop}").` : `OnPropertyChanged() runs, but without INotifyPropertyChanged no one is told: "No INotifyPropertyChanged? UI will not reflect changes from ViewModel for OneWay/TwoWay."`);

  push(0, 'MainViewModel() sets Name = "Aman", Status = "Waiting for input..." and Rating = 3. No control is bound yet.');
  push(0, `DataContext = new MainViewModel(): each binding reads its source once. ${[has('TwoWay') && 'The TwoWay TextBox shows Name', has('OneWay') && 'the OneWay TextBlock shows Status', has('OneTime') && 'the OneTime Label reads Name once (after that no updates)'].filter(Boolean).join(', ')}.`, {
    active: 'bind',
    target: { TwoWay: 'Aman', OneWay: 'Waiting for input...', OneTime: 'Aman' },
    flows: modes.map((m) => ({ mode: m, to: 'target' as const })),
  });

  /** the Name setter, then the Status setter it calls, as in the note's MainViewModel */
  const setName = (value: string, from: 'ui' | 'code') => {
    const previous = st.source.Name;
    push(L.ifName, value === previous ? `The Name setter runs: if (_name == value) return; the value is the same ("${value}"), so it returns and nothing else happens.` : `The Name setter runs: if (_name == value) return; "${value}" is new, so it carries on.`, { active: from });
    if (value === previous) return;
    push(L.setName, `_name = value; Name is now "${value}".`, { source: { Name: value, Status: st.source.Status }, active: from });
    const toName = pushTo('Name', value);
    const heardName = toName.event.heard;
    push(
      L.notifyName,
      `${pcText('Name')}${notify ? (heardName.length ? ` The TwoWay TextBox listens${from === 'ui' ? ' (it already shows the text it sent)' : ' and shows the new value'}.` : '') + (has('OneTime') ? ' The OneTime Label stopped listening after its first read, so it keeps "Aman".' : '') : ''}`,
      { ...toName, active: from },
    );
    const status = `Name changed to: ${value}`;
    push(L.status, `Status = $"Name changed to: {_name}"; calls the Status setter.`, { active: from });
    push(L.ifStatus, `if (_status == value) return; the status text is new, so it carries on.`, { active: from });
    push(L.setStatus, `_status = value; Status is now "${status}".`, { source: { Name: value, Status: status }, active: from });
    const toStatus = pushTo('Status', status);
    push(L.notifyStatus, `${pcText('Status')}${notify && toStatus.event.heard.length ? ' The OneWay TextBlock listens and shows the new status.' : ''}`, { ...toStatus, active: from });
  };

  if (has('TwoWay')) {
    push(0, `You type "${typed}" in the TextBox. TwoWay with UpdateSourceTrigger=PropertyChanged sends the text to the source right away (target → source).`, {
      active: 'ui',
      target: { TwoWay: typed, OneWay: st.target.OneWay, OneTime: st.target.OneTime },
      flows: [{ mode: 'TwoWay', to: 'source' }],
    });
    setName(typed, 'ui');
  }
  push(0, `Now the ViewModel changes Name in code: Name = "${codeValue}" (an external update, not from the UI).`, { active: 'code' });
  setName(codeValue, 'code');

  const t = st.target;
  const verdict = notify
    ? `${[has('TwoWay') && `TwoWay followed both directions ("${t.TwoWay}")`, has('OneWay') && `OneWay followed the ViewModel ("${t.OneWay}")`, has('OneTime') && `OneTime kept the value it read first ("${t.OneTime}")`].filter(Boolean).join(', ')}.`
    : `Without PropertyChanged the controls never heard about changes made in the ViewModel: ${[has('TwoWay') && `the TextBox still shows "${t.TwoWay}"`, has('OneWay') && `the TextBlock still shows "${t.OneWay}"`].filter(Boolean).join(' and ')}, while Name is "${st.source.Name}".`;
  push(0, verdict, { active: 'done' });
  return steps;
}
