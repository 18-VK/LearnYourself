import { diagram, src } from '../build';

// phase-2/auth-fundamentals/authn-and-authz-basics › Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md › "### API Keys" (code block 3). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'api-key-flow',
  title: 'API Keys',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/10.ASP_AuthenticationNAuthorisation.md', '### API Keys', 3),
  layout: 'grid',
  nodes: [
    { id: 'client', label: 'Client Application', at: { row: 0, col: 0.5 } },
    { id: 'server', label: 'API Server', at: { row: 1, col: 0.5 } },
    { id: 'store', label: 'Database / Key Store', at: { row: 2, col: 0.5 } },
    { id: 'ok', label: 'Process request', at: { row: 3, col: 0 } },
    { id: 'deny', label: 'Return 401/403', at: { row: 3, col: 1 } },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'server', label: 'Request + API Key' },
    { id: 'e2', from: 'server', to: 'store', label: 'Verify API Key' },
    { id: 'valid', from: 'store', to: 'ok', label: 'Valid' },
    { id: 'invalid', from: 'store', to: 'deny', label: 'Invalid' },
  ],
});
