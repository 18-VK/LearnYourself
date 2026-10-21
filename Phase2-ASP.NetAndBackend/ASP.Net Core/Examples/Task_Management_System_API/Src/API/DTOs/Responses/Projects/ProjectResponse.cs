using Task_Management_System_API.Src.API.DTOs.Responses.Tasks;

namespace Task_Management_System_API.Src.API.DTOs.Responses
{
    public class ProjectResponse
    {
        public Guid? Id { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateTimeOffset? DueDate { get; set; }
    }
}
