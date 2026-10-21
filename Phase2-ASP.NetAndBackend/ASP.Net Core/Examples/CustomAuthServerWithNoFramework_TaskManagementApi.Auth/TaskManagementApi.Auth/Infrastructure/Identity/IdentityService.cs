using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TaskManagementApi.Application.Auth.DTOs;
using TaskManagementApi.Application.Auth.Interfaces;
using TaskManagementApi.Domain.Entities;
using TaskManagementApi.Infrastructure.Persistence;

namespace TaskManagementApi.Infrastructure.Identity;

public class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly ITokenService _tokenService;
    private readonly JwtSettings _jwtSettings;

    public IdentityService(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext,
        ITokenService tokenService,
        IOptions<JwtSettings> jwtOptions)
    {
        _userManager = userManager;
        _dbContext = dbContext;
        _tokenService = tokenService;
        _jwtSettings = jwtOptions.Value;
    }

    public async Task<AuthResult> RegisterAsync(RegisterRequest request)
    {
        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
        {
            // Deliberately generic message - don't confirm whether the email is already taken
            return new AuthResult { Succeeded = false, Errors = new[] { "Unable to register with the provided details." } };
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return new AuthResult { Succeeded = false, Errors = result.Errors.Select(e => e.Description) };
        }

        await _userManager.AddToRoleAsync(user, "Member");

        return await IssueTokensAsync(user, ipAddress: null, userAgent: null);
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);

        // Run the password check even when the user is missing, so response timing
        // doesn't itself leak whether the account exists (a cheap mitigation, not perfect)
        var passwordValid = user is not null && await _userManager.CheckPasswordAsync(user, request.Password);

        if (user is null || !passwordValid)
        {
            if (user is not null)
            {
                await _userManager.AccessFailedAsync(user);
            }
            return new AuthResult { Succeeded = false, Errors = new[] { "Invalid email or password." } };
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            return new AuthResult { Succeeded = false, Errors = new[] { "Account temporarily locked due to multiple failed attempts." } };
        }

        if (!user.IsActive)
        {
            return new AuthResult { Succeeded = false, Errors = new[] { "Account is disabled." } };
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        return await IssueTokensAsync(user, ipAddress, userAgent);
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken, string? ipAddress, string? userAgent)
    {
        var hash = _tokenService.HashToken(refreshToken);

        var existing = await _dbContext.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash);

        if (existing is null)
        {
            return new AuthResult { Succeeded = false, Errors = new[] { "Invalid refresh token." } };
        }

        if (existing.RevokedAtUtc is not null)
        {
            // A revoked token was replayed - that's a theft signal. Kill the whole family,
            // forcing every device on this login chain to re-authenticate.
            await RevokeFamilyAsync(existing.TokenFamilyId);
            return new AuthResult { Succeeded = false, Errors = new[] { "Refresh token reuse detected; all sessions revoked." } };
        }

        if (DateTime.UtcNow >= existing.ExpiresAtUtc)
        {
            return new AuthResult { Succeeded = false, Errors = new[] { "Refresh token expired." } };
        }

        existing.RevokedAtUtc = DateTime.UtcNow;

        var (rawToken, newEntity) = _tokenService.GenerateRefreshToken(
            existing.UserId, existing.TokenFamilyId, ipAddress, userAgent);

        existing.ReplacedByTokenId = newEntity.Id;

        _dbContext.RefreshTokens.Add(newEntity);
        await _dbContext.SaveChangesAsync();

        var roles = await _userManager.GetRolesAsync(existing.User);
        var accessToken = _tokenService.GenerateAccessToken(existing.User, roles);

        return new AuthResult
        {
            Succeeded = true,
            AccessToken = accessToken,
            RefreshToken = rawToken,
            AccessTokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpiryMinutes),
        };
    }

    public async Task<bool> RevokeTokenAsync(string refreshToken)
    {
        var hash = _tokenService.HashToken(refreshToken);
        var existing = await _dbContext.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == hash);
        if (existing is null || existing.RevokedAtUtc is not null)
        {
            return false;
        }

        existing.RevokedAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task RevokeAllTokensForUserAsync(Guid userId)
    {
        var tokens = await _dbContext.RefreshTokens
            .Where(rt => rt.UserId == userId && rt.RevokedAtUtc == null)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.RevokedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task RevokeFamilyAsync(Guid tokenFamilyId)
    {
        var tokens = await _dbContext.RefreshTokens
            .Where(rt => rt.TokenFamilyId == tokenFamilyId && rt.RevokedAtUtc == null)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.RevokedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task<AuthResult> IssueTokensAsync(ApplicationUser user, string? ipAddress, string? userAgent)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);

        var tokenFamilyId = Guid.NewGuid();
        var (rawRefreshToken, refreshTokenEntity) = _tokenService.GenerateRefreshToken(
            user.Id, tokenFamilyId, ipAddress, userAgent);

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        await _dbContext.SaveChangesAsync();

        return new AuthResult
        {
            Succeeded = true,
            AccessToken = accessToken,
            RefreshToken = rawRefreshToken,
            AccessTokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpiryMinutes),
        };
    }
}
