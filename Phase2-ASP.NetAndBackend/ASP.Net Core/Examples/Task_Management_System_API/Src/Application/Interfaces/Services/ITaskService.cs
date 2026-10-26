using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Domain.Common;

namespace Task_Management_System_API.Src.Application.Interfaces.Services
{
    public interface ITaskService
    {
        // Get By ID 
        public Task<Result<TaskDTO>> GetTaskById(Guid taskId, CancellationToken ct);
        // Get By ID 
        public Task<Result<ProjectDTO>> GetProjectByTaskId(Guid taskId, CancellationToken ct);
        // Delete By ID
        public Task<Result<TaskDTO>> DeleteTaskById(Guid TaskId, CancellationToken ct);
        // create task
        public Task<Result<TaskDTO>> CreateTask(TaskDTO ObjTask, CancellationToken ct);
        // Update 
        public Task<Result<TaskDTO>> UpdateTask(UpdateTaskDTO ObjTask, Guid Id, CancellationToken ct);
        // UpdateStatus
        public Task<Result<TaskDTO>> UpdateTaskStatus(UpdateTaskStatusDTO ObjTask, Guid Id, CancellationToken ct);
        // GetTask by pagenum 
        public Task<Result<List<TaskDTO>>> GetTasksListByPage(int PageIndex, int PageSize, CancellationToken ct);
        public Task<Result<PaginationResult<TaskDTO>>> ApplyFilter(TaskFilterDTO filter, CancellationToken ct);
    }
}
