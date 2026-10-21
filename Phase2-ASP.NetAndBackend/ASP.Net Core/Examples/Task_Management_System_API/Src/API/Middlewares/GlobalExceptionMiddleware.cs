using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Threading.Tasks;
using Task_Management_System_API.Src.Application.Exceptions;

namespace Task_Management_System_API.Src.API.Middlewares
{
    // You may need to install the Microsoft.AspNetCore.Http.Abstractions package into your project
    public class GlobalExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GlobalExceptionMiddleware> _logger;
        public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext httpContext)
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
        }
        private Task HandleException(HttpContext httpContext, Exception ex)
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

        }
    }

    // Extension method used to add the middleware to the HTTP request pipeline.
    public static class MiddlewareExtensions
    {
        public static IApplicationBuilder UseMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<GlobalExceptionMiddleware>();
        }
    }
}
