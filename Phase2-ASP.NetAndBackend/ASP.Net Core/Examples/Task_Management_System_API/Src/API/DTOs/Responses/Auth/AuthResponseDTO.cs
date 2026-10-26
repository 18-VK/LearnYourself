namespace Task_Management_System_API.Src.API.DTOs.Responses.Auth
{
    public record AuthResponse(string AccessToken, string RefreshToken, DateTimeOffset ExpiredAtUtc);
}
