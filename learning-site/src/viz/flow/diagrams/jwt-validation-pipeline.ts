import { chain, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### Why This Matters for Your API" (code block 3). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'jwt-validation-pipeline', title: 'Why This Matters for Your API', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### Why This Matters for Your API', 3) },
  [
    'JWT',
    'Validate Signature',
    'Validate Issuer',
    'Validate Audience',
    'Validate Expiration',
    'Create ClaimsPrincipal',
    'HttpContext.User',
    'Controller Executes',
  ],
);
