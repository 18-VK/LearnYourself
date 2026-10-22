import { chain, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### 2. JWT Creation" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'jwt-creation-steps', title: 'JWT Creation', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### 2. JWT Creation', 1) },
  ['Create Claims', 'Sign JWT', 'Set Expiry', 'Choose Algorithm', 'Issuer', 'Audience', 'Serialize Token'],
);
