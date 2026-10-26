using Microsoft.AspNetCore.Identity.Data;
using Task_Management_System_API.Src.API.DTOs.Requests.Auth;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Domain.Common;

namespace Task_Management_System_API.Src.Application.Interfaces.Services
{
    public interface IIdentityService
    {
        Task<AuthResult> LoginUserAsync(LoginUserRequest loginRequest, CancellationToken ct);
        Task<AuthResult> RegisterUserAsync(RegisterUserRequest registerRequest, CancellationToken ct);
        Task<AuthResult> RefreshTokenAsync(string refreshToken, CancellationToken ct);
        Task<AuthResult> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct);
    }
}
