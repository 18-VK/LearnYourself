import { diagram, src } from '../build';

// phase-2/capstone/ef-configuration-and-automapper › Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API/ProjectRelatedStuff.md › "# AutoMapper : for object mapping" (code block 5). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default diagram({
  id: 'automapper-flow',
  title: 'AutoMapper: request in, response out',
  source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/Examples/Task_Management_System_API/ProjectRelatedStuff.md', '# AutoMapper : for object mapping', 5),
  layout: 'grid',
  nodes: [
    { id: 'request', label: 'Request', at: { row: 0, col: 0 } },
    { id: 'dto1', label: 'DTO', at: { row: 0, col: 1 } },
    { id: 'entity1', label: 'Entity', at: { row: 0, col: 2 } },
    { id: 'db', label: 'DB', at: { row: 0, col: 3 } },
    { id: 'entity2', label: 'Entity', at: { row: 1, col: 0 } },
    { id: 'dto2', label: 'DTO', at: { row: 1, col: 1 } },
    { id: 'response', label: 'Response', at: { row: 1, col: 2 } },
  ],
  edges: [
    { id: 'e1', from: 'request', to: 'dto1', label: '(Map)' },
    { id: 'e2', from: 'dto1', to: 'entity1', label: '(Map)' },
    { id: 'e3', from: 'entity1', to: 'db' },
    { id: 'e4', from: 'entity2', to: 'dto2', label: '(Map)' },
    { id: 'e5', from: 'dto2', to: 'response', label: '(Map)' },
  ],
  steps: [
    { focus: ['request'], narration: 'Request' },
    { edge: 'e1', narration: 'Request → (Map) → DTO' },
    { edge: 'e2', narration: 'DTO → (Map) → Entity' },
    { edge: 'e3', narration: 'Entity → DB' },
    { focus: ['entity2'], narration: 'Entity' },
    { edge: 'e4', narration: 'Entity → (Map) → DTO' },
    { edge: 'e5', narration: 'DTO → (Map) → Response' },
  ],
});
