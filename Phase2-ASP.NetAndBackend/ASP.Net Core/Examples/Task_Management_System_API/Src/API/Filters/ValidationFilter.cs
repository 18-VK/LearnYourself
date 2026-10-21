using FluentValidation;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.ComponentModel.DataAnnotations;
using static System.Net.WebRequestMethods;

namespace Task_Management_System_API.Src.API.Filters
{
    public class ValidationFilter : IAsyncActionFilter
    {
        private readonly IServiceProvider _serviceProvider;

        public ValidationFilter(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
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
        }
    }
}