import { chain, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### 2. JWT Creation" (code block 2). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'openiddict-jwt-generation', title: 'JWT Creation with OpenIddict', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### 2. JWT Creation', 2) },
  ['Create ClaimsPrincipal', 'OpenIddict', 'JWT Generated'],
);
