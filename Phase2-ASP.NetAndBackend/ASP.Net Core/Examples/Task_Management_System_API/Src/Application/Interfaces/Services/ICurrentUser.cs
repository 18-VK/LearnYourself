using System.Security.Claims;

namespace Task_Management_System_API.Src.Application.Interfaces.Services
{
    public interface ICurrentUser
    {
        public Guid? userId { get;}
        public string? Email { get; }
        public bool isAuthenticated { get; }
        public bool isInRole(string role);
        public ICollection<Claim> GetClaimsIdentity();
        
    }
}
