import { diagram, src } from '../build';

// Phase2 › 11.ASP_MoreOnAuth.md › "## Before any code, understand the shape of the system…" (three boxes,
// two <---> arrows). Narration is the numbered "core flow" list right under the diagram. The ASCII draws
// no Client ↔ Resource API arrow, so step 5 highlights both boxes instead of inventing one.
export default diagram({
  id: 'auth-three-parties',
  title: 'The 3 parties',
  source: src(
    'Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md',
    '## Before any code, understand the shape of the system. There are always **3 parties**:',
  ),
  layout: 'grid',
  nodes: [
    { id: 'client', label: 'Client', lines: ['(SPA/App)'], at: { row: 0, col: 0 } },
    { id: 'auth', label: 'Auth Server', lines: ['(Identity Svc)'], at: { row: 0, col: 1 } },
    { id: 'api', label: 'Resource API', lines: ['(Your Backend)'], at: { row: 0, col: 2 } },
  ],
  edges: [
    { id: 'client-auth', from: 'client', to: 'auth', twoWay: true },
    { id: 'auth-api', from: 'auth', to: 'api', twoWay: true },
  ],
  steps: [
    { focus: ['client', 'auth', 'api'], narration: 'There are always 3 parties: the Client (SPA/App), the Auth Server (Identity Svc) and the Resource API (Your Backend).' },
    { edge: 'client-auth', narration: 'Login: Client sends username + password → Auth Server.' },
    { focus: ['auth'], narration: 'Auth Server verifies credentials against the DB (hashed password check).' },
    {
      edge: 'client-auth',
      reverse: true,
      narration:
        'Auth Server issues two tokens: access_token (JWT, short-lived, e.g. 15 min) — proves identity to APIs; refresh_token (opaque or JWT, long-lived, e.g. 7–30 days) — used only to get a new access token.',
    },
    { focus: ['client'], narration: 'Client stores tokens (memory / httpOnly cookie — never localStorage for the refresh token in production).' },
    { focus: ['client', 'api'], narration: 'Client calls Resource API with Authorization: Bearer <access_token>.' },
    { focus: ['api'], narration: 'API middleware validates the JWT signature + claims (no DB call needed — this is the whole point of JWTs).' },
    { edge: 'client-auth', narration: 'When access token expires, client silently calls /auth/refresh with the refresh token to get a new pair.' },
    {
      focus: ['auth'],
      narration: 'On logout or breach detection, refresh token is revoked. That single loop — login → issue → validate → refresh → revoke — is 90% of every auth server on earth.',
    },
  ],
});
