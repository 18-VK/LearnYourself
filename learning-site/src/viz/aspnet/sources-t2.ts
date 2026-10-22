/**
 * Code copied verbatim for the T2 visualizers: from 9.ASP_GlobalExceptionHandling.md and from the capstone's real source
 * files under Examples/Task_Management_System_API/. verbatim.ts registers each one with the build (notes: inside a fenced
 * block; .cs files: anywhere in the file, line endings normalised).
 */

/** 9.ASP_GlobalExceptionHandling.md › By Create a sealed class that implements IExceptionHandler. */
export const EXCEPTION_HANDLER_CODE = `public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, 
        Exception exception, 
        CancellationToken cancellationToken)
    {
        // 1. Log the error with TraceId for correlation in production logs
        logger.LogError(exception, "Unhandled exception occurred. TraceId: {TraceId}", httpContext.TraceIdentifier);

        // 2. Map specific exceptions to HTTP status codes
        var (statusCode, title) = exception switch
        {
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            KeyNotFoundException => (StatusCodes.Status404NotFound, "Resource Not Found"),
            _ => (StatusCodes.Status500InternalServerError, "Internal Server Error")
        };

        // 3. Create a standardized ProblemDetails response (RFC 7807)
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception.Message, // CAUTION: Use generic messages in production for 500 errors
            Instance = httpContext.Request.Path
        };

        // Add extensions for observability
        problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;

        // 4. Write the response
        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true; // Indicates the exception has been handled
    }
}`;

/** 9.ASP_GlobalExceptionHandling.md › Full Execution Flow (a text block). */
export const EXCEPTION_FLOW_TEXT = `Request arrives
   ↓
ExceptionMiddleware.InvokeAsync()
   ↓
try
   ↓
_next(context)
   ↓
Controller executes
   ↓
Exception occurs ❌
   ↓
Control returns to middleware
   ↓
catch block runs ✅
   ↓
Custom response returned`;

/** 9.ASP_GlobalExceptionHandling.md › How to create middleware for global exception handling › Step 1: Create Middleware. */
export const EXCEPTION_MIDDLEWARE_CODE = `using System.Net;
using System.Text.Json;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context); // go to next middleware
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred");

            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        // switch case to decide status code 
        int statusCode = ex switch
        {
            ArgumentException => StatusCodes.Status400BadRequest,
            KeyNotFoundException => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status500InternalServerError
        };
        // response, can add more details like: request path, method name etc
        // Shown below : Use ProblemDetails (BEST PRACTICE)

        var response = new
        {
            message = ex.Message,
            status = statusCode,
            traceId = context.TraceIdentifier
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}`;

/** Examples/Task_Management_System_API/Src/API/Middlewares/GlobalExceptionMiddleware.cs › InvokeAsync. */
export const CAP_EXCEPTION_INVOKE = `        public async Task InvokeAsync(HttpContext httpContext)
        {
            try
            {
                await _next(httpContext);
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "Exception found");
                await HandleException(httpContext, ex);
            }
        }`;

/** Examples/Task_Management_System_API/Src/API/Middlewares/GlobalExceptionMiddleware.cs › HandleException. */
export const CAP_EXCEPTION_HANDLE = `        private Task HandleException(HttpContext httpContext, Exception ex)
        {
            var (statusCode, title) = ex switch
            {
                UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                KeyNotFoundException => (StatusCodes.Status404NotFound, "Resource Not Found"),
                ArgumentException => (StatusCodes.Status400BadRequest, "Bad request"),
                NotFoundException => (StatusCodes.Status404NotFound, "Bad request, Value not found"),
                ValidationException => (StatusCodes.Status400BadRequest, "Bad request, Business Validation failed"),
                _ => (StatusCodes.Status500InternalServerError, "Internal Server Error")
            };

            // response, can add more details like: request path, method name etc
            // Shown below : Use ProblemDetails (BEST PRACTICE)

            var response = new ProblemDetails
            {
                Status = statusCode,
                Detail = statusCode switch{ StatusCodes.Status500InternalServerError => "Internal server error", _ => ex.Message},
                Instance = httpContext.Request.Path,
                Title = title
            };
            // Add extensions for observability
            response.Extensions["traceId"] = httpContext.TraceIdentifier;

            httpContext.Response.StatusCode = statusCode;
            httpContext.Response.ContentType = "application/json";

            return httpContext.Response.WriteAsJsonAsync(response);

        }`;

