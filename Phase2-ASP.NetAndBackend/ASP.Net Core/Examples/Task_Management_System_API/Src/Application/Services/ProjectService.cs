using AutoMapper;
using Task_Management_System_API.Src.API.DTOs.Requests.Projects;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Services
{
    public class ProjectService : IProjectService
    {
        private IProjectRepository _projectRepo;
        private ILogger<ProjectService> _logger;
        private IMapper _mapper;
        private ICurrentUser _currentUser;
        public ProjectService(IProjectRepository projectRepo, ILogger<ProjectService> logger, IMapper mapper, ICurrentUser currentUser  )
        {
            _projectRepo = projectRepo;
            _logger = logger;
            _mapper = mapper;
            _currentUser = currentUser;
        }

        public async Task<Result<ProjectDTO>> CreateProject(ProjectDTO ObjProject, CancellationToken ct)
        {
            try
            {
                // Add logic to check if product is already exits, search in db using name
                ObjProject.Name = ObjProject.Name?.Trim();
                var existing = await _projectRepo.GetprojectByName(ObjProject.Name ?? "", _currentUser.userId ?? default, ct);
                if (existing != null)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        Error = "A project with this name already exists",
                        StatusCode = 409
                    };
                }

                // Entity to DTO 
                var entity = _mapper.Map<Projects>(ObjProject);
                
                entity.UpdatedAt = DateTimeOffset.UtcNow;
                entity.Userid = _currentUser.userId ?? default;
                // call to add 
                var added = await _projectRepo.Addproject(entity, ct);

                if (!added)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        StatusCode = 500,
                        Error = "Unexpected error while adding project."
                    };
                }

                // Map back to DTO
                var resultDto = _mapper.Map<ProjectDTO>(entity);

                return new Result<ProjectDTO>
                {
                    IsSuccess = true,
                    StatusCode = 201,
                    Value = resultDto
                };
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateProject failed");
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };
            }

        }

        public async Task<Result<ProjectDTO>> DeleteProjectById(Guid ProjectId, CancellationToken ct)
        {

            try
            {
                var result = await _projectRepo.GetprojectById(ProjectId, ct);

                if (result is null)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        Error = $"A project with this id {ProjectId} not found",
                        StatusCode = 404
                    };
                }
               
                if(await _projectRepo.Deleteproject(ProjectId, ct))
                {
                    // map 
                    //var Obj = _mapper.Map<ProjectDTO>(result);

                    return new Result<ProjectDTO>
                    {
                        IsSuccess = true,
                        //Value = Obj,
                        StatusCode = 204
                    };
                }
                else
                {
                    
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        StatusCode = 500,
                        Error = "Unexpected error while deleting project."
                    };
                    
                }
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeleteProjectById failed");
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }

        }

        public async Task<Result<ProjectDTO>> GetProjectById(Guid ProjectId, CancellationToken ct)
        {

            try
            {
                var result = await _projectRepo.GetprojectById(ProjectId, ct);

                if (result is null)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        Error = $"Project with id {ProjectId} not found",
                        StatusCode = 404
                    };
                }
                // map 
                var Obj = _mapper.Map<ProjectDTO>(result);

                return new Result<ProjectDTO>
                {
                    IsSuccess = true,
                    Value = Obj,
                    StatusCode = 200
                };
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetProjectById failed");
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<PaginationResult<ProjectDTO>>> GetProjectListByPage(int pageIndex, int pageSize, CancellationToken ct)
        {
            if (pageIndex <= 0) pageIndex = 1;

            try
            {
                var result = await _projectRepo.GetprojectsPageAsync(pageIndex, _currentUser.userId ?? default, ct, pageSize);

                // Always return a list, even if empty
                var list = _mapper.Map<PaginationResult<ProjectDTO>>(result ?? new PaginationResult<Projects>());

                return new Result<PaginationResult<ProjectDTO>>
                {
                    IsSuccess = true,
                    Value = list,
                    StatusCode = 200 // OK
                };
            }
            catch (OperationCanceledException)
            {
                return new Result<PaginationResult<ProjectDTO>>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408
                };
            }
            catch (Exception ex)
            {

                _logger.LogError(ex, "GetProjectListByPage failed");
                return new Result<PaginationResult<ProjectDTO>>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<List<TaskDTO>>> GetTasksByProjectId(Guid ProjectId, CancellationToken ct)
        {
            // get task for project 
            try
            {

                var project = await _projectRepo.GetprojectById(ProjectId, ct);

                if (project is null)
                {
                    return new Result<List<TaskDTO>>
                    {
                        IsSuccess = false,
                        Error = "Project not found",
                        StatusCode = 404 
                    };
                }
                var result = await _projectRepo.GetTasksForProject(ProjectId, ct);


                // Always return a list, even if empty
                var list = _mapper.Map<List<TaskDTO>>(result ?? new List<Tasks>());

                return new Result<List<TaskDTO>>
                {
                    IsSuccess = true,
                    Value = list,
                    StatusCode = 200 // OK
                };
            }
            catch (OperationCanceledException)
            {
                return new Result<List<TaskDTO>>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTasksByProjectId failed");
                return new Result<List<TaskDTO>>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };
            }
        }

        public async Task<Result<ProjectDTO>> UpdateProject(UpdateProjectDTO objProject, Guid id, CancellationToken ct)
        {
            try
            {
                var entity = await _projectRepo.GetprojectById(id, ct);

                if (entity is null)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        Error = $"Project with id {id} not found",
                        StatusCode = 404
                    };
                }
                
                // Merge changes from DTO into existing entity
                // Merge only non-null values

                _mapper.Map(objProject, entity);
                entity.UpdatedAt = DateTimeOffset.UtcNow;

                // Persist changes

                var updated = await _projectRepo.Updateproject(entity, ct);
                if (!updated)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        StatusCode = 500,
                        Error = "unexpected error while updating.."
                    };
                }
                // map to response 
                var dto = _mapper.Map<ProjectDTO>(entity);

                return new Result<ProjectDTO>
                {
                    IsSuccess = true,
                    Value = dto,
                    StatusCode = 200 // OK with updated object
                };
            }
            catch (OperationCanceledException)
            {
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateProject failed");
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };
            }
        }
    }
}
