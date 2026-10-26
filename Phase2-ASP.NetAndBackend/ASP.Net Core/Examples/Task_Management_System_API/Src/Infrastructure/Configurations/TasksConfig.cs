using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Infrastructure.Configurations
{
    public class TasksConfig : IEntityTypeConfiguration<Tasks>
    {
        public void Configure(EntityTypeBuilder<Tasks> builder)
        {
            builder.ToTable("Task")
                    .HasKey(t => t.Id);

            // Creating index
            builder.HasIndex(t => new { t.Title, t.Userid } ) .HasDatabaseName("IDX_TASK_NAME_USERID");
                    
            builder.Property(t => t.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(t => t.Title)
                    .HasMaxLength(256)
                    .UseCollation("SQL_Latin1_General_CP1_CI_AS"); // CI = Case Insensitive

            builder.Property(t => t.Description)
                    .HasMaxLength(1024);

            builder.Property(t => t.Status).HasConversion<string>();
            builder.Property(t => t.Priority).HasConversion<string>();

            builder.Property(t => t.RowVersion)
                    .IsRowVersion()
                    .IsConcurrencyToken();
        }
    }
}
