import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "### 6. Response Passes Through Middleware" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'middleware-response-order', title: 'Response Passes Through Middleware', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '### 6. Response Passes Through Middleware', 1) },
  ['Controller Response', 'Authorization Middleware', 'Logging Middleware', 'Response sent to client'],
);
