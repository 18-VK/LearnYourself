import { diagram, src } from '../build';

// phase-2/architecture/clean-architecture › Phase2-ASP.NetAndBackend/ASP.Net Core/DotNet_DesignPatterns.md › "## 🔁 Dependency Direction (Very Important)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'clean-architecture-dependencies',
  title: 'Dependency Direction',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/DotNet_DesignPatterns.md', '## 🔁 Dependency Direction (Very Important)', 1),
  layout: 'grid',
  nodes: [
    { id: 'controller', label: 'Controller', at: { row: 0, col: 0 } },
    { id: 'service', label: 'Service', at: { row: 0, col: 1 } },
    { id: 'interface', label: 'Interface', at: { row: 0, col: 2 } },
    { id: 'domain', label: 'Domain', at: { row: 0, col: 3 } },
    { id: 'infra', label: 'Infrastructure', at: { row: 1, col: 2 } },
  ],
  edges: [
    { id: 'e1', from: 'controller', to: 'service' },
    { id: 'e2', from: 'service', to: 'interface' },
    { id: 'e3', from: 'interface', to: 'domain' },
    { id: 'implements', from: 'infra', to: 'interface', label: '(implements it)' },
  ],
  steps: [
    { focus: ['controller'], narration: 'Controller' },
    { edge: 'e1', narration: 'Controller → Service' },
    { edge: 'e2', narration: 'Service → Interface' },
    { edge: 'e3', narration: 'Interface → Domain' },
    { focus: ['infra'], narration: 'Infrastructure' },
    { edge: 'implements', narration: 'Infrastructure → Interface (implements it)' },
  ],
});
