using Microsoft.EntityFrameworkCore;
using System.Net.Security;
using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;
using Task_Management_System_API.Src.Infrastructure.Repositories;

namespace Task_Management_System_API.Src.Infrastructure.DependencyInjection
{
    public static class InfrastructureServiceRegistration
    {
       
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection");
            services.AddDbContext<AppDbContext>(options =>
                {
                    var dbConfig = configuration.GetSection("DBConfig");

                    var maxRetryCount = dbConfig.GetValue<int>("maxRetryCount", 3);
                    var maxRetryDelay = dbConfig.GetValue<int>("maxRetryDelayInSec", 5);

                    options.UseSqlServer(connectionString, sqlOptions =>
                    {
                        sqlOptions.EnableRetryOnFailure(
                            maxRetryCount: maxRetryCount,
                            maxRetryDelay: TimeSpan.FromSeconds(maxRetryDelay),
                            errorNumbersToAdd: null
                        );
                        sqlOptions.CommandTimeout(30);
                    })
                    .EnableDetailedErrors(false)
                    .EnableSensitiveDataLogging(false);
                }
            ); 

            services.AddScoped<ITaskRepository, TaskRepository>();
            services.AddScoped<IProjectRepository, ProjectRepository>();
            services.AddScoped<IrefreshTokenRepository, RefreshTokenRepository>();
            
            return services;
        }
    }
}
