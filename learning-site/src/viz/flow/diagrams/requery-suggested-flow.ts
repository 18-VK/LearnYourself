import { chain, src } from '../build';

// desktop/mvvm/commands › Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/5.RelayCommandNOther.md › "## 7️⃣ What happens internally (important)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'requery-suggested-flow', title: 'What happens internally', source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/5.RelayCommandNOther.md', '## 7️⃣ What happens internally (important)', 1) },
  [
    'InvalidateRequerySuggested()',
    'CommandManager raises RequerySuggested',
    'Button asks Command: CanExecute?',
    'Button enables/disables',
  ],
);
