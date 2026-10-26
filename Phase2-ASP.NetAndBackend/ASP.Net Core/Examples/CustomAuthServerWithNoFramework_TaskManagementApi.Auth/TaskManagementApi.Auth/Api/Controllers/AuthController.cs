using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagementApi.Application.Auth.DTOs;
using TaskManagementApi.Application.Auth.Interfaces;

namespace TaskManagementApi.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IIdentityService _identityService;

    public AuthController(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var result = await _identityService.RegisterAsync(request);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors });
        }

        return Ok(ToAuthResponse(result));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _identityService.LoginAsync(request, ipAddress, userAgent);
        if (!result.Succeeded)
        {
            // Same generic status/shape whether the email didn't exist, the password
            // was wrong, or the account is locked - don't help an attacker enumerate
            return Unauthorized(new { errors = result.Errors });
        }

        return Ok(ToAuthResponse(result));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshTokenRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _identityService.RefreshTokenAsync(request.RefreshToken, ipAddress, userAgent);
        if (!result.Succeeded)
        {
            return Unauthorized(new { errors = result.Errors });
        }

        return Ok(ToAuthResponse(result));
    }

    [HttpPost("revoke")]
    [Authorize]
    public async Task<IActionResult> Revoke(RefreshTokenRequest request)
    {
        var revoked = await _identityService.RevokeTokenAsync(request.RefreshToken);
        return revoked ? NoContent() : NotFound();
    }

    private static AuthResponse ToAuthResponse(AuthResult result) =>
        new(result.AccessToken!, result.RefreshToken!, result.AccessTokenExpiresAtUtc!.Value);
}
