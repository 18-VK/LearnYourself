using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Task_Management_System_API.Src.Domain.Entities
{
    public class RefreshToken
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public ApplicationUser User { get; set; } = null!;
        public string Token { get; set; } = string.Empty;
        public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset ExpiredAtUtc { get; set; }
        public DateTimeOffset? RevokedAtUtc { get; set; }
        public Guid TokenFamilyId { get; set; }
        public Guid TokenReplacedById { get; set; }
        public string? CreatedByIp { get; set; }
        public string? UserAgent { get; set; }
        public Boolean IsActive => RevokedAtUtc == null && DateTimeOffset.UtcNow < ExpiredAtUtc;
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}
