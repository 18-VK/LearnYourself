import { chain, src } from '../build';

// phase-1/getting-started/dotnet-cli › Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dot Net_CLI.md › "### Industry CI/CD Publish Flow" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'cicd-publish-flow', title: 'Industry CI/CD Publish Flow', source: src('Phase1-CSharp_And_DotNet_core_fundamental/15.C#_AdvanceTopics/Dot Net_CLI.md', '### Industry CI/CD Publish Flow', 1) },
  ['git push', 'CI build', 'dotnet publish', 'artifact', 'deploy', 'restart service'],
);
