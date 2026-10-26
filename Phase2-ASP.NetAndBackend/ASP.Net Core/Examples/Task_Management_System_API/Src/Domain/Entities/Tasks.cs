using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Domain.Entities
{
    public class Tasks
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public Projects? Project { get; set; }
        public string Title { get; set; } = String.Empty;
        public Guid Userid { get; set; }
        public string Description { get; set; } = String.Empty;
        public TaskItemStatus Status { get; set; }
        public TaskPriority Priority { get; set; }
        public DateTimeOffset DueDate { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set;}
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}
