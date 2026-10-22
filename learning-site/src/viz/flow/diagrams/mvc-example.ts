import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "## When to Use MVC" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'mvc-example', title: 'When to Use MVC', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '## When to Use MVC', 1) },
  ['Browser', 'ASP.NET MVC', 'Razor Views'],
);
