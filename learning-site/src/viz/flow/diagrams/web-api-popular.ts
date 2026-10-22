import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "## Why Web API is More Popular Today" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'web-api-popular', title: 'Why Web API is More Popular Today', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '## Why Web API is More Popular Today', 1) },
  ['Frontend (React / Angular)', 'REST API (ASP.NET Core Web API)', 'Database'],
);