/** Program.cs: the global ValidationFilter. */
export const CAP_PROGRAM_FILTER = `builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
});`;

/** Src/API/Controllers/TaskController.cs › Create. */
export const CAP_CONTROLLER_CREATE = `        [HttpPost]
        public async Task<ActionResult<TaskResponse>> Create(CreateTaskRequest obj, CancellationToken ct)
        {
            var DTO = _mapper.Map<TaskDTO>(obj);
            var result = await _taskService.CreateTask(DTO, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => NotFound(new { error = result.Error }),
                    400 => BadRequest(new { error = result.Error }),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    409 => Conflict(new { error = result.Error }),
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }

            // Map ProjectDTO into ProjectResponse
            var response = _mapper.Map<TaskResponse>(result.Value);

            return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);

        }`;

/** Src/API/Controllers/TaskController.cs › GetById. */
export const CAP_CONTROLLER_GET = `        [HttpGet("{Id:guid}")]
        public async Task<ActionResult<TaskResponse>> GetById(Guid Id, CancellationToken ct)
        {
            var result = await _taskService.GetTaskById(Id, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => NotFound(new { error = result.Error }),
                    400 => BadRequest(new { error = result.Error }),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }

            // Map TaskDTO into TaskResponse
            var response = _mapper.Map<TaskResponse>(result.Value);
            return Ok(response);
        }`;

/** Src/API/Filters/ValidationFilter.cs › OnActionExecutionAsync. */
export const CAP_VALIDATION_FILTER = `        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // 1. Check every action argument, not just the first one
            foreach (var arg in context.ActionArguments.Values)
            {
                // nothing to validate, but keep checking the remaining arguments
                if (arg == null)
                {
                    continue;
                }

                // 2. Resolve the validator for the type
                var validatorType = typeof(IValidator<>).MakeGenericType(arg.GetType());
                using var scope = _serviceProvider.CreateScope();
                var validator = scope.ServiceProvider.GetService(validatorType) as IValidator;

                if (validator != null)
                {
                    // 3. Perform validation on the argument the validator was resolved for
                    var contextToValidate = new ValidationContext<object>(arg);
                    var result = await validator.ValidateAsync(contextToValidate);


                    if (!result.IsValid)
                    {
                        var errors = result.Errors
                                        .GroupBy(e => e.PropertyName)
                                        .Select(g => new
                                        {
                                            Field = g.Key,
                                            Errors = g.Select(e => e.ErrorMessage).ToArray()
                                        });

                        context.Result = new BadRequestObjectResult(new
                        {
                            Message = "Validation Failed",
                            Instance = context.HttpContext.Request.Path,
                            TraceId = context.HttpContext.TraceIdentifier,
                            Errors = errors
                        });
                        // don't call next middleware if validation fails, short circuit the pipline
                        return; 
                    }
                }
              
            }
            // ✅ Only call next if validation passed
            await next();
        }`;

