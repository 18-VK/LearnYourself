using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections;
using System.Data;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.API.DTOs.Responses;
using Task_Management_System_API.Src.API.DTOs.Responses.Tasks;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Application.Interfaces.Services;
using Task_Management_System_API.Src.Application.Services;
using Task_Management_System_API.Src.Domain.Common;

namespace Task_Management_System_API.Src.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TaskController : ControllerBase
    {
        private ITaskService _taskService;
        private IMapper _mapper;
        public TaskController(ITaskService taskService, IMapper mapper)
        {
            _taskService = taskService;
            _mapper = mapper;
        }

        [HttpGet("{Id:guid}")]
        public async Task<ActionResult<TaskResponse>> GetById(Guid Id, CancellationToken ct)
        {
            var result = await _taskService.GetTaskById(Id, ct);

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

            // Map TaskDTO into TaskResponse
            var response = _mapper.Map<TaskResponse>(result.Value);
            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult<TaskResponse>> Create(CreateTaskRequest obj, CancellationToken ct)
        {
            var DTO = _mapper.Map<TaskDTO>(obj);
            var result = await _taskService.CreateTask(DTO, ct);

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
            var response = _mapper.Map<TaskResponse>(result.Value);

            return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);

        }

        [HttpDelete("{Id:guid}")]
        public async Task<IActionResult> DeleteById(Guid Id, CancellationToken ct)
        {
            var result = await _taskService.DeleteTaskById(Id, ct);

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

        // GET: /Task?Page=1&pageSize=1024
        //[HttpGet]
        //public async Task<ActionResult<IEnumerable<TaskListResponse>>> GetByPageNum(CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
        //{
            
        //    var result = await _taskService.GetTasksListByPage(page, pageSize, ct);

        //    if (!result.IsSuccess)
        //    {
        //        return result.StatusCode switch
        //        {
        //            400 => BadRequest(new { error = result.Error }),
        //            408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
        //            500 => StatusCode(500, new { error = result.Error }),
        //            _ => StatusCode(result.StatusCode, new { error = result.Error })
        //        };
        //    }
        //    var List = _mapper.Map<List<TaskResponse>>(result.Value ?? new List<TaskDTO>());

        //    var response = new TaskListResponse();
        //    response.Tasks = List;
        //    response.TotalCount = List?.Count ?? 0;

        //    return Ok(List);
        //}

        // patch : /Task/UpdateStatus
        [HttpPatch("{Id:guid}/status")]
        public async Task<ActionResult<TaskResponse>> UpdateStatus([FromBody] UpdateTaskStatusRequest obj, [FromRoute] Guid Id, CancellationToken ct)
        {
            var DTO = _mapper.Map<UpdateTaskStatusDTO>(obj);
            var result = await _taskService.UpdateTaskStatus(DTO, Id, ct);

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
            var response = _mapper.Map<TaskResponse>(result.Value);

            return Ok(response);
        }

        // patch : /Task/{id}/Update
        [HttpPatch("{Id:guid}/Update")]
        public async Task<ActionResult<TaskResponse>> Update([FromBody] UpdateTaskRequest obj, [FromRoute] Guid Id, CancellationToken ct)
        {
            var DTO = _mapper.Map<UpdateTaskDTO>(obj);
            var result = await _taskService.UpdateTask(DTO, Id, ct);

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
            var response = _mapper.Map<TaskResponse>(result.Value);

            return Ok(response);
        }

        [HttpGet("{Id:guid}/Project")]
        public async Task<ActionResult<ProjectResponse>> Project([FromRoute] Guid Id, CancellationToken ct)
        {
            var result = await _taskService.GetProjectByTaskId(Id, ct);

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
            var response = _mapper.Map<ProjectResponse>(result.Value);

            return Ok(response);
        }

        [HttpGet]
        public async Task<ActionResult<TaskListResponse>> Filter([FromQuery] TaskFilterRequest filter, CancellationToken ct)
        {
            var obj = _mapper.Map<TaskFilterDTO>(filter);
            var result = await _taskService.ApplyFilter(obj, ct);

            if (!result.IsSuccess)
            {
                return result.StatusCode switch
                {
                    400 => BadRequest(new { error = result.Error }),
                    408 => StatusCode(408, new { error = result.Error }), // non-standard, document if used
                    500 => StatusCode(500, new { error = result.Error }),
                    _ => StatusCode(result.StatusCode, new { error = result.Error })
                };
            }

            var response = _mapper.Map<TaskListResponse>(result.Value ?? new PaginationResult<TaskDTO>());

            return Ok(response);
        }
    }
}
