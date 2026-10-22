import { chain, src } from '../build';

// phase-2/foundations/aspnet-core-overview › Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md › "### 3. Middleware" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'middleware-request-order', title: 'Middleware', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '### 3. Middleware', 1) },
  [
    'Request',
    'Exception Middleware',
    'Authentication Middleware',
    'Authorization Middleware',
    'Routing Middleware',
    'Controller',
  ],
);
