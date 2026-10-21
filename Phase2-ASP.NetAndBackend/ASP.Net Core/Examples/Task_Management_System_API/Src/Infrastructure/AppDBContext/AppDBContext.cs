using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Infrastructure.AppDBContext
{
    public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
    {
        // table set 
        public DbSet<Tasks> Tasks => Set<Tasks>();
        public DbSet<Projects> Projects => Set<Projects>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

        //int maxRetry = 3;
        //int maxRetryDelayInSec = 5;
        public AppDbContext(DbContextOptions<AppDbContext> options, IConfiguration configuration) : base(options) 
        {

            //var DBConfig = configuration.GetSection("DBConfig");
            //if (DBConfig != null)
            //{
            //    var val = DBConfig.GetValue<int>("maxRetryCount");

            //    if (val > 0)
            //        maxRetry = val;

            //    val = DBConfig.GetValue<int>("maxRetryDelayInSec");

            //    if (val > 0)
            //        maxRetryDelayInSec = val;
            //}
        }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<IdentityUserLogin<Guid>>(entity =>
            {
                entity.Property(e => e.LoginProvider).HasMaxLength(128);
                entity.Property(e => e.ProviderKey).HasMaxLength(128);
            });

            modelBuilder.Entity<IdentityUserToken<Guid>>(entity =>
            {
                entity.Property(e => e.LoginProvider).HasMaxLength(128);
                entity.Property(e => e.Name).HasMaxLength(128);
            });

            // call fluent API Configuration 

            // Scans the assembly for any class implementing IEntityTypeConfiguration
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        }
    }
}
