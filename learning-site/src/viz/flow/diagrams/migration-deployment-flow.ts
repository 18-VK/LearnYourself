import { chain, src } from '../build';

// phase-1/ef-core/ef-core-migrations-and-scaffolding › Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore_Migration_Deployment_Summary.md › "## 4. Production Deployment Flow" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'migration-deployment-flow', title: 'Production Deployment Flow', source: src('Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore_Migration_Deployment_Summary.md', '## 4. Production Deployment Flow', 1) },
  ['Backup Database', 'Execute migration.sql', 'Verify Migration Success', 'Deploy API', 'Smoke Test'],
);
