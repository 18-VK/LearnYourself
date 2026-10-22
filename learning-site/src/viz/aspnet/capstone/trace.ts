import { lineOf } from '../../engine/code';
import type { Step } from '../../engine/types';
import { ZERO } from '../common/zero';
import {
  CAP_CONTROLLER_CREATE,
  CAP_CONTROLLER_GET,
  CAP_CREATE_VALIDATOR,
  CAP_MAP_REQUEST,
  CAP_MAP_RESPONSE,
  CAP_PROGRAM_FILTER,
  CAP_REPO_ADD,
  CAP_REPO_GET,
  CAP_RESULT,
  CAP_SERVICE_CREATE,
  CAP_SERVICE_GET,
  CAP_VALIDATION_FILTER,
} from '../sources-t2';

/**
 * One request through the Task Management API capstone, following its real code:
 * TaskController → ValidationFilter (global, from Program.cs) → TaskService → TaskRepository → EF Core, and back as
 * Result<T> → AutoMapper → an IActionResult. Every code panel is copied from Examples/Task_Management_System_API/Src
 * (checked against the files on every build). Request values, ids and the SQL line are illustrative.
 */

export type CapScenario = 'created' | 'validation-failed' | 'not-found' | 'duplicate';
export const CAP_SCENARIOS: { id: CapScenario; label: string }[] = [
  { id: 'created', label: 'Create a task (201)' },
  { id: 'validation-failed', label: 'Empty title (400 from ValidationFilter)' },
  { id: 'duplicate', label: 'Duplicate title (409 via Result<T>)' },
  { id: 'not-found', label: 'Get an unknown task (404)' },
];

export type Layer = 'controller' | 'validation-filter' | 'service' | 'result' | 'repository' | 'ef-core' | 'response-mapping';
export const LAYERS: { id: Layer; label: string; project: 'API' | 'Application' | 'Domain' | 'Infrastructure' }[] = [
  { id: 'controller', label: 'TaskController', project: 'API' },
  { id: 'validation-filter', label: 'ValidationFilter', project: 'API' },
  { id: 'service', label: 'TaskService', project: 'Application' },
  { id: 'result', label: 'Result<T>', project: 'Domain' },
  { id: 'repository', label: 'TaskRepository', project: 'Infrastructure' },
  { id: 'ef-core', label: 'EF Core (AppDbContext)', project: 'Infrastructure' },
  { id: 'response-mapping', label: 'AutoMapper → response', project: 'API' },
];

export interface Snippet {
  file: string;
  code: string;
}
const F = 'Examples/Task_Management_System_API/';
export const SNIPPETS = {
  program: { file: `${F}Program.cs`, code: CAP_PROGRAM_FILTER },
  create: { file: `${F}Src/API/Controllers/TaskController.cs`, code: CAP_CONTROLLER_CREATE },
  get: { file: `${F}Src/API/Controllers/TaskController.cs`, code: CAP_CONTROLLER_GET },
  filter: { file: `${F}Src/API/Filters/ValidationFilter.cs`, code: CAP_VALIDATION_FILTER },
  validator: { file: `${F}Src/Application/Validators/Task/CreateTaskValidator.cs`, code: CAP_CREATE_VALIDATOR },
  mapRequest: { file: `${F}Src/Application/Mappings/MappingProfile.cs`, code: CAP_MAP_REQUEST },
  serviceCreate: { file: `${F}Src/Application/Services/TaskService.cs`, code: CAP_SERVICE_CREATE },
  serviceGet: { file: `${F}Src/Application/Services/TaskService.cs`, code: CAP_SERVICE_GET },
  result: { file: `${F}Src/Domain/Common/Result.cs`, code: CAP_RESULT },
  repoAdd: { file: `${F}Src/Infrastructure/Repositories/TaskRepository.cs`, code: CAP_REPO_ADD },
  repoGet: { file: `${F}Src/Infrastructure/Repositories/TaskRepository.cs`, code: CAP_REPO_GET },
  mapResponse: { file: `${F}Src/Application/Mappings/MappingProfile.cs`, code: CAP_MAP_RESPONSE },
} satisfies Record<string, Snippet>;
export type SnippetId = keyof typeof SNIPPETS;

