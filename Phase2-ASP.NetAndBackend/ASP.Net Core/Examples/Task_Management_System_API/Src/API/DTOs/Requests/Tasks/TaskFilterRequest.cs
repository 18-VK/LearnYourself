using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.API.DTOs.Requests.Tasks
{
    public class TaskFilterRequest
    {
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public DateOnly? DueDate { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }
}
