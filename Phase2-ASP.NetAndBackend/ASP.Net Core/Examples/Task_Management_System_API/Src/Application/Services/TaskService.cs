using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using AutoMapper;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Services
{
    public class TaskService : ITaskService
    {
        private ITaskRepository _taskRepo;
        private IProjectRepository _projectRepo;
        private ILogger<TaskService> _logger;
        private IMapper _mapper;
        private ICurrentUser _currentUser;
        public TaskService(ITaskRepository taskRepo, IProjectRepository projectRepo, ILogger<TaskService> logger, IMapper mapper, ICurrentUser currentUser)
        {
            _taskRepo = taskRepo;
            _logger = logger;
            _mapper = mapper;
            _projectRepo = projectRepo;
            _currentUser = currentUser;
        }

        public async Task<Result<PaginationResult<TaskDTO>>> ApplyFilter(TaskFilterDTO filter, CancellationToken ct)
        {

            try
            {
                var result = await _taskRepo.ApplyFilterAsync(filter, _currentUser.userId ?? default, ct);

                var list = _mapper.Map<PaginationResult<TaskDTO>>(result ?? new PaginationResult<Tasks>());

                return new Result<PaginationResult<TaskDTO>>
                {
                    IsSuccess = true,
                    Value = list,
                    StatusCode = 200
                };
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<PaginationResult<TaskDTO>>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ApplyFilter failed");
                return new Result<PaginationResult<TaskDTO>>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<TaskDTO>> CreateTask(TaskDTO ObjTask, CancellationToken ct)
        {
            // check if already exist 
            try
            {
                ObjTask.Title = ObjTask.Title?.Trim();
                var result = await _taskRepo.GetTaskByName(ObjTask.Title ?? "", _currentUser.userId ?? default,  ct);

                if (result != null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "A task with this name already exists",
                        StatusCode = 409
                    };
                }
                // check for project Id valid or not 
                var project = await _projectRepo.GetprojectById(ObjTask.ProjectId ?? default, ct);
                if (project == null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Invalid project id assigned for task",
                        StatusCode = 409
                    };
                }

                //map 
                var entity = _mapper.Map<Tasks>(ObjTask);
                entity.UpdatedAt = DateTimeOffset.UtcNow;
                entity.Userid = _currentUser.userId ?? default;

                var added = await _taskRepo.Addtask(entity, ct);

                if (!added)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Unexpected error while add task",
                        StatusCode = 500
                    };
                }
                else
                {
                    var dto = _mapper.Map<TaskDTO>(entity);

                    return new Result<TaskDTO>
                    {
                        IsSuccess = true,
                        StatusCode = 201,
                        Value = dto
                    };
                }

            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateTask failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<TaskDTO>> DeleteTaskById(Guid TaskId, CancellationToken ct)
        {

            try
            {

                var result = await _taskRepo.GettaskById(TaskId, ct);

                if (result is null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = $"A Task with this TaskId : {TaskId} does'nt exist",
                        StatusCode = 404
                    };
                }
                // map 
                
                if (await _taskRepo.Deletetask(TaskId, ct))
                {
                    var dto = _mapper.Map<TaskDTO>(result);

                    return new Result<TaskDTO>
                    {
                        IsSuccess = true,
                        StatusCode = 204,
                        Value = dto
                    };

                }
                else
                {

                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Unexpected error while deleting task",
                        StatusCode = 500
                    };
                }

            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeleteTaskById failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<ProjectDTO>> GetProjectByTaskId(Guid taskId, CancellationToken ct)
        {
            try
            {
                var result = await _taskRepo.GetProjectByTaskId(taskId, ct);
                if (result is null)
                {
                    return new Result<ProjectDTO>
                    {
                        IsSuccess = false,
                        Error = $"Task with id {taskId} not found",
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
                _logger.LogError(ex, "GetProjectByTaskId failed");
                return new Result<ProjectDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<TaskDTO>> GetTaskById(Guid taskId, CancellationToken ct)
        {
            try
            {
                var result = await _taskRepo.GettaskById(taskId, ct);
                if (result is null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = $"Task with id {taskId} not found",
                        StatusCode = 404
                    };
                }
                // map 
                var Obj = _mapper.Map<TaskDTO>(result);

                return new Result<TaskDTO>
                {
                    IsSuccess = true,
                    Value = Obj,
                    StatusCode = 200
                };
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTaskById failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<List<TaskDTO>>> GetTasksListByPage(int PageIndex, int PageSize, CancellationToken ct)
        {
            if (PageIndex <= 0) PageIndex = 1;
            if (PageSize <= 0) PageSize = 10; // sensible default

            try
            {
                var result = await _taskRepo.GetTasksPageAsync(PageIndex, ct, PageSize);

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
                _logger.LogError(ex, "GetTasksListByPage failed");
                return new Result<List<TaskDTO>>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };
            }
        }

        public async Task<Result<TaskDTO>> UpdateTask(UpdateTaskDTO ObjTask, Guid Id, CancellationToken ct)
        {
            try
            {
                var result = await _taskRepo.GettaskById(Id, ct);
                if (result is null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = $"Task with Id : {Id} not found",
                        StatusCode = 404
                    };
                }

                // copy values
                _mapper.Map(ObjTask, result);
                result.UpdatedAt = DateTimeOffset.UtcNow;

                // update 
                var update = await _taskRepo.Updatetask(result, ct);
                if (!update)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Unexpected error while updating task",
                        StatusCode = 500
                    };
                }

                var dto = _mapper.Map<TaskDTO>(result);
                return new Result<TaskDTO>
                {
                    IsSuccess = true,
                    Value = dto,
                    StatusCode = 200 // OK
                };
            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateTask failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }

        public async Task<Result<TaskDTO>> UpdateTaskStatus(UpdateTaskStatusDTO ObjTask, Guid Id, CancellationToken ct)
        {
            try
            {
                var result = await _taskRepo.GettaskById(Id, ct);
                if (result is null)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = $"Task with Id : {Id} not found",
                        StatusCode = 404
                    };
                }

                // copy values
                _mapper.Map(ObjTask, result);
                result.UpdatedAt = DateTimeOffset.UtcNow;

                // update 
                var update = await _taskRepo.Updatetask(result, ct);

                if (!update)
                {
                    return new Result<TaskDTO>
                    {
                        IsSuccess = false,
                        Error = "Unexpected error while updating task",
                        StatusCode = 500
                    };

                }

                var dto = _mapper.Map<TaskDTO>(result);

                return new Result<TaskDTO>
                {
                    IsSuccess = true,
                    Value = dto,
                    StatusCode = 200 // OK
                };

            }
            catch (OperationCanceledException)
            {
                // Request was aborted
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "Request was cancelled",
                    StatusCode = 408 // Client Closed Request
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateTaskStatus failed");
                return new Result<TaskDTO>
                {
                    IsSuccess = false,
                    Error = "An unexpected error occurred.",
                    StatusCode = 500
                };

            }
        }
    }
}
