import { diagram, src } from '../build';

// phase-2/auth-server/usermanager-external-logins-and-2fa › Phase2-ASP.NetAndBackend/ASP.Net Core/13.ASP_Custom_authServer.md › "### External logins" (code block 3). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'external-login-lookup',
  title: 'External logins: find or link the user',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/13.ASP_Custom_authServer.md', '### External logins', 3),
  layout: 'grid',
  nodes: [
    { id: 'find', label: 'FindByLoginAsync("Google", sub)', at: { row: 0, col: 0.5 } },
    { id: 'linked', label: 'user already linked, skip to Step 9', at: { row: 1, col: 0 } },
    { id: 'email', label: 'check FindByEmailAsync(email)', at: { row: 1, col: 1 } },
    { id: 'create', label: 'link or create a new user', at: { row: 2, col: 1 } },
  ],
  edges: [
    { id: 'found', from: 'find', to: 'linked', label: 'Found' },
    { id: 'not-found', from: 'find', to: 'email', label: 'Not found' },
    { id: 'e3', from: 'email', to: 'create' },
  ],
});
