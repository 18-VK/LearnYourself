import { chain, src } from '../build';

// desktop/capstone-taskflow-studio/taskflow-studio › Phase1-CSharp_And_DotNet_core_fundamental/21.TaskFlow Studio/TaskFlowStudio/Notes.md › "# This is a classic autosave problem" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'autosave-flow', title: 'A classic autosave problem', source: src('Phase1-CSharp_And_DotNet_core_fundamental/21.TaskFlow Studio/TaskFlowStudio/Notes.md', '# This is a classic autosave problem', 1) },
  [
    'User edits UI',
    'ViewModel updates in-memory entity',
    'Background service calls SaveChanges()',
    'Data persisted',
  ],
);
