import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "## When to Use Web API" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'web-api-example', title: 'When to Use Web API', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '## When to Use Web API', 1) },
  ['Angular frontend', 'ASP.NET Core Web API', 'SQL Server'],
);
