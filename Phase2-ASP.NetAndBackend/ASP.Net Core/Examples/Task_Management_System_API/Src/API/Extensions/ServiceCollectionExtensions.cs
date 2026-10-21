using AutoMapper;
using FluentValidation;
using Task_Management_System_API.Src.API.DTOs.Requests.Auth;
using Task_Management_System_API.Src.API.DTOs.Requests.Projects;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.API.Filters;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Application.Mappings;
using Task_Management_System_API.Src.Application.Services;
using Task_Management_System_API.Src.Application.Validators.Auth;
using Task_Management_System_API.Src.Application.Validators.Project;
using Task_Management_System_API.Src.Application.Validators.Task;

namespace Task_Management_System_API.Src.API.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            // Mapping and Validation Filter
            services.AddScoped<ValidationFilter>();
            services.AddAutoMapper( cfg => { }, typeof(MappingProfile));
            
            // Service class 
            services.AddScoped<ITaskService, TaskService>();
            services.AddScoped<IProjectService, ProjectService>();
            

            services.AddScoped<IValidator<CreateTaskRequest>, CreateTaskValidator>();
            services.AddScoped<IValidator<UpdateTaskStatusRequest>, UpdateTaskStatusValidator>();
            services.AddScoped<IValidator<UpdateTaskRequest>, UpdateTaskValidator>();
            services.AddScoped<IValidator<CreateProjectRequest>,  CreateProjectValidator>();
            services.AddScoped<IValidator<UpdateProjectRequest>, UpdateProjectValidator>();
            services.AddScoped<IValidator<TaskFilterRequest>, TaskFilterValidator>();

            services.AddScoped<IValidator<LoginUserRequest>, LoginValidator>();
            services.AddScoped<IValidator<RegisterUserRequest>, RegisterValidator>();
            services.AddScoped<IValidator<RefreshTokenRequest>, RefreshTokenValidator>();
            // DI for all 
            return services;
        }
    }
}