export interface CapState {
  layer: Layer;
  /** the call stack, outermost first */
  stack: Layer[];
  dir: 'down' | 'up';
  snippet: SnippetId;
  lines: number[];
  /** the object in hand at this step, as a label and its fields */
  data: { label: string; fields: [string, string][] } | null;
  response: { status: number; text: string; body?: [string, string][] } | null;
}

export type CapStep = Step<CapState>;

const at = (id: SnippetId, ...markers: (string | [string, number])[]) => markers.map((m) => (typeof m === 'string' ? lineOf(SNIPPETS[id].code, m) : lineOf(SNIPPETS[id].code, m[0], m[1])));

const TASK_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PROJECT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const TITLE = 'Write the release notes';

export function traceCapstone(scenario: CapScenario, path: readonly Layer[] = LAYERS.map((l) => l.id)): CapStep[] {
  const steps: CapStep[] = [];
  const show = new Set(path.length ? path : LAYERS.map((l) => l.id));
  let stack: Layer[] = [];
  const push = (layer: Layer, dir: CapState['dir'], snippet: SnippetId, lines: number[], data: CapState['data'], narration: string, extra: { response?: CapState['response']; predict?: CapStep['predict']; action?: CapStep['action'] } = {}) => {
    if (!show.has(layer)) return;
    steps.push({
      state: { layer, stack: [...stack], dir, snippet, lines, data, response: extra.response ?? null },
      highlights: {},
      action: extra.action ?? (dir === 'down' ? 'call' : 'return'),
      codeLine: 0,
      narration,
      variables: { layer: LAYERS.find((l) => l.id === layer)!.label, depth: stack.length },
      counters: ZERO,
      predict: extra.predict,
    });
  };
  const body: [string, string][] = [
    ['Title', scenario === 'validation-failed' ? '""' : `"${TITLE}"`],
    ['Description', '"Summarise the sprint"'],
    ['ProjectId', PROJECT_ID],
    ['DueDate', '2030-01-15'],
    ['Priority', '"High"'],
  ];

  if (scenario === 'not-found') {
    stack = ['controller'];
    push('controller', 'down', 'get', at('get', '[HttpGet("{Id:guid}")]', 'public async Task<ActionResult<TaskResponse>> GetById('), { label: 'Route values', fields: [['Id', TASK_ID]] }, `GET /api/Task/${TASK_ID}. Routing picks TaskController.GetById: the {Id:guid} constraint matches, so Id binds from the route.`, { action: 'start' });
    stack = ['controller', 'validation-filter'];
    push('validation-filter', 'down', 'filter', at('filter', 'foreach (var arg in context.ActionArguments.Values)', 'if (validator != null)'), { label: 'Action arguments', fields: [['Id', 'Guid'], ['ct', 'CancellationToken']] }, 'The global ValidationFilter loops over the arguments. No IValidator<Guid> or IValidator<CancellationToken> is registered, so nothing is validated and it calls next().');
    stack = ['controller', 'service'];
    push('service', 'down', 'get', at('get', 'var result = await _taskService.GetTaskById(Id, ct);'), null, 'The action calls _taskService.GetTaskById(Id, ct).');
    push('service', 'down', 'serviceGet', at('serviceGet', 'var result = await _taskRepo.GettaskById(taskId, ct);'), null, 'TaskService asks the repository for the task.');
    stack = ['controller', 'service', 'repository'];
    push('repository', 'down', 'repoGet', at('repoGet', 'return await _appDbContext.Tasks.FindAsync(id, ct) ?? default;'), null, 'TaskRepository.GettaskById calls FindAsync on the Tasks DbSet.');
    stack = ['controller', 'service', 'repository', 'ef-core'];
    push('ef-core', 'down', 'repoGet', at('repoGet', 'FindAsync(id, ct)'), { label: 'EF Core', fields: [['query', 'SELECT … FROM Tasks WHERE Id = @id (simplified)'], ['rows', '0']] }, 'FindAsync first looks in the change tracker, then queries the database. No row has this Id, so it returns null.');
    stack = ['controller', 'service', 'repository'];
    push('repository', 'up', 'repoGet', at('repoGet', '?? default;'), { label: 'Tasks?', fields: [['value', 'null']] }, 'The repository returns null ("if null (mean not found) then return default").');
    stack = ['controller', 'service', 'result'];
    push(
      'result',
      'up',
      'serviceGet',
      at('serviceGet', 'if (result is null)', 'IsSuccess = false,', 'StatusCode = 404'),
      { label: 'Result<TaskDTO>', fields: [['IsSuccess', 'false'], ['Error', `"Task with id ${TASK_ID.slice(0, 8)}… not found"`], ['StatusCode', '404']] },
      'Not finding a task is an expected outcome, so the service doesn\'t throw: it returns a Result<TaskDTO> with IsSuccess = false and StatusCode = 404.',
      { predict: { question: 'How does the service report "not found"?', options: ['It throws, and the middleware turns it into 404', 'It returns a Result with StatusCode 404'], answer: 1 } },
    );
    stack = ['controller'];
    push(
      'response-mapping',
      'up',
      'get',
      at('get', 'if (!result.IsSuccess)', '404 => NotFound(new { error = result.Error }),'),
      null,
      'Back in the controller: result.IsSuccess is false, so the StatusCode switch picks 404 => NotFound(new { error = result.Error }). No mapping to TaskResponse happens.',
      { response: { status: 404, text: 'Not Found', body: [['error', `"Task with id ${TASK_ID.slice(0, 8)}… not found"`]] }, action: 'done' },
    );
    return steps;
  }

  stack = ['controller'];
  push('controller', 'down', 'create', at('create', '[HttpPost]', 'public async Task<ActionResult<TaskResponse>> Create('), { label: 'CreateTaskRequest obj (from the JSON body)', fields: body }, 'POST /api/Task with a JSON body. Routing picks TaskController.Create, and [ApiController] binds the body to CreateTaskRequest obj before anything runs.', { action: 'start' });
  stack = ['controller', 'validation-filter'];
  push('validation-filter', 'down', 'program', at('program', 'options.Filters.Add<ValidationFilter>();'), null, 'ValidationFilter is registered globally in Program.cs, so it runs before every action.');
  push(
    'validation-filter',
    'down',
    'filter',
    at('filter', 'var validatorType = typeof(IValidator<>).MakeGenericType(arg.GetType());', 'var validator = scope.ServiceProvider.GetService(validatorType) as IValidator;'),
    { label: 'arg', fields: [['type', 'CreateTaskRequest'], ['validator', 'CreateTaskValidator']] },
    'For the CreateTaskRequest argument it resolves IValidator<CreateTaskRequest>, which is CreateTaskValidator (registered explicitly in AddApplicationServices).',
  );
  const bad = scenario === 'validation-failed';
  push(
    'validation-filter',
    'down',
    'validator',
    bad ? at('validator', 'RuleFor(T => T.Title).NotEmpty()') : at('validator', 'RuleFor(T => T.Title).NotEmpty()', 'RuleFor(T => T.ProjectId).NotEmpty()', 'RuleFor(T => T.DueDate)'),
    { label: 'ValidateAsync', fields: bad ? [['Title', 'NotEmpty fails']] : [['all rules', 'pass']] },
    bad ? 'ValidateAsync runs the rules. Title is empty, so NotEmpty fails with "Title should be provided and cannot be empty".' : 'ValidateAsync runs the rules: title present and short enough, a project id, a description, a due date that isn\'t in the past, a known priority. All pass.',
    { predict: { question: 'Does the request pass validation?', options: ['Yes, the action runs', 'No, the filter returns 400'], answer: bad ? 1 : 0 } },
  );
  if (bad) {
    stack = ['controller'];
    push(
      'validation-filter',
      'up',
      'filter',
      at('filter', 'context.Result = new BadRequestObjectResult(new', 'return; '),
      null,
      'The filter sets context.Result to a 400 with { Message, Instance, TraceId, Errors } and returns without calling next(): the action never runs, so no service, repository or database work happens.',
      {
        response: {
          status: 400,
          text: 'Bad Request',
          body: [
            ['Message', '"Validation Failed"'],
            ['Instance', 'Request.Path (/api/Task)'],
            ['TraceId', 'HttpContext.TraceIdentifier'],
            ['Errors', '[{ Field = "Title", Errors = ["Title should be provided and cannot be empty"] }]'],
          ],
        },
        action: 'done',
      },
    );
    return steps;
  }
  push('validation-filter', 'down', 'filter', at('filter', 'await next();'), null, 'The CancellationToken argument has no validator, so it is skipped. Everything passed: await next() runs the action.');
  stack = ['controller'];
  push(
    'controller',
    'down',
    'mapRequest',
    at('mapRequest', 'CreateMap<CreateTaskRequest, TaskDTO>()', 'dest.Id, opt => opt.MapFrom(_ => Guid.NewGuid())', 'dest.Status, opt => opt.MapFrom(_ => TaskItemStatus.InProgress)'),
    { label: 'TaskDTO', fields: [['Id', `${TASK_ID} (new)`], ['Title', `"${TITLE}"`], ['Status', 'InProgress'], ['Priority', 'High'], ['DueDate', '2030-01-15 00:00']] },
    'The action maps the wire DTO to the service DTO: _mapper.Map<TaskDTO>(obj). The MappingProfile gives it a new Id, CreatedAt = now, Status = InProgress, parses Priority and turns DueDate into a DateTime.',
  );
  stack = ['controller', 'service'];
  push('service', 'down', 'create', at('create', 'var result = await _taskService.CreateTask(DTO, ct);'), null, 'It calls _taskService.CreateTask(DTO, ct).');
  const dup = scenario === 'duplicate';
  push(
    'service',
    'down',
    'serviceCreate',
    at('serviceCreate', 'var result = await _taskRepo.GetTaskByName(', 'if (result != null)'),
    { label: 'GetTaskByName', fields: [['found', dup ? 'an existing task' : 'null']] },
    dup ? `TaskService trims the title and asks the repository for a task named "${TITLE}" for this user. One already exists.` : `TaskService trims the title and checks for an existing task with that name for this user: none.`,
    { predict: { question: 'A task with this title already exists?', options: ['No: continue', 'Yes: return a 409 Result'], answer: dup ? 1 : 0 } },
  );
  if (dup) {
    stack = ['controller', 'service', 'result'];
    push(
      'result',
      'up',
      'serviceCreate',
      at('serviceCreate', 'Error = "A task with this name already exists",', ['StatusCode = 409', 1]),
      { label: 'Result<TaskDTO>', fields: [['IsSuccess', 'false'], ['Error', '"A task with this name already exists"'], ['StatusCode', '409']] },
      'A duplicate is an expected business outcome, so the service returns it as data: Result<TaskDTO> { IsSuccess = false, StatusCode = 409 }. Nothing is thrown.',
    );
    stack = ['controller'];
    push('response-mapping', 'up', 'create', at('create', 'if (!result.IsSuccess)', '409 => Conflict(new { error = result.Error }),'), null, 'The controller\'s StatusCode switch turns 409 into Conflict(new { error = result.Error }).', {
      response: { status: 409, text: 'Conflict', body: [['error', '"A task with this name already exists"']] },
      action: 'done',
    });
    return steps;
  }
  push('service', 'down', 'serviceCreate', at('serviceCreate', 'var project = await _projectRepo.GetprojectById(', 'var entity = _mapper.Map<Tasks>(ObjTask);', 'var added = await _taskRepo.Addtask(entity, ct);'), { label: 'Tasks entity', fields: [['Id', TASK_ID], ['ProjectId', PROJECT_ID], ['Userid', 'the caller (ICurrentUser)']] }, 'The project id is valid, so it maps the DTO to a Tasks entity, stamps UpdatedAt and the current user\'s id, and calls _taskRepo.Addtask(entity, ct).');
  stack = ['controller', 'service', 'repository'];
  push('repository', 'down', 'repoAdd', at('repoAdd', 'await _appDbContext.Tasks.AddAsync(obj, ct);'), null, 'TaskRepository.Addtask adds the entity to the Tasks DbSet. The change tracker marks it Added; nothing has gone to the database yet.');
  stack = ['controller', 'service', 'repository', 'ef-core'];
  push('ef-core', 'down', 'repoAdd', at('repoAdd', 'return await _appDbContext.SaveChangesAsync(ct) > 0;'), { label: 'EF Core', fields: [['SQL', 'INSERT INTO Tasks (…) VALUES (…) (simplified)'], ['rows affected', '1']] }, 'SaveChangesAsync sends the INSERT for the Added entity (with the retry-on-failure execution strategy from AddInfrastructure). One row is written.');
  stack = ['controller', 'service', 'repository'];
  push('repository', 'up', 'repoAdd', at('repoAdd', 'return await _appDbContext.SaveChangesAsync(ct) > 0;'), { label: 'bool', fields: [['added', 'true']] }, 'SaveChangesAsync returned 1, so Addtask returns true.');
  stack = ['controller', 'service', 'result'];
  push(
    'result',
    'up',
    'serviceCreate',
    at('serviceCreate', 'var dto = _mapper.Map<TaskDTO>(entity);', 'StatusCode = 201,'),
    { label: 'Result<TaskDTO>', fields: [['IsSuccess', 'true'], ['StatusCode', '201'], ['Value', 'TaskDTO']] },
    'The service maps the saved entity back to a TaskDTO and wraps it: Result<TaskDTO> { IsSuccess = true, StatusCode = 201, Value = dto }. Result<T> carries success and failure the same way.',
  );
  push('result', 'up', 'result', at('result', 'public bool IsSuccess { get; init; }', 'public T? Value { get; init; }', 'public string? Error { get; init; }', 'public int StatusCode { get; init; }'), null, 'Result<T> is a small Domain class: IsSuccess, Value, Error and StatusCode, all init-only.');
  stack = ['controller'];
  push(
    'response-mapping',
    'up',
    'mapResponse',
    at('mapResponse', 'CreateMap<TaskDTO, TaskResponse>()', 'dest.Status', 'dest.priority'),
    { label: 'TaskResponse', fields: [['Id', TASK_ID], ['Title', `"${TITLE}"`], ['Status', '"InProgress"'], ['priority', '"High"']] },
    'Back in the controller, result.IsSuccess is true: _mapper.Map<TaskResponse>(result.Value) turns the service DTO into the wire contract, with Status and Priority as strings.',
  );
  push('response-mapping', 'up', 'create', at('create', 'return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);'), null, 'CreatedAtAction(nameof(GetById), new { id = response.Id }, response): 201 Created, a Location header pointing at GetById for the new id, and the TaskResponse as the body.', {
    response: { status: 201, text: 'Created', body: [['Location', `/api/Task/${TASK_ID}`], ['body', 'TaskResponse (Id, ProjectId, Title, Description, Status, priority, DueDate)']] },
    action: 'done',
  });
  return steps;
}
