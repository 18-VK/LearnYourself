import { chain, src } from '../build';

// phase-2/auth-fundamentals/jwt-authentication-setup › Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md › "### Full Runtime Flow (IMPORTANT)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'jwt-runtime-flow', title: 'Full Runtime Flow', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md', '### Full Runtime Flow (IMPORTANT)', 1) },
  [
    'Client sends request',
    'Authorization Header (JWT)',
    'Authentication Middleware',
    { label: 'JWT Handler validates:', lines: ['- Signature ✅', '- Issuer ✅', '- Audience ✅', '- Expiry ✅'] },
    'User created in HttpContext',
    'Authorization Middleware checks roles/policies',
    'Controller executes',
  ],
);
