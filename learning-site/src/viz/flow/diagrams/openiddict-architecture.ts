import { diagram, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### Your Architecture" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'openiddict-architecture',
  title: 'Your Architecture',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### Your Architecture', 1),
  layout: 'grid',
  nodes: [
    { id: 'user', label: 'User', at: { row: 0, col: 0.5 } },
    { id: 'front', label: 'ASP.NET MVC / React', at: { row: 1, col: 0.5 } },
    { id: 'auth', label: 'Auth Server', lines: ['ASP.NET Core', 'OpenIddict'], at: { row: 2, col: 0.5 } },
    { id: 'access', label: 'Access Token', at: { row: 3, col: 0 } },
    { id: 'id', label: 'ID Token', at: { row: 3, col: 1 } },
    { id: 'apis', label: 'Your APIs', at: { row: 4, col: 0 } },
    { id: 'client', label: 'Client App', at: { row: 4, col: 1 } },
    { id: 'sql', label: 'SQL Server', at: { row: 5, col: 0 } },
  ],
  edges: [
    { id: 'e1', from: 'user', to: 'front' },
    { id: 'login', from: 'front', to: 'auth', label: 'Login' },
    { id: 'gen-access', from: 'auth', to: 'access', label: 'Generates Tokens' },
    { id: 'gen-id', from: 'auth', to: 'id', label: 'Generates Tokens' },
    { id: 'e5', from: 'access', to: 'apis' },
    { id: 'e6', from: 'id', to: 'client' },
    { id: 'e7', from: 'apis', to: 'sql' },
  ],
});
