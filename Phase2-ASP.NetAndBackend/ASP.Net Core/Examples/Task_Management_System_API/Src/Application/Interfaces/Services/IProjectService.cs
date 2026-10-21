using Task_Management_System_API.Src.API.DTOs.Requests.Projects;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Domain.Common;

namespace Task_Management_System_API.Src.Application.Interfaces.Services
{
    public interface IProjectService
    {
        // Get By ID 
        public Task<Result<ProjectDTO>> GetProjectById(Guid ProjectId, CancellationToken ct);
        // Get tasks by project id 
        public Task<Result<List<TaskDTO>>> GetTasksByProjectId(Guid ProjectId, CancellationToken ct);
        // Delete By ID
        public Task<Result<ProjectDTO>> DeleteProjectById(Guid ProjectId, CancellationToken ct);
        // create Project
        public Task<Result<ProjectDTO>> CreateProject(ProjectDTO ObjProject, CancellationToken ct);
        // Update 
        public Task<Result<ProjectDTO>> UpdateProject(UpdateProjectDTO ObjProject, Guid Id, CancellationToken ct);
        // GetTask by pagenum 
        public Task<Result<PaginationResult<ProjectDTO>>> GetProjectListByPage(int PageIndex, int PageSize, CancellationToken ct);
    }
}
