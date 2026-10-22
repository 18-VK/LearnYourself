import { chain, src } from '../build';

// phase-2/auth-server/refresh-tokens › Phase2-ASP.NetAndBackend/ASP.Net Core/12.ASP_AuthServer.md › "#### What does a refresh token contain?" (code block 2). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'refresh-token-protect', title: 'What does a refresh token contain?', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/12.ASP_AuthServer.md', '#### What does a refresh token contain?', 2) },
  [
    'raw_payload (JSON above)',
    'ASP.NET Core Data Protection: Protect(payload)',
    'opaque_token = base64("CfDJ8Kx9pL2vQm3nR7wZmH4jK9pL2vQm3nR7wZmH4jK9pL2vQm3nR7wZmH4jK9pL2v...")',
  ],
);
