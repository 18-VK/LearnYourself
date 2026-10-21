using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Interfaces.Repositories
{
    public interface ITaskRepository
    {
        public Task<Tasks?> GettaskById(Guid id, CancellationToken ct);
        public Task<Tasks?> GetTaskByName(string name, Guid userId, CancellationToken ct);
        public Task<Projects?> GetProjectByTaskId(Guid id, CancellationToken ct);
        public Task<Boolean> Deletetask(Guid id, CancellationToken ct);
        public Task<Boolean> Updatetask(Tasks Obj, CancellationToken ct);
        public Task<Boolean> Addtask(Tasks Obj, CancellationToken ct);
        public Task<List<Tasks>?> GetTasksPageAsync(int page, CancellationToken ct, int pageSize = 1024);
        public Task<PaginationResult<Tasks>?> ApplyFilterAsync(TaskFilterDTO filter, Guid userId, CancellationToken ct);
    }
}
