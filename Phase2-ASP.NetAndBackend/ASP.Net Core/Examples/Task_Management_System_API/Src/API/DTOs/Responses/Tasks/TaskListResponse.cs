namespace Task_Management_System_API.Src.API.DTOs.Responses.Tasks
{
    public class TaskListResponse
    {
        public IEnumerable<TaskResponse>? Tasks { get; set; }
        public int Page { get; set; }

        public int PageSize { get; set; }

        public int TotalCount { get; set; }

        public int TotalPages { get; set; }
    }
}
