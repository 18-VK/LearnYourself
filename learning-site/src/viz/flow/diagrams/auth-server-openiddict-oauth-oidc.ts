import { diagram, src } from '../build';

// phase-2/auth-fundamentals/identity-providers-and-oidc › Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md › "# How Auth Server, OpenIddict, OAuth 2.0, and OpenID Connect (OIDC) relate to each other" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'auth-server-openiddict-oauth-oidc',
  title: 'How Auth Server, OpenIddict, OAuth 2.0, and OIDC relate',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md', '# How Auth Server, OpenIddict, OAuth 2.0, and OpenID Connect (OIDC) relate to each other', 1),
  layout: 'grid',
  nodes: [
    {
      id: 'server',
      label: 'Authentication Server',
      lines: ['(Your ASP.NET Core API)'],
      at: { row: 0, col: 0.5 },
    },
    {
      id: 'openiddict',
      label: 'OpenIddict',
      lines: [
        '• .NET library/framework',
        '• Adds OAuth 2.0 support',
        '• Adds OpenID Connect support',
        '• Issues JWTs',
        '• Validates tokens',
      ],
      at: { row: 1, col: 0.5 },
    },
    {
      id: 'oauth',
      label: 'OAuth 2.0',
      lines: ['(Authorization)', '• Access Token', '• Refresh Token', '• Scopes', '• Client Credentials'],
      at: { row: 2, col: 0 },
    },
    {
      id: 'oidc',
      label: 'OpenID Connect',
      lines: [
        '(Authentication Layer)',
        '• ID Token',
        '• UserInfo Endpoint',
        '• Authentication',
        '• Builds on OAuth 2.0',
      ],
      at: { row: 2, col: 1 },
    },
  ],
  edges: [
    { id: 'e1', from: 'server', to: 'openiddict', label: 'Implements' },
    { id: 'e2', from: 'openiddict', to: 'oauth', label: 'Implements' },
    { id: 'e3', from: 'openiddict', to: 'oidc', label: 'Implements' },
  ],
});
