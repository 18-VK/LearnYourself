using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Task_Management_System_API.Src.Application.Interfaces.Services;
namespace Task_Management_System_API.Src.Application.Services
{
    public class CurrentUserService : ICurrentUser
    {

        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }
        
        public ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;
        public Guid? userId {
            get
            {
                var value = User?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                    ?? User?.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User?.FindFirstValue("sub");

                return Guid.TryParse(value, out var id) ? id : null;
            }
        }

        public string? Email
        { 
            get => User?.FindFirstValue(ClaimTypes.Email);
        }
        public bool isAuthenticated { get => User?.Identity?.IsAuthenticated ?? false; }


        public ICollection<Claim> GetClaimsIdentity()
        {
            var claims = User?.Claims;
            return claims?.ToList() ?? new List<Claim>();
        }

        public bool isInRole(string role)
        {
            return User?.IsInRole(role) ?? false;
        }
    }


}
