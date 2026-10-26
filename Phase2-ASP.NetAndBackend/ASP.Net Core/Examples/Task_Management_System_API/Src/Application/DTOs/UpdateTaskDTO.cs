namespace Task_Management_System_API.Src.Application.DTOs
{
    public class UpdateTaskDTO
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public DateTimeOffset? DueDate { get; set; }
    }
}
