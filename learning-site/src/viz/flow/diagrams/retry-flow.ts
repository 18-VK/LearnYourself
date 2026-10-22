import { chain, src } from '../build';

// phase-2/calling-apis/client-calling-web-api › Phase2-ASP.NetAndBackend/ASP.Net Core/6.ASP_ClientCallingWebAPI.md › "### Add retry for failure scenario" (code block 6). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'retry-flow', title: 'Add retry for failure scenario', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/6.ASP_ClientCallingWebAPI.md', '### Add retry for failure scenario', 6) },
  ['Call API', 'Fail (500 error)', 'Wait 2 sec', 'Retry', 'Fail again', 'Retry', 'Success'],
);
