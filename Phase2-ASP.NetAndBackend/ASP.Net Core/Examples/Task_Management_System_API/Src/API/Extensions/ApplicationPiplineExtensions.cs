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

            // MapControllers is an endpoint routing method
            app.MapControllers();

            return app;
        }

    }
}
