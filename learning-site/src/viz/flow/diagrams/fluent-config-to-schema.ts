import { chain, src } from '../build';

// phase-2/capstone/ef-configuration-and-automapper › Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API/ProjectRelatedStuff.md › "# Fluent API configurations with separate configuration class" (code block 7). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'fluent-config-to-schema', title: 'Fluent API configuration → database schema', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API/ProjectRelatedStuff.md', '# Fluent API configurations with separate configuration class', 7) },
  [
    'Entity (Domain)',
    'Fluent Config (Infrastructure)',
    'DbContext builds model',
    'Migration generates SQL',
    'Database schema created',
  ],
);
