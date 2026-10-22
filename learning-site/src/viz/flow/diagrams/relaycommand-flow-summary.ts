import { chain, src } from '../build';

// desktop/mvvm/project-example-with-commands › Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/ProjectExampleWithCommand.md › "# Flow summary" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'relaycommand-flow-summary', title: 'Flow summary', source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/ProjectExampleWithCommand.md', '# Flow summary', 1) },
  [
    'Button Click',
    'RelayCommand.Execute',
    'ViewModel method',
    'Service (DB)',
    'ObservableCollection updates',
    'DataGrid refreshes automatically',
  ],
);