/** Src/Application/Validators/Task/CreateTaskValidator.cs › the rules. */
export const CAP_CREATE_VALIDATOR = `        public CreateTaskValidator() 
        {
            //title 
            RuleFor(T => T.Title).NotEmpty().WithMessage("Title should be provided and cannot be empty");
            RuleFor(T => T.Title).MaximumLength(256).WithMessage("Title field should have length of maximum 256");

            // Project id 
            RuleFor(T => T.ProjectId).NotEmpty().WithMessage("ProjectId should be provided and cannot be empty");

            RuleFor(t => t.ProjectId)
                        .Must(id => id != Guid.Empty)
                        .WithMessage("ProjectId must be a valid non-empty GUID.");

            // Desctiption
            RuleFor(T => T.Description).NotEmpty().WithMessage("Description should be provided and cannot be empty");
            RuleFor(T => T.Description).MaximumLength(1024).WithMessage("Description field should have length of maximum 1024");

            // DueDate
            RuleFor(T => T.DueDate).GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date)).WithMessage("The Due Date must be in the future.");

            // Task Priority 
            RuleFor(T=> T.Priority).IsEnumName(typeof(TaskPriority), false).WithMessage("Invalid priority. Allowed values are: Low, Medium, High");
        }`;

/** Src/Application/Services/TaskService.cs › CreateTask. */
export const CAP_SERVICE_CREATE = `        public async Task<Result<TaskDTO>> CreateTask(TaskDTO ObjTask, CancellationToken ct)
        {
            // check if already exist 
            try
            {
                ObjTask.Title = ObjTask.Title?.Trim();
                var result = await _taskRepo.GetTaskByName(ObjTask.Title ?? "", _currentUser.userId ?? default,  ct);

                if (result != null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "A task with this name already exists",
                        StatusCode = 409
                    };
                }
                // check for project Id valid or not 
                var project = await _projectRepo.GetprojectById(ObjTask.ProjectId ?? default, ct);
                if (project == null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Invalid project id assigned for task",
                        StatusCode = 409
                    };
                }

                //map 
                var entity = _mapper.Map<Tasks>(ObjTask);
                entity.UpdatedAt = DateTimeOffset.UtcNow;
                entity.Userid = _currentUser.userId ?? default;

                var added = await _taskRepo.Addtask(entity, ct);

                if (!added)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Unexpected error while add task",
                        StatusCode = 500
                    };
                }
                else
                {
                    var dto = _mapper.Map<TaskDTO>(entity);

                    return new Result<TaskDTO>
                    {
                        IsSuccess = true,
                        StatusCode = 201,
                        Value = dto
                    };
                }

            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateTask failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }`;

/** Src/Application/Services/TaskService.cs › GetTaskById. */
export const CAP_SERVICE_GET = `        public async Task<Result<TaskDTO>> GetTaskById(Guid taskId, CancellationToken ct)
        {
            try
            {
                var result = await _taskRepo.GettaskById(taskId, ct);
                if (result is null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = $"Task with id {taskId} not found",
                        StatusCode = 404
                    };
                }
                // map 
                var Obj = _mapper.Map<TaskDTO>(result);

                return new Result<TaskDTO>
                {
                    IsSuccess = true,
                    Value = Obj,
                    StatusCode = 200
                };
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTaskById failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }`;

/** Src/Domain/Common/Result.cs. */
export const CAP_RESULT = `    public class Result<T>
    {
        public bool IsSuccess { get; init; }
        public T? Value { get; init; }
        public string? Error { get; init; }
        public int StatusCode { get; init; }
    }`;

/** Src/Infrastructure/Repositories/TaskRepository.cs › Addtask. */
export const CAP_REPO_ADD = `        public async Task<bool> Addtask(Tasks obj, CancellationToken ct)
        {
            if (obj == null) throw new ArgumentNullException(nameof(obj));

            try
            {
                await _appDbContext.Tasks.AddAsync(obj, ct);
                return await _appDbContext.SaveChangesAsync(ct) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Addtask failed");
                return false;
            }
        }`;

/** Src/Infrastructure/Repositories/TaskRepository.cs › GettaskById. */
export const CAP_REPO_GET = `        public async Task<Tasks?> GettaskById(Guid id, CancellationToken ct)
        {
            // if null(mean not found) then return default(that is null)
            try
            {
                return await _appDbContext.Tasks.FindAsync(id, ct) ?? default;
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "GettaskById failed for id {Id}", id);
                return default;
            }
        }`;

