namespace Task_Management_System_API.Src.Domain.Common
{
    public class JwtSettings
    {
        public const string SectionName = "Jwt";

        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public int AccessTokenExpiryMinutes { get; set; } = 15;
        public int RefreshTokenExpiryDays { get; set; } = 14;

        // PEM-encoded RSA key pair. Private key signs (auth server only),
        // public key validates (every resource server, including this API itself).
        public string PrivateKeyPath { get; set; } = string.Empty;
        public string PublicKeyPath { get; set; } = string.Empty;
    }
}
