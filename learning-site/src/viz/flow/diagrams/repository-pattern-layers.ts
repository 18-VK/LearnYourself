import { chain, src } from '../build';

// phase-1/dapper-patterns-logging/repository-pattern › Phase1-CSharp_And_DotNet_core_fundamental/19. OtherTopics/IRepositoryWithEFCore.md › "## Repository pattern structure" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'repository-pattern-layers', title: 'Repository pattern structure', source: src('Phase1-CSharp_And_DotNet_core_fundamental/19. OtherTopics/IRepositoryWithEFCore.md', '## Repository pattern structure', 1) },
  ['UI / ViewModel / Controller', 'Service', 'IRepository<T>', 'EF Core (DbContext)', 'Database'],
);
