using TaskManagementApi.Application.Auth.DTOs;

namespace TaskManagementApi.Application.Auth.Interfaces;

public interface IIdentityService
{
    Task<AuthResult> RegisterAsync(RegisterRequest request);
    Task<AuthResult> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent);
    Task<AuthResult> RefreshTokenAsync(string refreshToken, string? ipAddress, string? userAgent);
    Task<bool> RevokeTokenAsync(string refreshToken);
    Task RevokeAllTokensForUserAsync(Guid userId);
}

public class AuthResult
{
    public bool Succeeded { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? AccessTokenExpiresAtUtc { get; set; }
    public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();
}
