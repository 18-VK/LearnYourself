namespace Task_Management_System_API.Src.API.DTOs.Requests.Projects
{
    public class UpdateProjectRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateOnly? DueDate { get; set; }
    }
}
