namespace Task_Management_System_API.Src.API.DTOs.Requests.Auth
{
    public record LoginUserRequest(string Email, string Password);
    public record RegisterUserRequest(string FirstName, string LastName, string Email, string Password);
    public record RefreshTokenRequest(string RefreshToken);
}
