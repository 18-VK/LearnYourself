using FluentValidation;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.Validators.Task
{
    public class CreateTaskValidator : AbstractValidator<CreateTaskRequest>
    {
        public CreateTaskValidator() 
        {
            //title 
            RuleFor(T => T.Title).NotEmpty().WithMessage("Title should be provided and cannot be empty");
            RuleFor(T => T.Title).MaximumLength(256).WithMessage("Title field should have length of maximum 256");

            // Project id 
            RuleFor(T => T.ProjectId).NotEmpty().WithMessage("ProjectId should be provided and cannot be empty");

            RuleFor(t => t.ProjectId)
                        .Must(id => id != Guid.Empty)
                        .WithMessage("ProjectId must be a valid non-empty GUID.");

            // Desctiption
            RuleFor(T => T.Description).NotEmpty().WithMessage("Description should be provided and cannot be empty");
            RuleFor(T => T.Description).MaximumLength(1024).WithMessage("Description field should have length of maximum 1024");

            // DueDate
            RuleFor(T => T.DueDate).GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date)).WithMessage("The Due Date must be in the future.");

            // Task Priority 
            RuleFor(T=> T.Priority).IsEnumName(typeof(TaskPriority), false).WithMessage("Invalid priority. Allowed values are: Low, Medium, High");
        }
    }
}
