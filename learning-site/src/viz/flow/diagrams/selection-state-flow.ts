import { chain, src } from '../build';

// desktop/real-app-architecture/app-state-and-communication › Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/12.Tips.md › "## 🧩 Real flow example" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'selection-state-flow', title: 'Real flow example', source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/12.Tips.md', '## 🧩 Real flow example', 1) },
  [
    'User clicks project',
    'SelectionState.SelectedProject changes',
    'RightViewModel sees change',
    'Tasks reload',
    'UI updates',
  ],
);
