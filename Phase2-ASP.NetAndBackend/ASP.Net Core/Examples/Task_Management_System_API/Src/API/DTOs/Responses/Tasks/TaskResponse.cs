using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.API.DTOs.Responses.Tasks
{
    public class TaskResponse
    {
        public Guid? Id { get; set; }
        public Guid? ProjectId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public string? priority { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        
    }
}
