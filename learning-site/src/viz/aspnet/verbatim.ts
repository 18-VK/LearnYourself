import type { VerbatimCheck } from '../engine/loader';
import * as S from './sources';
import * as T from './sources-t2';

const fix = (what: string) => `src/viz/aspnet/sources.ts (${what}) and the visualizer that uses it`;
const check = (label: string, file: string, heading: string, code: string, name: string): VerbatimCheck => ({ label, file, heading, code, fix: fix(name) });
const N = (f: string) => `Phase2-ASP.NetAndBackend/ASP.Net Core/${f}`;
const CAP = (f: string) => N(`Examples/Task_Management_System_API/${f}`);
/** Capstone source files: the build checks the code appears anywhere in the file (scripts/lib/generate.ts). */
const capCheck = (file: string, heading: string, code: string, name: string): VerbatimCheck => ({ label: 'capstone trace visualizer', file: CAP(file), heading, code, fix: `src/viz/aspnet/sources-t2.ts (${name}) and src/viz/aspnet/capstone/trace.ts` });

/** Code panels in this area that copy code from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = [
  check('middleware in-and-out visualizer', S.NOTES.middleware, 'How middleware works internally', S.MIDDLEWARE_FLOW_TEXT, 'MIDDLEWARE_FLOW_TEXT'),
  check('middleware production-order visualizer', S.NOTES.middleware, 'Final Production Order (VERY IMPORTANT)', S.PRODUCTION_ORDER_CODE, 'PRODUCTION_ORDER_CODE'),
  check('middleware production-order visualizer (CORS policy)', S.NOTES.middleware, 'UseCors()', S.CORS_POLICY_CODE, 'CORS_POLICY_CODE'),
  check('middleware production-order visualizer (rate limiter)', S.NOTES.middleware, 'UseRateLimiter()', S.MIDDLEWARE_RATE_LIMIT_CODE, 'MIDDLEWARE_RATE_LIMIT_CODE'),
  check('rate limiter visualizer', S.NOTES.rateLimiting, '2. All Four Limiter Types', S.ALL_FOUR_LIMITERS_CODE, 'ALL_FOUR_LIMITERS_CODE'),
  check('rate limiter visualizer (rejection)', S.NOTES.rateLimiting, '1. Basic Setup', S.REJECTION_CODE, 'REJECTION_CODE'),
  check('JWT decoder visualizer (header)', S.NOTES.auth, '1. Header', S.JWT_HEADER_JSON, 'JWT_HEADER_JSON'),
  check('JWT decoder visualizer (signature)', S.NOTES.auth, '3. Signature', S.JWT_SIGNATURE_TEXT, 'JWT_SIGNATURE_TEXT'),
  check("JWT decoder visualizer (the note's token)", S.NOTES.auth, '4. Final JWT token', S.JWT_NOTE_TOKEN, 'JWT_NOTE_TOKEN'),
  check('JWT sequence visualizer', S.NOTES.auth, 'Configuration (App Setup)', S.JWT_VALIDATION_CODE, 'JWT_VALIDATION_CODE'),
  check('RS256 visualizer (signing)', S.NOTES.auth, 'How Validation Happens (RUNTIME FLOW)', S.RSA_SIGN_TEXT, 'RSA_SIGN_TEXT'),
  check('RS256 visualizer (verifying)', S.NOTES.auth, 'How Validation Happens (RUNTIME FLOW)', S.RSA_VERIFY_TEXT, 'RSA_VERIFY_TEXT'),
  check('RS256 visualizer (.NET signing key)', S.NOTES.moreAuth, 'How to Use These Keys in .NET', S.RSA_SIGNING_CREDENTIALS_CODE, 'RSA_SIGNING_CREDENTIALS_CODE'),
  // T2
  check('route matcher visualizer', N('3.ASP_ControllerNRouting.md'), 'Real world example', T.PRODUCTS_CONTROLLER_CODE, 'PRODUCTS_CONTROLLER_CODE'),
  check('model binding visualizer (flow)', N('4.ASP_ModelBindingNMore.md'), 'How Model Binding Works', T.BINDING_FLOW_TEXT, 'BINDING_FLOW_TEXT'),
  check('model binding visualizer (Example 1)', N('4.ASP_ModelBindingNMore.md'), 'How Model Binding Works', T.BINDING_EXAMPLE_CODE, 'BINDING_EXAMPLE_CODE'),
  check('model binding visualizer (DTO action)', N('4.ASP_ModelBindingNMore.md'), '3. Real-World Best Practice (VERY IMPORTANT)', T.CREATE_PRODUCT_ACTION_CODE, 'CREATE_PRODUCT_ACTION_CODE'),
  check('model binding visualizer (DTO)', N('4.ASP_ModelBindingNMore.md'), '3. Real-World Best Practice (VERY IMPORTANT)', T.CREATE_PRODUCT_DTO_CODE, 'CREATE_PRODUCT_DTO_CODE'),
  check('HttpClient pooling visualizer', N('6.ASP_ClientCallingWebAPI.md'), 'Register Services (Program.cs)', T.TYPED_CLIENT_CODE, 'TYPED_CLIENT_CODE'),
  check('ProblemDetails visualizer (flow)', N('9.ASP_GlobalExceptionHandling.md'), 'Full Execution Flow', T.EXCEPTION_FLOW_TEXT, 'EXCEPTION_FLOW_TEXT'),
  check('ProblemDetails visualizer (IExceptionHandler)', N('9.ASP_GlobalExceptionHandling.md'), 'By Create a sealed class that implements IExceptionHandler', T.EXCEPTION_HANDLER_CODE, 'EXCEPTION_HANDLER_CODE'),
  check('ProblemDetails visualizer (middleware)', N('9.ASP_GlobalExceptionHandling.md'), 'How to create middleware for global exception handling and how to use it', T.EXCEPTION_MIDDLEWARE_CODE, 'EXCEPTION_MIDDLEWARE_CODE'),
  check('HTTPS/HSTS visualizer', N('HttpsImplementation.md'), 'Force HTTPS — reject/redirect plain HTTP', T.HTTPS_PROGRAM_CODE, 'HTTPS_PROGRAM_CODE'),
  check('refresh rotation visualizer (login)', N('12.ASP_AuthServer.md'), 'Refresh Token', T.REFRESH_LOGIN_CODE, 'REFRESH_LOGIN_CODE'),
  check('refresh rotation visualizer (lookup)', N('12.ASP_AuthServer.md'), 'Refresh Token', T.REFRESH_LOOKUP_CODE, 'REFRESH_LOOKUP_CODE'),
  check('refresh rotation visualizer (rotation)', N('12.ASP_AuthServer.md'), 'Refresh Token', T.REFRESH_ROTATE_CODE, 'REFRESH_ROTATE_CODE'),
  check('refresh rotation visualizer (reuse detection)', N('12.ASP_AuthServer.md'), 'Refresh Token', T.REFRESH_REUSE_CODE, 'REFRESH_REUSE_CODE'),
  capCheck('Src/API/Middlewares/GlobalExceptionMiddleware.cs', 'InvokeAsync', T.CAP_EXCEPTION_INVOKE, 'CAP_EXCEPTION_INVOKE'),
  capCheck('Src/API/Middlewares/GlobalExceptionMiddleware.cs', 'HandleException', T.CAP_EXCEPTION_HANDLE, 'CAP_EXCEPTION_HANDLE'),
  capCheck('Program.cs', 'AddControllers', T.CAP_PROGRAM_FILTER, 'CAP_PROGRAM_FILTER'),
  capCheck('Src/API/Controllers/TaskController.cs', 'Create', T.CAP_CONTROLLER_CREATE, 'CAP_CONTROLLER_CREATE'),
  capCheck('Src/API/Controllers/TaskController.cs', 'GetById', T.CAP_CONTROLLER_GET, 'CAP_CONTROLLER_GET'),
  capCheck('Src/API/Filters/ValidationFilter.cs', 'OnActionExecutionAsync', T.CAP_VALIDATION_FILTER, 'CAP_VALIDATION_FILTER'),
  capCheck('Src/Application/Validators/Task/CreateTaskValidator.cs', 'CreateTaskValidator', T.CAP_CREATE_VALIDATOR, 'CAP_CREATE_VALIDATOR'),
  capCheck('Src/Application/Services/TaskService.cs', 'CreateTask', T.CAP_SERVICE_CREATE, 'CAP_SERVICE_CREATE'),
  capCheck('Src/Application/Services/TaskService.cs', 'GetTaskById', T.CAP_SERVICE_GET, 'CAP_SERVICE_GET'),
  capCheck('Src/Domain/Common/Result.cs', 'Result<T>', T.CAP_RESULT, 'CAP_RESULT'),
  capCheck('Src/Infrastructure/Repositories/TaskRepository.cs', 'Addtask', T.CAP_REPO_ADD, 'CAP_REPO_ADD'),
  capCheck('Src/Infrastructure/Repositories/TaskRepository.cs', 'GettaskById', T.CAP_REPO_GET, 'CAP_REPO_GET'),
  capCheck('Src/Application/Mappings/MappingProfile.cs', 'CreateTaskRequest → TaskDTO', T.CAP_MAP_REQUEST, 'CAP_MAP_REQUEST'),
  capCheck('Src/Application/Mappings/MappingProfile.cs', 'TaskDTO → TaskResponse', T.CAP_MAP_RESPONSE, 'CAP_MAP_RESPONSE'),
];
