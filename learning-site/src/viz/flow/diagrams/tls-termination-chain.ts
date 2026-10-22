import { chain, src } from '../build';

// phase-2/pipeline/https-and-hsts › Phase2-ASP.NetAndBackend/ASP.Net Core/HttpsImplementation.md › "# Enforce it at the hosting level too (defense in depth)" (code block 2). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'tls-termination-chain', title: 'Enforce it at the hosting level too', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/HttpsImplementation.md', '# Enforce it at the hosting level too (defense in depth)', 2) },
  [
    'Internet',
    'Reverse Proxy / Load Balancer (terminates TLS here)',
    'Kestrel (your app, plain HTTP internally)',
  ],
);
