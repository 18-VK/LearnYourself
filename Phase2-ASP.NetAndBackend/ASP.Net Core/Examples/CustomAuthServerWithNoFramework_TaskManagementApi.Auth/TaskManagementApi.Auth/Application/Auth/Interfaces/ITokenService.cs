using TaskManagementApi.Domain.Entities;

namespace TaskManagementApi.Application.Auth.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(ApplicationUser user, IList<string> roles);

    (string RawToken, RefreshToken Entity) GenerateRefreshToken(
        Guid userId, Guid tokenFamilyId, string? ipAddress, string? userAgent);

    string HashToken(string rawToken);
}
