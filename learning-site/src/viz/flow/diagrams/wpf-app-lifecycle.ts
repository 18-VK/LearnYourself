import { chain, src } from '../build';

// desktop/real-app-architecture/real-app-setup › Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/10.RealAppSetup_mustcheck.md › "# Example" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'wpf-app-lifecycle', title: 'App starts → OnStartup → App running → OnExit', source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/10.RealAppSetup_mustcheck.md', '# Example', 1) },
  [
    'App starts',
    { label: 'OnStartup', lines: ['setup DI', 'setup logging', 'setup handlers', 'show MainWindow'] },
    'App running',
    { label: 'OnExit', lines: ['save settings', 'flush logs', 'dispose services'] },
  ],
);
