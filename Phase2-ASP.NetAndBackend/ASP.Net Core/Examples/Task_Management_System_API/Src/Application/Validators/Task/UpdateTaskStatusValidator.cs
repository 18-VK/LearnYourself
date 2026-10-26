using FluentValidation;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.Validators.Task
{
    public class UpdateTaskStatusValidator : AbstractValidator<UpdateTaskStatusRequest>
    {
        public UpdateTaskStatusValidator() 
        {
            RuleFor(T => T.Status).IsEnumName(typeof(TaskItemStatus), caseSensitive: false)
                                .WithMessage("Invalid status. Allowed values are: Todo, InProgress, Done");
        }
    }
}
