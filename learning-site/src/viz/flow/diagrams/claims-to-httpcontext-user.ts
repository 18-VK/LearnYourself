import { chain, src } from '../build';

// phase-2/auth-fundamentals/claims-identity-and-principal › Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md › "## How Claims Become HttpContext.User" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'claims-to-httpcontext-user', title: 'How Claims Become HttpContext.User', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md', '## How Claims Become HttpContext.User', 1) },
  [
    'Claims',
    'JwtSecurityToken',
    'JWT String',
    'Client stores token',
    'Authorization: Bearer <JWT>',
    'JWT Authentication Handler',
    'Validates Signature',
    'Extracts Claims',
    'ClaimsIdentity',
    'ClaimsPrincipal',
    'HttpContext.User',
  ],
);
