import { chain, src } from '../build';

// phase-1/ef-core/ef-core-migrations-and-scaffolding › Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore_Migration_Deployment_Summary.md › "## Production Workflow" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'migration-production-workflow', title: 'Production Workflow', source: src('Phase1-CSharp_And_DotNet_core_fundamental/18.LINQ/EFCore_Migration_Deployment_Summary.md', '## Production Workflow', 1) },
  [
    'Entity Change',
    'Add Migration',
    'Commit Migration Files',
    'Generate migration.sql',
    'Test in Staging',
    'Backup Production DB',
    'Run migration.sql',
    'Deploy API',
    'Verify Application',
  ],
);
