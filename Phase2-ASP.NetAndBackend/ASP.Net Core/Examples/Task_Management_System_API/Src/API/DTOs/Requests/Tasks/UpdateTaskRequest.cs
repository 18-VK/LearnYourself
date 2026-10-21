namespace Task_Management_System_API.Src.API.DTOs.Requests.Tasks
{
    public class UpdateTaskRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public DateTimeOffset? DueDate { get; set; }
    }
}
