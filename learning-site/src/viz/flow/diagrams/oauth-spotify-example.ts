import { chain, src } from '../build';

// phase-2/auth-fundamentals/authn-and-authz-basics › Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md › "#### OAuth 2.0" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'oauth-spotify-example', title: 'OAuth 2.0: Login with Google', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md', '#### OAuth 2.0', 1) },
  [
    'Spotify',
    'Login with Google',
    { label: 'Google asks', lines: ['"Allow Spotify to access your profile?"'] },
    'User clicks Allow',
    'Spotify receives an Access Token',
  ],
);
