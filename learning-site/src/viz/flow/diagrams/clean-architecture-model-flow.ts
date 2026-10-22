import { chain, src } from '../build';

// phase-2/architecture/clean-architecture › Phase2-ASP.NetAndBackend/ASP.Net Core/DotNet_DesignPatterns.md › "## 🔁 Flow Example" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'clean-architecture-model-flow', title: 'Flow Example', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/DotNet_DesignPatterns.md', '## 🔁 Flow Example', 1) },
  [
    'API Model (Request DTO)',
    'Application Service',
    'Domain Model (Business Logic)',
    'Infrastructure Model (DB Entity)',
  ],
);
