import { chain, src } from '../build';

// phase-2/auth-fundamentals/authn-and-authz-basics › Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md › "### HTTP Basic Authentication" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'basic-auth-flow', title: 'HTTP Basic Authentication', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md', '### HTTP Basic Authentication', 1) },
  ['User', 'Server', 'Authenticated'],
  { edgeLabels: { '1': 'Username + Password', '2': 'Verify password hash' } },
);
