import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "## What is ASP.NET Core MVC?" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'mvc-request-flow', title: 'What is ASP.NET Core MVC?', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '## What is ASP.NET Core MVC?', 1) },
  ['Browser', 'Controller', 'Model', 'View (HTML page)', 'Browser'],
);
