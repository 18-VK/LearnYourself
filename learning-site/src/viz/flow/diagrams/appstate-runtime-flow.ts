import { chain, src } from '../build';

// desktop/real-app-architecture/app-state-and-communication › Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/12.Tips.md › "## 4️⃣ What actually happens at runtime" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'appstate-runtime-flow', title: 'What actually happens at runtime', source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/12.Tips.md', '## 4️⃣ What actually happens at runtime', 1) },
  [
    'ListBox.SelectedItem changes',
    'ProjectListViewModel.SelectedProject setter',
    'AppState.Selection.SelectedProject updated',
    'PropertyChanged fired',
    'Right ViewModel sees change',
    'Async task reloads',
  ],
);
