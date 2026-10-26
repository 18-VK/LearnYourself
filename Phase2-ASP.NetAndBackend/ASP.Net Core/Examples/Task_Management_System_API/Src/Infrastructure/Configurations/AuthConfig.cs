using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Infrastructure.Configurations
{
    public class ApplicationUserConfig : IEntityTypeConfiguration<ApplicationUser>
    {
        public void Configure(EntityTypeBuilder<ApplicationUser> builder)
        {
            builder.ToTable("User")
                   .HasKey(u => u.Id);
            builder.Property(u => u.FirstName)
                   .IsRequired()
                   .HasMaxLength(100);

            builder.Property(u => u.LastName)
                   .IsRequired()
                   .HasMaxLength(100);
        }
    }

    public class RefreshTokenConfig : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable("RefreshToken")
                   .HasKey(rt => rt.Id);

            builder.Property(t => t.Token)
                   .IsRequired()
                   .HasMaxLength(256);

            builder.HasIndex(t => t.Token, "IDX_RefreshToken")
                   .IsUnique();
            
            builder.HasOne(rt => rt.User)
                   .WithMany(u => u.RefreshTokens)
                   .HasForeignKey(rt => rt.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(rt => rt.UserId, "IDX_RefreshToken_userid");
            builder.HasIndex(rt => rt.TokenFamilyId, "IDX_RefreshToken_TokenFamily");

            builder.Property(rt => rt.CreatedByIp).HasMaxLength(64);
            builder.Property(rt => rt.UserAgent).HasMaxLength(512);

            builder.Property(rt => rt.RowVersion)
                   .IsRowVersion()
                   .IsConcurrencyToken();
        }
    }
}
