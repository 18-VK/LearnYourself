using AutoMapper;
using Microsoft.AspNetCore.Mvc.TagHelpers;
using Task_Management_System_API.Src.API.DTOs.Requests.Projects;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.API.DTOs.Responses;
using Task_Management_System_API.Src.API.DTOs.Responses.Auth;
using Task_Management_System_API.Src.API.DTOs.Responses.Tasks;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;
using Task_Management_System_API.Src.Domain.Enums;

namespace Task_Management_System_API.Src.Application.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // API -> Application
            CreateMap<CreateTaskRequest, TaskDTO>()
                       .ForMember(dest => dest.Id, opt => opt.MapFrom(_ => Guid.NewGuid()))
                       .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTimeOffset.UtcNow))
                       .ForMember(dest => dest.Status, opt => opt.MapFrom(_ => TaskItemStatus.InProgress))
                       .ForMember(dest => dest.Priority, option => option.MapFrom(src => Enum.Parse<TaskPriority>(src.Priority ?? "Medium")))
                       .ForMember(dest => dest.DueDate, option => option.MapFrom(src => src.DueDate.ToDateTime(TimeOnly.MinValue)))
                       .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                                    srcMember != null));

            CreateMap<UpdateTaskRequest, UpdateTaskDTO>()
                       .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                                        srcMember != null && !IsDefaultValue(srcMember)));

            CreateMap<UpdateTaskStatusRequest, UpdateTaskStatusDTO>()
                       .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                                        srcMember != null && !IsDefaultValue(srcMember)));

            CreateMap<CreateProjectRequest, ProjectDTO>()
                        .ForMember(dest => dest.Id, opt => opt.MapFrom(_ => Guid.NewGuid()))
                        .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTimeOffset.UtcNow))
                        .ForMember(dest => dest.DueDate, option => option.MapFrom(src => src.DueDate.ToDateTime(TimeOnly.MinValue)))
                        .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                            srcMember != null));

            CreateMap<UpdateProjectRequest, UpdateProjectDTO>()
                        .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                            srcMember != null && !IsDefaultValue(srcMember)));

            CreateMap<TaskFilterRequest, TaskFilterDTO>()
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status != null ? Enum.Parse<TaskItemStatus>(src.Status, true) : (TaskItemStatus?)null))
                .ForMember(dest => dest.Priority, opt => opt.MapFrom(src => src.Priority != null ? Enum.Parse<TaskPriority>(src.Priority, true) : (TaskPriority?)null))
                .ForAllMembers(opt =>
                        opt.Condition((src, dest, srcMember) => srcMember != null));

            // Application -> Infra domain(Entity)
            CreateMap<TaskDTO, Tasks>()
                    .ForAllMembers(option => option.Condition((src, dest, srcMember) =>
                                    srcMember != null));
            
            CreateMap<UpdateTaskStatusDTO, Tasks>()
                    .ForMember(dest => dest.Status, opt => opt.MapFrom(src =>
                                    Enum.Parse<TaskItemStatus>(src.Status ?? "", ignoreCase: true)))
                    .ForAllMembers(opt =>
                        opt.Condition((src, dest, srcMember) => srcMember != null));

            CreateMap<UpdateTaskDTO, Tasks>()
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status != null ? Enum.Parse<TaskItemStatus>(src.Status, true) : (TaskItemStatus?)null))
                .ForMember(dest => dest.Priority, opt => opt.MapFrom(src => src.Priority != null ? Enum.Parse<TaskPriority>(src.Priority, true) : (TaskPriority?)null))
                .ForAllMembers(opt =>
                        opt.Condition((src, dest, srcMember) => srcMember != null));
                      

            CreateMap<ProjectDTO, Projects>()
                      .ForAllMembers(opt =>
                        opt.Condition((src, dest, srcMember) => srcMember != null));

            CreateMap<UpdateProjectDTO, Projects>()
                      .ForAllMembers(opt =>
                        opt.Condition((src, dest, srcMember) =>
                            srcMember != null && !IsDefaultValue(srcMember)));

            // Here check for vice versa condition for these DTOs

            // Infra domain(Entity) -> Application 

            CreateMap<Tasks, TaskDTO>();

            CreateMap<Projects, ProjectDTO>();

            //CreateMap(typeof(PaginationResult<>),
            //      typeof(PaginationResult<>));

            CreateMap<PaginationResult<Projects>,
                            PaginationResult<ProjectDTO>>();

            CreateMap<PaginationResult<Tasks>,
                            PaginationResult<TaskDTO>>();


            // Application to api response
            CreateMap<TaskDTO, TaskResponse>()
                    .ForMember(dest => dest.Status, option => option.MapFrom(src => src.Status.ToString()))
                    .ForMember(dest => dest.priority, option => option.MapFrom(src => src.Priority.ToString()));


            CreateMap<PaginationResult<ProjectDTO>, ProjectListResponse>()
                    .ForMember(dest => dest.Projects, opt => opt.MapFrom(src => src.Data))
                    .ForMember(dest => dest.Page, opt => opt.MapFrom(src => src.Page))
                    .ForMember(dest => dest.PageSize, opt => opt.MapFrom(src => src.PageSize))
                    .ForMember(dest => dest.TotalCount, opt => opt.MapFrom(src => src.TotalCount))
                    .ForMember(dest => dest.TotalPages, opt => opt.MapFrom(src => src.TotalPages));

            CreateMap<PaginationResult<TaskDTO>, TaskListResponse>()
                .ForMember(dest => dest.Tasks, opt => opt.MapFrom(src => src.Data))
                .ForMember(dest => dest.Page, opt => opt.MapFrom(src => src.Page))
                .ForMember(dest => dest.PageSize, opt => opt.MapFrom(src => src.PageSize))
                .ForMember(dest => dest.TotalCount, opt => opt.MapFrom(src => src.TotalCount))
                .ForMember(dest => dest.TotalPages, opt => opt.MapFrom(src => src.TotalPages));

            CreateMap<ProjectDTO, ProjectResponse>();

            CreateMap<AuthResult, AuthResponse>()
                 .ConstructUsing(src => new AuthResponse(
                        src.AccessToken ?? string.Empty,
                        src.RefreshToken ?? string.Empty,
                        src.AccessTokenExpiredAtUtc ?? DateTimeOffset.MinValue
                    ));

            /*
             * 🔹 How It Works
                AutoMapper sees that Projects.TaskItems is a List<Tasks> and ProjectResponse.TaskItems is a List<TaskResponse>.
                Since you’ve defined a CreateMap<Tasks, TaskResponse>, AutoMapper will automatically apply it to each item in the list.
                The result: your ProjectResponse will contain a list of TaskResponse objects, each mapped from the entity.
            */
        }
        private static bool IsDefaultValue(object value)
        {
            if (value == null) return true;
            var type = value.GetType();

            // Handle nullable types
            if (Nullable.GetUnderlyingType(type) != null)
                type = Nullable.GetUnderlyingType(type);
            
            if (type == null) return true;

            if (type == typeof(string))
                return string.IsNullOrEmpty((string)value);

            return value.Equals(Activator.CreateInstance(type));
        }
    }
}
