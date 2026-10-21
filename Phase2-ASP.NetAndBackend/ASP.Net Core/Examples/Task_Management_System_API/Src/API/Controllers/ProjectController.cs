using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Task_Management_System_API.Src.API.DTOs.Requests.Projects;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.API.DTOs.Responses;
using Task_Management_System_API.Src.API.DTOs.Responses.Tasks;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Application.Exceptions;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Domain.Common;

namespace Task_Management_System_API.Src.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectController : ControllerBase
    {
        private IProjectService _projectService;
        private IMapper _mapper;
        public ProjectController(IProjectService projectService, IMapper mapper)
        {
            _projectService = projectService;
            _mapper = mapper;
        }

        [HttpGet("{Id:Guid}")]
        public async Task<ActionResult<ProjectResponse>> GetById(Guid Id, CancellationToken ct)
        {
            var result = await _projectService.GetProjectById(Id, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => NotFound(new { error = result.Error }),
                    400 => BadRequest(new { error = result.Error }),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }

            // Map ProjectDTO into ProjectResponse
            var  response = _mapper.Map<ProjectResponse>(result.Value);
            return Ok(response);
            
        }

        [HttpPost]
        public async Task<ActionResult<ProjectResponse>> Create(CreateProjectRequest Obj, CancellationToken ct)
        {
            var DTO = _mapper.Map<ProjectDTO>(Obj);
            var result = await _projectService.CreateProject(DTO, ct);

            
            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => NotFound(new { error = result.Error }),
                    400 => BadRequest(new { error = result.Error }),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    409 => Conflict(new { error = result.Error }),
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }

            // Map ProjectDTO into ProjectResponse
            var response = _mapper.Map<ProjectResponse>(result.Value);
            
            return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);
        }

        [HttpDelete("{Id:guid}")]
        public async Task<IActionResult> DeleteById(Guid Id, CancellationToken ct)
        {
            var result = await _projectService.DeleteProjectById(Id, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => NotFound(new { error = result.Error }),
                    400 => BadRequest(new { error = result.Error }),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    409 => Conflict(new { error = result.Error }),
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }

            return NoContent();
        }

        // GET: /Project?Page=1&pageSize=1024
        [HttpGet]
        public async Task<ActionResult<ProjectListResponse>> GetByPageNum(CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 1024)
        {
            
            var result = await _projectService.GetProjectListByPage(page,pageSize, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    400 => throw new ValidationException(result.Error ?? "Validation Failed while updating task"),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }
            var ListProjects = _mapper.Map<ProjectListResponse>(result.Value ?? new PaginationResult<ProjectDTO>());
            
            //var response = new ProjectListResponse();
            //response.Projects = ListProjects.Data;
            //response.TotalCount = ListProjects.TotalCount;

            return Ok(ListProjects);
        }

        // patch : /Project/Update?Id=1
        [HttpPatch("Update")]
        public async Task<ActionResult<ProjectResponse>> Update(UpdateProjectRequest obj, [FromQuery] Guid Id, CancellationToken ct)
        {
            var DTO = _mapper.Map<UpdateProjectDTO>(obj);
            var result = await _projectService.UpdateProject(DTO, Id, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => throw new NotFoundException(result.Error  ?? "Not found"),
                    400 => throw new ValidationException(result.Error ?? "Validation Failed while updating task"),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    409 => Conflict(new { error = result.Error }),
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }
            var response = _mapper.Map<ProjectResponse>(result.Value); 

            return Ok(response);
        }
        [HttpGet("{Id:guid}/Tasks")]
        public async Task<ActionResult<TaskListResponse>> Tasks([FromRoute] Guid Id, CancellationToken ct)
        {
            // call to get project with all tasks of it
            var result = await _projectService.GetTasksByProjectId(Id, ct);
            
            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    404 => throw new NotFoundException(result.Error ?? "Not found"),
                    400 => throw new ValidationException(result.Error ?? "Validation Failed while updating task"),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    409 => Conflict(new { error = result.Error }),
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }
            var Result = _mapper.Map<List<TaskResponse>>(result.Value);

            var response = new TaskListResponse();
            response.Tasks = Result;
            response.TotalCount = Result.Count;

            return Ok(response);
        }
    }

}
