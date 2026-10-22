import { chain, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### 3. Refresh Tokens" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'refresh-token-timeline', title: 'Refresh Tokens', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### 3. Refresh Tokens', 1) },
  [
    'Login',
    'Access Token (15 min)',
    'Refresh Token (30 days)',
    'Access Token expires',
    'Use Refresh Token',
    'New Access Token',
  ],
);