/** Src/Application/Mappings/MappingProfile.cs › CreateTaskRequest → TaskDTO. */
export const CAP_MAP_REQUEST = `            CreateMap<CreateTaskRequest, TaskDTO>()
                       .ForMember(dest => dest.Id, opt => opt.MapFrom(_ => Guid.NewGuid()))
                       .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTimeOffset.UtcNow))
                       .ForMember(dest => dest.Status, opt => opt.MapFrom(_ => TaskItemStatus.InProgress))
                       .ForMember(dest => dest.Priority, option => option.MapFrom(src => Enum.Parse<TaskPriority>(src.Priority ?? "Medium")))
                       .ForMember(dest => dest.DueDate, option => option.MapFrom(src => src.DueDate.ToDateTime(TimeOnly.MinValue)))
                       .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                                    srcMember != null));`;

/** Src/Application/Mappings/MappingProfile.cs › TaskDTO → TaskResponse. */
export const CAP_MAP_RESPONSE = `            CreateMap<TaskDTO, TaskResponse>()
                    .ForMember(dest => dest.Status, option => option.MapFrom(src => src.Status.ToString()))
                    .ForMember(dest => dest.priority, option => option.MapFrom(src => src.Priority.ToString()));`;

// ── 12.ASP_AuthServer.md › Refresh Token ──

/** 12.ASP_AuthServer.md › Refresh Token › Step 1 — Initial login, both tokens issued together. */
export const REFRESH_LOGIN_CODE = `var tokenFamilyId = Guid.NewGuid();  // "Family A" - born here
var (rawRefreshToken, refreshTokenEntity) = _tokenService.GenerateRefreshToken(
    user.Id, tokenFamilyId, ipAddress, userAgent);

_dbContext.RefreshTokens.Add(refreshTokenEntity);
await _dbContext.SaveChangesAsync();`;

/** 12.ASP_AuthServer.md › Refresh Token › Step 3 — Client calls refresh (inside RefreshTokenAsync). */
export const REFRESH_LOOKUP_CODE = `var hash = _tokenService.HashToken(refreshToken);   // recompute the hash, same as verification pattern

var existing = await _dbContext.RefreshTokens
    .Include(rt => rt.User)
    .FirstOrDefaultAsync(rt => rt.TokenHash == hash);   // finds rt-001

// existing.RevokedAtUtc is null, existing.ExpiresAtUtc is in the future → valid`;

/** 12.ASP_AuthServer.md › Refresh Token › Step 3: revoke the old token and mint a new one in the same family. */
export const REFRESH_ROTATE_CODE = `existing.RevokedAtUtc = DateTime.UtcNow;   // rt-001 dies right now

var (rawToken, newEntity) = _tokenService.GenerateRefreshToken(
    existing.UserId, existing.TokenFamilyId, ipAddress, userAgent);   // SAME family-A

existing.ReplacedByTokenId = newEntity.Id;
_dbContext.RefreshTokens.Add(newEntity);`;

/** 12.ASP_AuthServer.md › Refresh Token › Step 5 — reuse detection. */
export const REFRESH_REUSE_CODE = `var existing = await _dbContext.RefreshTokens...FirstOrDefaultAsync(rt => rt.TokenHash == hash);
// finds rt-002

if (existing.RevokedAtUtc is not null)
{
    // rt-002 was already revoked (back in step 3, when the REAL user refreshed past it)
    // A revoked token being presented again = someone is replaying a stolen token
    await RevokeFamilyAsync(existing.TokenFamilyId);   // kills rt-002, rt-003, rt-004 - EVERYTHING in family-A
    return new AuthResult { Succeeded = false, Errors = new[] { "Refresh token reuse detected; all sessions revoked." } };
}`;

// ── 3.ASP_ControllerNRouting.md and 4.ASP_ModelBindingNMore.md ──

