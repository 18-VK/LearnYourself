using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore;
using Task_Management_System_API.Src.Domain.Entities;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Task_Management_System_API.Src.Infrastructure.Configurations
{
    public class ProjectsConfig : IEntityTypeConfiguration<Projects>
    {
        public void Configure(EntityTypeBuilder<Projects> builder)
        {
            builder.ToTable("Project")
                    .HasKey(P => P.Id);

            builder.Property(P => P.Name)
                    .HasMaxLength(256);

            builder.Property(P => P.Description)
                    .HasMaxLength(1024);


            builder.Property(p => p.Name)
                    .UseCollation("SQL_Latin1_General_CP1_CI_AS"); // CI = Case Insensitive

            builder.Property(p => p.CreatedAt)
                   .HasDefaultValueSql("GETUTCDATE()");


            // Creating index
            builder.HasIndex(p => new { p.Name, p.Userid } ).HasDatabaseName("IDX_PROJ_NAME_USERID");
                    
            builder.HasMany(p => p.TaskItems)      // Projects has many TaskItems
                  .WithOne(t => t.Project)         
                  .HasForeignKey(t => t.ProjectId) // The link is the ProjectId GUID
                  .OnDelete(DeleteBehavior.Cascade);

            builder.Property(p => p.RowVersion)
                    .IsRowVersion()
                    .IsConcurrencyToken();
        }
    }
}
