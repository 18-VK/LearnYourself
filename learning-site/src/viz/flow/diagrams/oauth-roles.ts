import { chain, src } from '../build';

// phase-2/auth-fundamentals/authn-and-authz-basics › Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md › "#### OAuth 2.0" (code block 2). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'oauth-roles', title: 'OAuth 2.0', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md', '#### OAuth 2.0', 2) },
  ['Client', 'Authorization Server', 'Access Token', 'Resource Server'],
);
