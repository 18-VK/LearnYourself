import { chain, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### 5. Public Keys (JWKS)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'jwks-public-keys', title: 'Public Keys (JWKS)', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### 5. Public Keys (JWKS)', 1) },
  [
    { label: 'Auth Server', lines: ['Private Key'] },
    'JWT',
    { label: 'API downloads', lines: ['Public Key'] },
    'Verifies JWT',
  ],
  { edgeLabels: { '1': 'Signs JWT' } },
);
