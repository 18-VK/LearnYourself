import { chain, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### 6. Token Validation" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'openiddict-token-validation', title: 'Token Validation', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### 6. Token Validation', 1) },
  ['Bearer Token', 'JwtBearer Middleware', 'OpenIddict Metadata', 'Token Valid', 'Controller'],
);
