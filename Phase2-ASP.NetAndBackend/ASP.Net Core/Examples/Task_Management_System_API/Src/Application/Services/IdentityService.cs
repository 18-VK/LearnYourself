using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Task_Management_System_API.Src.API.DTOs.Requests.Auth;
using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;
using Task_Management_System_API.Src.Infrastructure.Repositories;

namespace Task_Management_System_API.Src.Application.Services
{
    public class IdentityService : IIdentityService
    {
        private readonly ILogger<IdentityService> _logger;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITokenService _tokenService;
        private readonly ICurrentUser _currentUser;
        private readonly IrefreshTokenRepository _refreshTokenRepository;

        public IdentityService(ILogger<IdentityService> logger, UserManager<ApplicationUser> userManager, ITokenService tokenService,
                                ICurrentUser currentUser, IrefreshTokenRepository refreshTokenRepository)
        {
            _logger = logger;
            _userManager = userManager;
            _tokenService = tokenService;
            _currentUser = currentUser;
            _refreshTokenRepository = refreshTokenRepository;
        }
        public async Task<AuthResult> LoginUserAsync(LoginUserRequest loginRequest, CancellationToken ct)
        {
            try
            {
                // check if user exists
                var exists =await _userManager.FindByEmailAsync(loginRequest.Email);
                if (exists == null)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "Invalid login request." } };
                }
                // check password 
                var ret = await _userManager.CheckPasswordAsync(exists, loginRequest.Password);

                if (!ret)
                {
                    // increment access failed count
                    await _userManager.AccessFailedAsync(exists);
                    return new AuthResult { Succeeded = false, Errors = new[] { "Invalid email or password." } };
                }

                // check if user is locked out
                ret = await _userManager.IsLockedOutAsync(exists);

