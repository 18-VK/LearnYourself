import { chain, src } from '../build';

// Phase2 › 1.ASP_overview.md › "## ASP .Net Architecture" (the ASCII block); narration quotes the
// "If interviewer asks" answer in the same section.
export default chain(
  {
    id: 'aspnet-architecture',
    title: 'High Level ASP.NET Core Architecture',
    source: src('Phase2-ASP.NetAndBackend/ASP.Net Core/1.ASP_overview.md', '## ASP .Net Architecture'),
  },
  [
    'Client (Browser / Mobile App)',
    'Kestrel Web Server',
    'Middleware Pipeline',
    'Routing Middleware',
    'Controller / Endpoint',
    'Business Logic (Services)',
    'Data Access Layer (Repository / EF Core)',
    'Database',
    'Response returned to Client',
  ],
  {
    narration: {
      0: 'A client sends an HTTP request.',
      1: 'When a client sends an HTTP request, it is first received by the Kestrel web server.',
      2: 'The request then passes through a series of middleware components such as authentication, authorization, and routing.',
      3: 'The routing middleware determines the appropriate controller and action method.',
      4: 'The controller processes the request…',
      5: '…interacts with the service…',
      6: '…and data access layers…',
      7: '…and retrieves or updates data in the database.',
      8: 'Finally, the response is returned through the middleware pipeline back to the client.',
    },
  },
);
