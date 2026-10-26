using FluentValidation;
using Task_Management_System_API.Src.API.DTOs.Requests.Projects;

namespace Task_Management_System_API.Src.Application.Validators.Project
{
    public class CreateProjectValidator : AbstractValidator<CreateProjectRequest>
    {
        public CreateProjectValidator() 
        {
            //Name
            RuleFor(P => P.Name).NotEmpty().WithMessage("Name field should be provided and cannot be empty");
            RuleFor(P => P.Name).MaximumLength(256).WithMessage("Name field should have length of maximum 256");

            RuleFor(P => P.Description).MaximumLength(1024).WithMessage("Description field should have length of maximum 1024");

            // Description, optional here  
            // RuleFor(P => P.Name).NotNull().WithMessage("Descciption field should be provided");

            // DueDate
            RuleFor(p => p.DueDate).GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date)).WithMessage("The Due Date must be in the future.");
        }
    }
}
