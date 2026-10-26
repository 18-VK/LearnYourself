using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.API.DTOs.Requests.Tasks
{
    public class CreateTaskRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public Guid? ProjectId { get; set; }
        public DateOnly DueDate { get; set; }
        public string? Priority { get; set; }
    }
}
