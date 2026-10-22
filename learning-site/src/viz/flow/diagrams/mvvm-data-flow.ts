import { chain, src } from '../build';

// desktop/mvvm/real-mvvm-example › Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/6.RealExampleofMVVM.md › "## 6️⃣ Flow (How data moves)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'mvvm-data-flow', title: 'Flow (How data moves)', source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/6.RealExampleofMVVM.md', '## 6️⃣ Flow (How data moves)', 1) },
  ['Database', 'Service (Query)', 'ViewModel (ObservableCollection)', 'DataGrid (Binding)'],
);
