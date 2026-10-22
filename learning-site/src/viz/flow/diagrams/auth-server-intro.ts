import { chain, src } from '../build';

// phase-2/auth-fundamentals/auth-server-concepts › Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md › "## Introduction: Auth Server" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'auth-server-intro', title: 'Introduction: Auth Server', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md', '## Introduction: Auth Server', 1) },
  [
    { label: 'Client (SPA/App)' },
    { label: 'Authentication Server', lines: ['(Identity Provider)'] },
    { label: 'Access Token', kind: 'plain' },
    { label: 'Resource API', lines: ['(Business API)'] },
  ],
  { edgeLabels: { '1': 'Login Request', '2': 'Issues JWT/ID Token' } },
);
