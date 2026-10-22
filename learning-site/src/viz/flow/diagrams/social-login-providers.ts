import { diagram, src } from '../build';

// phase-2/auth-server/openiddict › Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md › "### 3. Social Login (Google, Microsoft, GitHub, etc.)" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'social-login-providers',
  title: 'Social Login (Google, Microsoft, GitHub)',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/14.ASP_OpenIddict_Auth.md', '### 3. Social Login (Google, Microsoft, GitHub, etc.)', 1),
  layout: 'grid',
  nodes: [
    { id: 'user', label: 'User', at: { row: 0, col: 1 } },
    { id: 'auth', label: 'Authorization Server', at: { row: 1, col: 1 } },
    { id: 'google', label: 'Google', at: { row: 2, col: 0 } },
    { id: 'microsoft', label: 'Microsoft', at: { row: 2, col: 1 } },
    { id: 'github', label: 'GitHub', at: { row: 2, col: 2 } },
  ],
  edges: [
    { id: 'e1', from: 'user', to: 'auth' },
    { id: 'e2', from: 'auth', to: 'google', plain: true },
    { id: 'e3', from: 'auth', to: 'microsoft', plain: true },
    { id: 'e4', from: 'auth', to: 'github', plain: true },
  ],
});
