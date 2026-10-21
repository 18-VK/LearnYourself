using FluentValidation;
using Microsoft.Identity.Client;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.Validators.Task
{
    public class TaskFilterValidator : AbstractValidator<TaskFilterRequest>
    {
        public TaskFilterValidator()
        {
            // Task Priority 
            When(T => T.Priority != null, () => RuleFor(T => T.Priority).IsEnumName(typeof(TaskPriority), false).WithMessage("Invalid priority. Allowed values are: Low, Medium, High"));

            When(T => T.Status != null, () =>  RuleFor(T => T.Status).IsEnumName(typeof(TaskItemStatus), caseSensitive: false)
                                .WithMessage("Invalid status. Allowed values are: Todo, InProgress, Done"));
        }
    }
}