/** 3.ASP_ControllerNRouting.md › Attribute Routing › Real world example. */
export const PRODUCTS_CONTROLLER_CODE = `[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    // GET /api/products
    [HttpGet]
    public IActionResult GetAll() => Ok();


    // GET /api/products/5
    [HttpGet("{id:int}")]
    public IActionResult Get(int id) => Ok();


    // GET /api/products/search?name=pen
    [HttpGet("search")]
    public IActionResult Search(string name) => Ok();


    // POST /api/products
    // Body: { "name": "Pen", "price": 10 }
    [HttpPost]
    public IActionResult Create() => Ok();


    // PUT /api/products/5
    // Body: { updated data }
    [HttpPut("{id}")]
    public IActionResult Update(int id) => Ok();


    // DELETE /api/products/5
    [HttpDelete("{id}")]
    public IActionResult Delete(int id) => Ok();
}`;

/** 4.ASP_ModelBindingNMore.md › How Model Binding Works › Big Picture Flow (a text block). */
export const BINDING_FLOW_TEXT = `Client Request
   ↓
Routing (find action)
   ↓
Model Binding (map data → parameters)
   ↓
Model Validation (check rules)
   ↓
Controller Action executes
   ↓
Response`;

/** 4.ASP_ModelBindingNMore.md › How Model Binding Works › Example 1. */
export const BINDING_EXAMPLE_CODE = `// GET /api/products/5?name=pen
[HttpGet("{id}")]
public IActionResult Get(int id, string name)
{
    return Ok(new { id, name });
}`;

/** 4.ASP_ModelBindingNMore.md › Real-World Best Practice › the DTO. */
export const CREATE_PRODUCT_DTO_CODE = `public class CreateProductDto
{
    public string Name { get; set; }
    public decimal Price { get; set; }
}`;

/** 4.ASP_ModelBindingNMore.md › Real-World Best Practice › the action. */
export const CREATE_PRODUCT_ACTION_CODE = `[HttpPost]
public IActionResult Create(CreateProductDto dto)
{
    var product = new Product
    {
        Name = dto.Name,
        Price = dto.Price,
        IsAdminOnly = false  // controlled by server
    };

    return Ok(product);
}`;

// ── 6.ASP_ClientCallingWebAPI.md and 7.ASP_HttpClientClassNMore.md ──

/** 6.ASP_ClientCallingWebAPI.md › Register Services (Program.cs): a typed HttpClient from IHttpClientFactory. */
export const TYPED_CLIENT_CODE = `using ApiClient.Config;
using ApiClient.Services;

var builder = WebApplication.CreateBuilder(args);

// Bind config
builder.Services.Configure<ApiSettings>(
    builder.Configuration.GetSection("ApiSettings")
);

// Typed HttpClient
builder.Services.AddHttpClient<IProductApiClient, ProductApiClient>((sp, client) =>
{
    var config = sp.GetRequiredService<IOptions<ApiSettings>>().Value;

    client.BaseAddress = new Uri(config.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(config.TimeoutSeconds);
});`;


/** 7.ASP_HttpClientClassNMore.md › Instance Management (prose, not a code block: checked by the unit tests). */
export const INSTANCE_MANAGEMENT_TEXT = `A key best practice is to reuse a single \`HttpClient\` instance throughout the application's lifetime. Creating and disposing of an \`HttpClient\` for every request can lead to socket exhaustion and performance issues because underlying network connections are not released immediately.`;

// ── HttpsImplementation.md ──

/** HttpsImplementation.md › Force HTTPS — reject/redirect plain HTTP. */
export const HTTPS_PROGRAM_CODE = `// Program.cs
var builder = WebApplication.CreateBuilder(args);

// ... your existing AddIdentityCore, AddJwtBearer, etc. registrations ...

builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
    options.HttpsPort = 443;
});

// HSTS - tells browsers to NEVER even try HTTP again for a while
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();   // sends Strict-Transport-Security header — only in prod, HSTS + local dev certs don't mix well
}

app.UseHttpsRedirection();   // redirects any http:// request to https://`;
