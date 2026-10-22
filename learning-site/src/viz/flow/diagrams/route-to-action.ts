import { chain, src } from '../build';

// phase-2/controllers-and-routing/routing › Phase2-ASP.NetAndBackend/ASP.Net Core/3.ASP_ControllerNRouting.md › "### Visual Flow" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'route-to-action', title: 'Visual Flow: URL → action', source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/3.ASP_ControllerNRouting.md', '### Visual Flow', 1) },
  [
    'URL: /api/products/details/5',
    { label: 'controller = ProductsController', lines: ['action = Details', 'id = 5'] },
    { label: 'Executes:', lines: ['Details(5)'] },
  ],
);
