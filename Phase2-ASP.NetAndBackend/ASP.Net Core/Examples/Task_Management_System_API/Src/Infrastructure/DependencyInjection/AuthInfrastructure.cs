using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Application.Services;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;

namespace Task_Management_System_API.Src.Infrastructure.DependencyInjection 
{
    public static class AuthInfrastructure
    {
        public static IServiceCollection AddAuthInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            // Add authentication and authorization services here
            // For example, you can add JWT authentication, Identity, etc.

            // Jwtsettings
            services.Configure<JwtSettings>(configuration.GetSection("jwt"));
            var jwtSettings = configuration.GetSection("jwt").Get<JwtSettings>()!;

            
            services
               .AddIdentityCore<ApplicationUser>(options =>
               {
                   options.Password.RequiredLength = 8;
                   options.Password.RequireUppercase = true;
                   options.Password.RequireNonAlphanumeric = true;
                   options.Lockout.MaxFailedAccessAttempts = 5;
                   options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                   options.User.RequireUniqueEmail = true;
               })
               .AddRoles<IdentityRole<Guid>>()
               .AddEntityFrameworkStores<AppDbContext>()
               .AddDefaultTokenProviders();

                services.AddScoped<IIdentityService, IdentityService>();
                services.AddScoped<ITokenService, TokenService>();
                services.AddHttpContextAccessor();
                services.AddScoped<ICurrentUser, CurrentUserService>();

            // get public key from file

            var publicKey = RSA.Create();
            publicKey.ImportFromPem(File.ReadAllText(jwtSettings.PublicKeyPath));

            // jwt 
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtSettings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtSettings.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new RsaSecurityKey(publicKey),
                    NameClaimType = ClaimTypes.NameIdentifier,
                    RoleClaimType = ClaimTypes.Role
                };
            });

            services.AddAuthorization(options =>  
                    options.FallbackPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build());

            return services;
        }
    }
}
