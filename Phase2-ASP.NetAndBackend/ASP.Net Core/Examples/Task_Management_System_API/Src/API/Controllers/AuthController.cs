using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Task_Management_System_API.Src.API.DTOs.Requests.Auth;
using Task_Management_System_API.Src.API.DTOs.Responses.Auth;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Domain.Common;

namespace Task_Management_System_API.Src.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IIdentityService _identityService;

        private readonly IMapper _mapper;
        public AuthController(IIdentityService identityService, IMapper mapper)
        {
            _identityService = identityService;
            _mapper = mapper;
        }
        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterUserRequest request, CancellationToken ct)
        {
            var result = await _identityService.RegisterUserAsync(request, ct);
            if (!result.Succeeded)
            {
                return BadRequest(new { errors = result.Errors });
            }
            var response = _mapper.Map<AuthResponse>(result);
            return Ok(response);
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginUserRequest request, CancellationToken ct)
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var result = await _identityService.LoginUserAsync(request, ct);
            if (!result.Succeeded)
            {
                // Same generic status/shape whether the email didn't exist, the password
                // was wrong, or the account is locked - don't help an attacker enumerate
                return Unauthorized(new { errors = result.Errors });
            }
            var response = _mapper.Map<AuthResponse>(result);
            return Ok(response);
        }

        [HttpPost("refresh")]
        [Authorize]
        public async Task<IActionResult> Refresh(RefreshTokenRequest request, CancellationToken ct)
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var result = await _identityService.RefreshTokenAsync(request.RefreshToken, ct);
            if (!result.Succeeded)
            {
                return Unauthorized(new { errors = result.Errors });
            }
            var response = _mapper.Map<AuthResponse>(result);
            return Ok(response);
        }

        [HttpPost("revoke")]
        [Authorize]
        public async Task<IActionResult> Revoke(RefreshTokenRequest request, CancellationToken ct)
        {
            var result = await _identityService.RevokeRefreshTokenAsync(request.RefreshToken, ct);
            return result.Succeeded ? NoContent() : NotFound();
        }
    }
}
