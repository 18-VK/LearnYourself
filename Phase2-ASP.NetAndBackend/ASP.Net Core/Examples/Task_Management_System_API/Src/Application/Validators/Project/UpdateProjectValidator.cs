using FluentValidation;
using Task_Management_System_API.Src.API.DTOs.Requests.Projects;

namespace Task_Management_System_API.Src.Application.Validators.Project
{
    
    public class UpdateProjectValidator : AbstractValidator<UpdateProjectRequest>
    {
        public UpdateProjectValidator() 
        {

            RuleFor(P => P)
            .Must(P => !string.IsNullOrWhiteSpace(P.Name) || !string.IsNullOrWhiteSpace(P.Description) || P.DueDate != null)
            .WithMessage("Either Name, Due Date or Description must be provided.");

            RuleFor(P => P.Name).MaximumLength(256).WithMessage("Name field should have length of maximum 256");

            RuleFor(P => P.Description).MaximumLength(1024).WithMessage("Description field should have length of maximum 1024");

        }
    }
}
