import { diagram, src } from '../build';

// Desktop › WPF_Tutorial/4.MVVMandDataBindings.md › "# MVVM in WPF". The vertical arrow to Model is drawn
// from ViewModel: the bullets under the diagram say the View never talks to the Model directly.
export default diagram({
  id: 'mvvm-layers',
  title: 'MVVM = Model – View – ViewModel',
  source: src('Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial/4.MVVMandDataBindings.md', '# MVVM in WPF'),
  layout: 'grid',
  nodes: [
    { id: 'view', label: 'View', lines: ['(XAML)'], at: { row: 0, col: 0 } },
    { id: 'vm', label: 'ViewModel', lines: ['(Logic)'], at: { row: 0, col: 2 } },
    { id: 'model', label: 'Model', lines: ['(Data)'], at: { row: 1, col: 1 } },
  ],
  edges: [
    { id: 'binding', from: 'view', to: 'vm', label: 'Binding / Command' },
    { id: 'inpc', from: 'vm', to: 'view', label: 'INotifyPropertyChanged' },
    { id: 'to-model', from: 'vm', to: 'model' },
  ],
  steps: [
    { focus: ['view'], narration: 'View (XAML).' },
    { edge: 'binding', narration: 'View → ViewModel (Logic) through Binding / Command.' },
    { edge: 'to-model', narration: 'ViewModel → Model (Data). View never talks to Model directly.' },
    { edge: 'inpc', narration: 'ViewModel → View through INotifyPropertyChanged: ViewModel never talks to View directly (using INotifyPropertyChanged).' },
  ],
});
