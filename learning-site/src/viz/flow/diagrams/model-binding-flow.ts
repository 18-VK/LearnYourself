import { chain, src } from '../build';

// phase-2/controllers-and-routing/model-binding › Phase2-ASP.NetAndBackend/ASP.Net Core/4.ASP_ModelBindingNMore.md › "## How Model Binding Works" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'model-binding-flow', title: 'How Model Binding Works', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/4.ASP_ModelBindingNMore.md', '## How Model Binding Works', 1) },
  [
    'Client Request',
    'Routing (find action)',
    'Model Binding (map data → parameters)',
    'Model Validation (check rules)',
    'Controller Action executes',
    'Response',
  ],
);
