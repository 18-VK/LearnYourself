namespace Task_Management_System_API.Src.Domain.Common
{
    public class AuthResult
    {
        public bool Succeeded { get; set; }
        public string? AccessToken { get; set; }
        public string? RefreshToken { get; set; }
        public DateTimeOffset? AccessTokenExpiredAtUtc { get; set; }
        public IEnumerable<string>? Errors { get; set; }
        
    }
}
