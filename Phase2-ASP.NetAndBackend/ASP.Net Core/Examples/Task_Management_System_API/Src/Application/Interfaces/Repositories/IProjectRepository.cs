using Microsoft.Identity.Client;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Interfaces.Repositories
{
    public interface IProjectRepository 
    {
        public Task<Projects?> GetprojectById(Guid id, CancellationToken ct);
        public Task<Projects?> GetprojectByName(string name,Guid userId, CancellationToken ct);
        public Task<Boolean> Deleteproject(Guid id, CancellationToken ct);
        public Task<Boolean> Updateproject(Projects Obj, CancellationToken ct);
        public Task<Boolean> Addproject(Projects Obj, CancellationToken ct);
        public Task<PaginationResult<Projects>?> GetprojectsPageAsync(int page, Guid userId, CancellationToken ct, int pageSize = 1024);
        public Task<List<Tasks>?> GetTasksForProject(Guid id, CancellationToken ct);
    }
}
