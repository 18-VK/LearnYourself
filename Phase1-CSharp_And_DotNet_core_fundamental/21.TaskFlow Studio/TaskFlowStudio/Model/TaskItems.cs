using System;

namespace TaskFlowStudio.Model
{
    public class TaskItem
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }

        public Project Project { get; set; } = null!;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public int Status { get; set; }
        public int Priority { get; set; }

        public DateTime DueDate { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
