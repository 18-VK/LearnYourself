namespace TaskManagementApi.Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    // Never store the raw token - only a SHA-256 hash of it, same principle as passwords
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAtUtc { get; set; }

    // All tokens descended from one original login share a TokenFamilyId.
    // If a revoked/replaced token is ever presented again, it signals theft,
    // and the whole family gets revoked - not just the one token.
    public Guid TokenFamilyId { get; set; }
    public Guid? ReplacedByTokenId { get; set; }

    public string? CreatedByIp { get; set; }
    public string? UserAgent { get; set; }

    public bool IsActive => RevokedAtUtc is null && DateTime.UtcNow < ExpiresAtUtc;
}
