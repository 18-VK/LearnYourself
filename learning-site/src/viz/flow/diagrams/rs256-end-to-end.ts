import { chain, src } from '../build';

// phase-2/auth-fundamentals/creating-and-signing-jwts › Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md › "# End-to-end flow" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'rs256-end-to-end', title: 'End-to-end flow', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/11.ASP_MoreOnAuth.md', '# End-to-end flow', 1) },
  [
    'RSA key generated (certificate / vault)',
    { label: 'Auth Server:', lines: ['- Uses PRIVATE key', '- Signs JWT'] },
    { label: 'Auth Server:', lines: ['- Exposes PUBLIC key via JWKS'] },
    { label: 'API:', lines: ['- Fetches PUBLIC key', '- Validates token'] },
    { label: 'Client:', lines: ['- Uses token'] },
  ],
);
