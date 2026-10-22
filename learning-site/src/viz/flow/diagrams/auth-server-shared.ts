import { diagram, src } from '../build';

// phase-2/auth-fundamentals/auth-server-concepts › Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md › "## Why Separate the Auth Server?" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'auth-server-shared',
  title: 'Why Separate the Auth Server?',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md', '## Why Separate the Auth Server?', 1),
  layout: 'grid',
  nodes: [
    { id: 'auth', label: 'Auth Server', at: { row: 0, col: 1 } },
    { id: 'task', label: 'Task API', at: { row: 1, col: 0 } },
    { id: 'hr', label: 'HR API', at: { row: 1, col: 1 } },
    { id: 'payroll', label: 'Payroll API', at: { row: 1, col: 2 } },
  ],
  edges: [
    { id: 'e1', from: 'auth', to: 'task' },
    { id: 'e2', from: 'auth', to: 'hr' },
    { id: 'e3', from: 'auth', to: 'payroll' },
  ],
});
