using Microsoft.AspNetCore.Identity;

namespace Task_Management_System_API.Src.Domain.Entities
{
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public DateTimeOffset CreationTimeUtc { get; set; } = DateTimeOffset.UtcNow;
        public Boolean IsActive { get; set; } = true;
        public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

        // No concurrency checking for ApplicationUser, as it is managed by Identity framework and we don't want to interfere with its internal mechanisms.
    }
}
