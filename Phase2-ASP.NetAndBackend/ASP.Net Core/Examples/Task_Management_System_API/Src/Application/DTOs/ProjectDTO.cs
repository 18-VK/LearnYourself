using Task_Management_System_API.Src.API.DTOs.Responses.Tasks;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.DTOs
{
    public class ProjectDTO
    {
        public Guid? Id { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public DateTimeOffset? CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public List<TaskDTO>? TaskItems { get; set; } = new List<TaskDTO>();
    }
}
