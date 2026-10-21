using Microsoft.EntityFrameworkCore;
using System.Transactions;
using Task_Management_System_API.Src.API.DTOs.Requests.Tasks;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;

namespace Task_Management_System_API.Src.Infrastructure.Repositories
{
    public class TaskRepository : ITaskRepository
    {
        // Note : Here retry for db concurrency is not implemented and not working currently 


        private readonly AppDbContext _appDbContext;
        private readonly ILogger<TaskRepository> _logger;
        public TaskRepository(AppDbContext appContext, ILogger<TaskRepository> logger) 
        {
            _appDbContext = appContext;
            _logger = logger;
        }

        public async Task<bool> Addtask(Tasks obj, CancellationToken ct)
        {
            if (obj == null) throw new ArgumentNullException(nameof(obj));

            try
            {
                await _appDbContext.Tasks.AddAsync(obj, ct);
                return await _appDbContext.SaveChangesAsync(ct) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Addtask failed");
                return false;
            }
        }

        public async Task<bool> Deletetask(Guid id, CancellationToken ct)
        {
            try
            {
                return await _appDbContext.Tasks.Where(t => t.Id == id).ExecuteDeleteAsync(ct) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deletetask failed for id {Id}", id);
                return false;
            }
        }

        public async Task<List<Tasks>?> GetTasksPageAsync(int page, CancellationToken ct, int pageSize)
        {
            try
            {

                if (page < 1) page = 1;
                if (pageSize <= 0) pageSize = 100;

                return await _appDbContext.Tasks.AsNoTracking()
                            .OrderByDescending(t => t.CreatedAt)
                            .Skip((page -1) * pageSize).Take(pageSize).ToListAsync(ct);
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "GetTasksPageAsync failed for page {page}, and pagesize {pageSize}", page, pageSize);
                return default;
            }
        }

        public async Task<Tasks?> GettaskById(Guid id, CancellationToken ct)
        {
            // if null(mean not found) then return default(that is null)
            try
            {
                return await _appDbContext.Tasks.FindAsync(id, ct) ?? default;
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "GettaskById failed for id {Id}", id);
                return default;
            }
        }

        public async Task<bool> Updatetask(Tasks Obj, CancellationToken ct)
        {

            const int Defaultretry = 3;
            int currentcount = 0;


            while(currentcount < Defaultretry)
            {

                if (Obj == null) return false;

                try
                {
                    return await _appDbContext.SaveChangesAsync(ct) > 0;
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    currentcount++;
                    if (currentcount > Defaultretry)
                    {
                        _logger.LogDebug($"Concurrency conflict detected|Source : {ex.Source}, Error Description : {ex.Message}, Retry count exhausted : {currentcount}");
                        return false;
                    }
                    // added wait delay
                    await Task.Delay(100, ct);

                    // get the current values from the database
                    var entry = ex.Entries.Single();
                    var DBValues = await entry.GetDatabaseValuesAsync();
                    if (DBValues == null)
                    {
                        _logger.LogDebug($"Concurrency conflict detected|Source : {ex.Source}, Error Description : {ex.Message}, Retry count : {currentcount}, Database values are null");
                        return false;
                    }

                    var dbEntity = (Tasks)DBValues.ToObject();

                    // get the current values from the entity
                    var currEntity = (Tasks)entry.Entity;

                    // merge the changes from the database into the current entity
                    // can decide to merge or overwrite based on your business logic, here we are overwriting the current entity with the database values
                    // E.g. currEntity.Title = dbEntity.Title; currEntity.Description = dbEntity.Description; etc.
                    // WE will overwrite the current entity with the database values for all properties except for the Id and RowVersion\

                    entry.OriginalValues.SetValues(DBValues);

                    _logger.LogDebug($"Concurrency conflict detected|Source : {ex.Source}, Error Description : {ex.Message}, Retry count : {currentcount}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Updateproject failed for Id {Id}", Obj.Id);
                    return default;
                }
            }
            return default;
        }

        public async Task<Tasks?> GetTaskByName(string name, Guid userId, CancellationToken ct)
        {
            if (String.IsNullOrEmpty(name)) return default;

            try
            {

                return await _appDbContext.Tasks.Where(x => x.Title == name && x.Userid == userId)
                                .FirstOrDefaultAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTaskByName failed for task name {name}", name);
                return default;
            }
        }

        public async Task<Projects?> GetProjectByTaskId(Guid taskId, CancellationToken ct)
        {
            try
            {
                var task =  await _appDbContext.Tasks
                    .Include(t => t.Project)
                    .FirstOrDefaultAsync(t => t.Id == taskId, ct);

                return task?.Project;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching project for TaskId {taskId}");
                return null;
            }
        }

        public async Task<PaginationResult<Tasks>?> ApplyFilterAsync(TaskFilterDTO filter, Guid userId, CancellationToken ct)
        {
            try
            {

                var query = _appDbContext.Tasks.AsNoTracking();

                // Status Filter
                if (filter.Status.HasValue)
                {
                    query = query.Where(x => x.Status == filter.Status.Value);

                }
                // Priority Filter
                if (filter.Priority.HasValue)
                {
                    query = query.Where(x => x.Priority == filter.Priority.Value);

                }

                // Due Date Filter
                if (filter.DueDate.HasValue)
                {
                    query = query.Where(x => DateOnly.FromDateTime(x.DueDate.DateTime) == filter.DueDate.Value);
                }

                query = query.Where(x => x.Userid == userId);
                var totalcount = await query.CountAsync(ct);

                var tasks = await query.OrderByDescending(t => t.CreatedAt)
                                        .Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize)
                                        .ToListAsync(ct);

                return new PaginationResult<Tasks>
                {
                    TotalCount = totalcount,
                    Data = tasks,
                    Page = filter.Page,
                    PageSize = filter.PageSize,
                    TotalPages = (int)(Math.Ceiling(totalcount / (double)filter.PageSize))
                };

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching tasks using filters");
                return null;
            }
        }
    }
}
