using FluentValidation;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.Validators.Task
{
    public class UpdateTaskValidator : AbstractValidator<UpdateTaskRequest>
    {
        public UpdateTaskValidator() 
        {
            RuleFor(T => T)
            .Must(t =>
                !string.IsNullOrWhiteSpace(t.Title) ||
                !string.IsNullOrWhiteSpace(t.Description) ||                
                !string.IsNullOrWhiteSpace(t.Priority) ||
                t.DueDate.HasValue
            )
            .WithMessage("At least one field : Title, DueDate, Priority or Description,  must be provided to update.");

            When(t => t.Status != null, () => RuleFor(T => T.Status).IsEnumName(typeof(TaskItemStatus), false).WithMessage("Invalid status..."));

            RuleFor(T => T.Title).MaximumLength(256).WithMessage("Title field should have length of maximum 256");
            RuleFor(T => T.Description).MaximumLength(1024).WithMessage("Description field should have length of maximum 1024");
        }
    }
}
