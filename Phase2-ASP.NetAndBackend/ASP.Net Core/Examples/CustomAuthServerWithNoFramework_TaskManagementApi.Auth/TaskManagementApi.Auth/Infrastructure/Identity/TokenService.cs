using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TaskManagementApi.Application.Auth.Interfaces;
using TaskManagementApi.Domain.Entities;

namespace TaskManagementApi.Infrastructure.Identity;

public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;
    private readonly RSA _privateKey;

    public TokenService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
        _privateKey = RSA.Create();
        _privateKey.ImportFromPem(File.ReadAllText(_settings.PrivateKeyPath));
    }

    public string GenerateAccessToken(ApplicationUser user, IList<string> roles)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Iat,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64),
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var signingCredentials = new SigningCredentials(
            new RsaSecurityKey(_privateKey), SecurityAlgorithms.RsaSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpiryMinutes),
            signingCredentials: signingCredentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string RawToken, RefreshToken Entity) GenerateRefreshToken(
        Guid userId, Guid tokenFamilyId, string? ipAddress, string? userAgent)
    {
        var rawBytes = RandomNumberGenerator.GetBytes(64);
        var rawToken = Convert.ToBase64String(rawBytes);

        var entity = new RefreshToken
        {
            UserId = userId,
            TokenHash = HashToken(rawToken),
            TokenFamilyId = tokenFamilyId,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_settings.RefreshTokenExpiryDays),
            CreatedByIp = ipAddress,
            UserAgent = userAgent,
        };

        return (rawToken, entity);
    }

    public string HashToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToBase64String(bytes);
    }
}
