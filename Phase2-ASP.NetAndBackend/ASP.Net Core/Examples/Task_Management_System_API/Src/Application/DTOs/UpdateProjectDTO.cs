namespace Task_Management_System_API.Src.Application.DTOs
{
    public class UpdateProjectDTO
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateTimeOffset? DueDate { get; set; }
    }
}
