import type { VerbatimCheck } from '../engine/loader';
import { BINDING_VM, COMMAND_AUTO, COMMAND_CM_CREATE, COMMAND_CM_EVENT, COMMAND_CM_VM, COMMAND_RELAY, COMMAND_VM, DEBOUNCE_WPF, WPF } from './csharp';

/** Code panels in this area that copy code from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = [
  { label: 'data binding visualizer', file: `${WPF}/4.MVVMandDataBindings.md`, heading: '## Example how to setup things', code: BINDING_VM, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/binding.ts' },
  { label: 'CanExecute visualizer (ViewModel)', file: `${WPF}/5.RelayCommandNOther.md`, heading: '## Example : Manual RelayCommand (PURE MVVM)', code: COMMAND_VM, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/command.ts' },
  { label: 'CanExecute visualizer (RelayCommand)', file: `${WPF}/5.RelayCommandNOther.md`, heading: '## Example : Manual RelayCommand (PURE MVVM)', code: COMMAND_RELAY, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/command.ts' },
  { label: 'CanExecute visualizer (CommandManager setter)', file: `${WPF}/5.RelayCommandNOther.md`, heading: '## 6️⃣ Real example (your case)', code: COMMAND_CM_VM, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/command.ts' },
  { label: 'CanExecute visualizer (CommandManager command)', file: `${WPF}/5.RelayCommandNOther.md`, heading: '## 6️⃣ Real example (your case)', code: COMMAND_CM_CREATE, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/command.ts' },
  { label: 'CanExecute visualizer (RequerySuggested)', file: `${WPF}/5.RelayCommandNOther.md`, heading: '## 4️⃣ Where does CommandManager fit in MVVM?', code: COMMAND_CM_EVENT, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/command.ts' },
  { label: 'CanExecute visualizer (auto-property)', file: `${WPF}/5.RelayCommandNOther.md`, heading: '## Why do we call InvalidateRequerySuggested()?', code: COMMAND_AUTO, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/command.ts' },
  { label: 'debounce timeline visualizer', file: 'Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/DebounceSearch.md', heading: '## In WPF', code: DEBOUNCE_WPF, fix: 'src/viz/desktop/csharp.ts and src/viz/desktop/debounce.ts' },
];
