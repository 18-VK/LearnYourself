using FluentValidation;
using Microsoft.AspNetCore.Identity.Data;
using Task_Management_System_API.Src.API.DTOs.Requests.Auth;

namespace Task_Management_System_API.Src.Application.Validators.Auth
{
    public class LoginValidator : AbstractValidator<LoginUserRequest>
    {
        public LoginValidator()
        {
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("Email is required.")
                .EmailAddress().WithMessage("Invalid email format.");

            RuleFor(x => x.Password)
               .NotEmpty()
               .WithMessage("Password is required.");               
        }
    }

    public class RegisterValidator : AbstractValidator<RegisterUserRequest>
    {
        public RegisterValidator()
        {
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("Email is required.")
                .EmailAddress().WithMessage("Invalid email format.");

            RuleFor(x => x.Password)
               .NotEmpty()
               .MinimumLength(8)
               .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
               .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter.")
               .Matches("[0-9]").WithMessage("Password must contain at least one digit.")
               .Matches("[^a-zA-Z0-9]").WithMessage("Password must contain at least one special character.");

            RuleFor(x => x.FirstName)
                .NotEmpty().WithMessage("First name is required.").MaximumLength(100);

            RuleFor(x => x.LastName)
                .NotEmpty().WithMessage("Last name is required.").MaximumLength(100);
        }
    }
    public class RefreshTokenValidator : AbstractValidator<RefreshTokenRequest>
    {
        public RefreshTokenValidator()
        {
            RuleFor(x => x.RefreshToken)
                .NotEmpty().WithMessage("Refresh token is required.")
                .MaximumLength(256);
        }
    }
}