                if (ret)
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "User is locked out." } };

                if(!exists.IsActive)
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "User is not active." } };
                

                return await IssueTokenAsync(exists, ct);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "LoginUserAsync failed");
                return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to login with the provided details." } };
            }
        }

        public async Task<AuthResult> RefreshTokenAsync(string refreshToken, CancellationToken ct)
        {
            try
            {
                // check if refresh token exists in the database
                var exists =  await _refreshTokenRepository.GetRefreshToken(refreshToken, ct, true);

                // check if refresh token is expired

                if (exists == null || exists.ExpiredAtUtc < DateTimeOffset.UtcNow)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "Invalid refresh token." } };
                }

                // check if refresh token is revoked
                if(exists.RevokedAtUtc != null)
                {
                    // revoke all refresh tokens in the same family
                    await _refreshTokenRepository.RevokeRefreshTokenByUserId(exists.TokenFamilyId, ct);
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "Refresh token is revoked." } };
                }

                if (exists.User.Id != _currentUser.userId)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "You are not authorized to get refresh token this user." } };
                }

                return await IssueTokenAsync(exists.User, ct, exists.TokenFamilyId);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "");
                return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to refresh token." } };
            }
        }

        public async Task<AuthResult> RegisterUserAsync(RegisterUserRequest registerRequest, CancellationToken ct)
        {
            try
            {
                // create user 

                var exist = await _userManager.FindByEmailAsync(registerRequest.Email);
                if (exist != null)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to register with the provided details." } };
                }
                var user = new ApplicationUser
                {
                    FirstName = registerRequest.FirstName,
                    LastName = registerRequest.LastName,
                    Email = registerRequest.Email,
                    UserName = registerRequest.Email
                };

                var ret = await _userManager.CreateAsync(user, registerRequest.Password);

                if (!ret.Succeeded)
                {
                    return new AuthResult { Succeeded = false, Errors = ret.Errors.Select(e => e.Description) };
                }

                // add user to role
                ret = await _userManager.AddToRoleAsync(user, IdentityConstants.UserRole);
                if (!ret.Succeeded)
                {
                    return new AuthResult { Succeeded = false, Errors = ret.Errors.Select(e => e.Description) };
                }
                return await IssueTokenAsync(user, ct);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "");
                return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to register with the provided details." } };
            }

        }
        public async Task<AuthResult> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct)
        {
            try
            {
                // get the refresh token from the database
                var ret = await _refreshTokenRepository.GetRefreshToken(refreshToken, ct, true);

                if(ret is null)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "Invalid Refresh token" } };
                }
                if (ret.User.Id != _currentUser.userId)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "You are not authorized to revoke this user." } };
                }
                // revoke the token (single-session logout)
                ret.RevokedAtUtc = DateTime.UtcNow;
                
                if(await _refreshTokenRepository.UpdateRefreshToken(ret, ct))
                {
                    return new AuthResult
                    {
                        Succeeded = true,
                    };
                }
                
                return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to revoke refresh token." } };

            }

            catch (Exception ex)
            {
                _logger.LogError(ex, "RevokeRefreshTokenAsync failed.");
                return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to revoke refresh token." } };
            }

        }

        public async Task<AuthResult> IssueTokenAsync(ApplicationUser user, CancellationToken ct, Guid tokenFamilyId = default)
        {
            try
            {
                // ensure we have a family id
                if (tokenFamilyId == Guid.Empty)
                    tokenFamilyId = Guid.NewGuid();

                // get list of user roles
                ICollection<string> roles = await _userManager.GetRolesAsync(user);
                var result = _tokenService.GenerateTokens(user, roles);

                // update the refresh token in the database
                var refreshToken = new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    ExpiredAtUtc = result.RefreshTokenExpiredAtUtc,
                    Token = result.RefreshToken,
                    TokenFamilyId = tokenFamilyId
                };
                // Call to update the refresh token in the database
                var ret =  await _refreshTokenRepository.AddRefreshToken(refreshToken, ct);

                if (!ret)
                {
                    return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to issue token." } };
                }
                return new AuthResult
                {
                    Succeeded = true,
                    AccessToken = result.AccessToken,
                    RefreshToken = result.RefreshToken,
                    AccessTokenExpiredAtUtc = result.AccessTokenExpiredAtUtc
                };

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "IssueTokenAsync failed.");
                return new AuthResult { Succeeded = false, Errors = new List<string> { "Unable to issue token." } };
            }
        }


    }
    public static class IdentityConstants
    {
        public const string AdminRole = "Admin";
        public const string UserRole = "User";
        public const string ModeratorRole = "Moderator";
    }

    public static class IdentitySeeder
    {
        public static async Task<bool> SeedRolesAndAdminAsync(IServiceProvider serviceProvider, IConfiguration config)
        {
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            

            // Seed roles
            string[] roles = { IdentityConstants.AdminRole, IdentityConstants.UserRole, IdentityConstants.ModeratorRole };

            foreach (var role in roles)
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    var ret = await roleManager.CreateAsync(new IdentityRole<Guid>(role));
                    if(!ret.Succeeded)
                    {
                        throw new Exception(ret.Errors.ToString());
                    }
                }
            }

            // Seed admin user
            var adminEmail = config["AdminSettings:Email"]!;
            var adminUser = await userManager.FindByEmailAsync(adminEmail);
            var adminPassword = Environment.GetEnvironmentVariable("TASK_MNG_ADMIN_PWD");

            if (adminPassword == null)
                throw new InvalidOperationException("Admin password must be at least 12 characters long.");

            if (adminPassword.Length < 12)
                throw new InvalidOperationException("Admin password must be at least 12 characters long.");

            if (!adminPassword.Any(char.IsUpper) || !adminPassword.Any(char.IsDigit))
                throw new InvalidOperationException("Admin password must contain at least one uppercase letter and one digit.");


            if (adminUser == null)
            {
                adminUser = new ApplicationUser { UserName = config["AdminSettings:Username"], Email = adminEmail };
                var result = await userManager.CreateAsync(adminUser, adminPassword);
                if (!result.Succeeded)
                {
                    throw new Exception(result.Errors.ToString());
                }

                result = await userManager.AddToRoleAsync(adminUser, IdentityConstants.AdminRole);
                if (!result.Succeeded)
                {
                    throw new Exception(result.Errors.ToString());
                }
            }
            return true;
        }
    }


}
