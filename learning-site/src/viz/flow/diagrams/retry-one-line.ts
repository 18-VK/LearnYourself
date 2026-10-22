import { chain, src } from '../build';

// phase-2/calling-apis/client-calling-web-api › Phase2-ASP.NetAndBackend/ASP.Net Core/6.ASP_ClientCallingWebAPI.md › "### Add retry for failure scenario" (code block 3). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'retry-one-line', title: 'Try → Fail → Retry → Success', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/6.ASP_ClientCallingWebAPI.md', '### Add retry for failure scenario', 3) },
  ['Try', 'Fail', 'Retry', 'Success'],
);
