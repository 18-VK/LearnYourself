import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "## What is ASP.NET Core Web API?" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'web-api-architecture', title: 'What is ASP.NET Core Web API?', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '## What is ASP.NET Core Web API?', 1) },
  ['Frontend (React / Angular / Mobile)', 'ASP.NET Core Web API', 'Database'],
);
