using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Reflection.Metadata;
using System.Security.Claims;
using System.Security.Cryptography;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Services
{
    public class TokenService : ITokenService
    {
        private readonly RSA _privatekey; 
        private JwtSettings _jwtsettings;
        public TokenService(IOptions<JwtSettings> jwtsettings)
        {
            _privatekey = RSA.Create();
            _jwtsettings = jwtsettings.Value;
            _privatekey.ImportFromPem(File.ReadAllText(_jwtsettings.PrivateKeyPath));
        }
        public string GenerateRefreshToken()
        {
            var rawBytes = RandomNumberGenerator.GetBytes(64);
            var rawToken = Convert.ToBase64String(rawBytes);

            return HashToken(rawToken);
        }

        public (string AccessToken,string RefreshToken, DateTimeOffset AccessTokenExpiredAtUtc, DateTimeOffset RefreshTokenExpiredAtUtc) GenerateTokens(ApplicationUser user, ICollection<string> useRoles)
        {
            // Implement the logic to generate access and refresh tokens for the given user
            // Get claim 
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Name, user.UserName ?? string.Empty),
                new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString())
            };

            
            // add roles, will see how to add roles later
                
            var signingCredentials = new SigningCredentials(new RsaSecurityKey(_privatekey), SecurityAlgorithms.RsaSha256);

            var JWTToken = new JwtSecurityToken(
                issuer: _jwtsettings.Issuer,
                audience: _jwtsettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtsettings.AccessTokenExpiryMinutes),
                signingCredentials: signingCredentials
            );

            var exp = DateTimeOffset.UtcNow.AddMinutes(_jwtsettings.AccessTokenExpiryMinutes);
            var accessToken = new JwtSecurityTokenHandler().WriteToken(JWTToken);
            var refreshToken = GenerateRefreshToken();
            var RefrehTokenExp = DateTimeOffset.UtcNow.AddDays(_jwtsettings.RefreshTokenExpiryDays);

            return (accessToken, refreshToken, exp, RefrehTokenExp);
        }


        public string HashToken(string token)
        {
            var sha256 = SHA256.Create();
            return Convert.ToBase64String(sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token)));
        }
    }
}
