using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.DTOs
{
    public class TaskDTO
    {
        public Guid? Id { get; set; }
        public Guid? ProjectId { get; set; }
        public string?Title { get; set; }
        public string? Description { get; set; }
        public TaskItemStatus? Status { get; set; }
        public TaskPriority? Priority { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public DateTimeOffset? CreatedAt { get; set; }
    }
}
