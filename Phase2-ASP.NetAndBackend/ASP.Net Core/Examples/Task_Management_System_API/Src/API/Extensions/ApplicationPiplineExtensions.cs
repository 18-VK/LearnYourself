using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;

namespace Task_Management_System_API.Src.API.Extensions
{
    public static class ApplicationPiplineExtensions
    {
        public static WebApplication UseRequiredPipeline(this WebApplication app)
        {
            // check for DB Connection
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                if (!db.Database.CanConnect())
                {
                    throw new Exception("Database connection failed at startup.");
                }
            }

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();
            app.UseRateLimiter();
            app.UseAuthentication();
            app.UseAuthorization();

            // Add endpoint routing for heath checks

            // LIVENESS probe
            app.MapHealthChecks("/Health/live", new HealthCheckOptions
            {
                Predicate = reg => reg.Tags.Contains("live")
            })
            .AllowAnonymous()
            .DisableRateLimiting();


            // READINESS probe
            app.MapHealthChecks("/Health/ready", new HealthCheckOptions
            {
                Predicate = reg => reg.Tags.Contains("ready")
            })
            .AllowAnonymous()
            .DisableRateLimiting();

            // MapControllers is an endpoint routing method
            app.MapControllers();

            return app;
        }

    }
}
