using Task_Management_System_API.Src.API.Middlewares;
using Task_Management_System_API.Src.Application.Services;

namespace Task_Management_System_API.Src.API.Extensions
{
    public static class ApplicationBuilderExtensions
    {
        public static IApplicationBuilder UseCustomMiddleware(this IApplicationBuilder app)
        {
          
            app.UseMiddleware<GlobalExceptionMiddleware>();
            
            return app;
        }

        public static async Task<bool> SeedIdentityAsync(this IApplicationBuilder app)
        {
            using var scope = app.ApplicationServices.CreateScope();
            var services = scope.ServiceProvider;
            var loggerFactory = services.GetRequiredService<ILoggerFactory>();
            var logger = loggerFactory.CreateLogger("SeedIdentityAsync");

            try
            {
                var seeded = await IdentitySeeder.SeedRolesAndAdminAsync(services, services.GetRequiredService<IConfiguration>());
            }
            catch(Exception ex)
            {
                logger.LogCritical(ex.Message);
                return false;
            }

            return true;
        }
    }
}
