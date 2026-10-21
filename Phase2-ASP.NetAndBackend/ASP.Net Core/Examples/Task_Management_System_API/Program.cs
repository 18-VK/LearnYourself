using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Threading.RateLimiting;
using Task_Management_System_API.Src.API.Extensions;
using Task_Management_System_API.Src.API.Filters;
using Task_Management_System_API.Src.Application.Services;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;
using Task_Management_System_API.Src.Infrastructure.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
});
builder.Host.UseDefaultServiceProvider((options) =>
{
    options.ValidateOnBuild = true;
    options.ValidateScopes = true;
});


// log
Log.Logger = new LoggerConfiguration().ReadFrom.Configuration(builder.Configuration).CreateLogger();
builder.Host.UseSerilog(Log.Logger);

// Rate limiting 

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers["Retry-After-Sec"] = "5";
        await context.HttpContext.Response.WriteAsync(
            "Too many requests. Please try again later.", token);
    };
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        // partition key (example: use a client id header or IP; change as needed)
        var clientId = context.Request.Headers["X-ClientId"].ToString();
        if (string.IsNullOrEmpty(clientId))
        {
            clientId = "anonymous";
        }

        return RateLimitPartition.GetTokenBucketLimiter(clientId, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 10,
            TokensPerPeriod = 10,
            ReplenishmentPeriod = TimeSpan.FromSeconds(5),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});

//ApplicationServices
builder.Services.AddApplicationServices();
// Infrastructure services 
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddAuthInfrastructure(builder.Configuration);

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition(JwtBearerDefaults.AuthenticationScheme, new OpenApiSecurityScheme
    {
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = JwtBearerDefaults.AuthenticationScheme,
        BearerFormat = "JWT",
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\""
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = JwtBearerDefaults.AuthenticationScheme
                }
            },
            Array.Empty<string>()
        }
    });
});


var app = builder.Build();

app.UseCustomMiddleware();
app.UseRequiredPipeline();

// seed roles one time
var success = app.SeedIdentityAsync().GetAwaiter().GetResult();
if (!success)
{
    Environment.FailFast("Identity seeding failed. Application will not start.");
}
app.Run();


