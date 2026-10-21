using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Interfaces.Services
{
    public interface ITokenService
    {
        // Generate access token and refresh token for a given user
        public (string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiredAtUtc, DateTimeOffset RefreshTokenExpiredAtUtc) GenerateTokens(ApplicationUser user, ICollection<string> useRoles);
        public string GenerateRefreshToken();
        public string HashToken(string token);
    }
}