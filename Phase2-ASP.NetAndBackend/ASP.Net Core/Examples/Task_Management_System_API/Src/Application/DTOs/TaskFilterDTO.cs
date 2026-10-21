using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.DTOs
{
    public class TaskFilterDTO
    {
        public TaskItemStatus? Status { get; set; }
        public TaskPriority? Priority { get; set; }
        public DateOnly? DueDate { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }
}
