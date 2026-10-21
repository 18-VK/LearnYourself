using Microsoft.EntityFrameworkCore;
using Task_Management_System_API.Src.Application.DTOs;
using Task_Management_System_API.Src.Application.Exceptions;
using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Domain.Common;
using Task_Management_System_API.Src.Domain.Entities;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;

namespace Task_Management_System_API.Src.Infrastructure.Repositories
{
    public class ProjectRepository : IProjectRepository
    {
        private readonly AppDbContext _appDbContext;
        private readonly ILogger<ProjectRepository> _logger;

        /* Note : Exception handling : we should log the exception here for diagnose and throw custom exception to service layer
            
            - Log at the infrastructure layer for diagnostics.
            - Translate at the service layer into domain‑specific exceptions or results.
            - Return clean API responses from the controller (e.g., NotFound, BadRequest, 500 with a friendly message).
            - Avoid leaking SQL details or EF Core stack traces to clients.
        */

        // Note : Here retry for db concurrency is not implemented and not working currently 

        public ProjectRepository(AppDbContext appContext, ILogger<ProjectRepository> logger) 
        {
            _appDbContext = appContext;
            _logger = logger;
        }

        public async Task<bool> Addproject(Projects Obj, CancellationToken ct)
        {
            if (Obj == null) throw new ArgumentNullException(nameof(Obj));

            try
            {
                await _appDbContext.Projects.AddAsync(Obj, ct);
                return await _appDbContext.SaveChangesAsync(ct) > 0;
        
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "Addproject failed");
                return false;
            }
        }

        public async Task<bool> Deleteproject(Guid id, CancellationToken ct)
        {
            try
            {
                return await _appDbContext.Projects.Where(p => p.Id == id).ExecuteDeleteAsync(ct) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deleteproject failed for Id {Id}", id);
                return false;
            }
        }

        public async Task<PaginationResult<Projects>?> GetprojectsPageAsync(int page, Guid userId, CancellationToken ct, int pageSize)
        {
            if (page < 1) page = 1;
            if (pageSize <= 0) pageSize = 100;

            try
            {
                var query = _appDbContext.Projects
                                    .AsNoTracking()
                                    .Where(p => p.Userid == userId);

                var totalcount = await query.CountAsync(ct);

                var resultdata = await query
                                    .OrderByDescending(p => p.CreatedAt)
                                    .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

                return new PaginationResult<Projects>
                {
                    TotalCount = totalcount,
                    Data = resultdata,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)(Math.Ceiling(totalcount / (double)pageSize))
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetprojectsPageAsync failed for page {page}, and pagesize {pageSize}", page, pageSize);
                return default;
            }
        }

        public async Task<Projects?> GetprojectById(Guid id, CancellationToken ct)
        {
            try
            {
                return await _appDbContext.Projects.FindAsync(id, ct) ?? default;
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "GetprojectById failed for project Id {Id}", id);
                return default;
            }
        }

        public async Task<bool> Updateproject(Projects Obj, CancellationToken ct)
        {
            int currentcount = 0;
            int defaultretry = 3; // Default retry count for concurrency conflicts

            while(currentcount < defaultretry)
            {

                if (Obj is null) return false;

                //var existing = await _appDbContext.Projects.FindAsync(Obj.Id, ct);
                //if (existing is null) return false;

                //_appDbContext.Entry(Obj).CurrentValues.SetValues(Obj);

                try
                {
                    return await _appDbContext.SaveChangesAsync(ct) > 0;
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    currentcount++;
                    if (currentcount > defaultretry)
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

                    var dbEntity = (Projects)DBValues.ToObject();

                    // get the current values from the entity
                    var currEntity = (Projects)entry.Entity;

                    // merge the changes from the database into the current entity
                    // can decide to merge or overwrite based on your business logic, here we are overwriting the current entity with the database values
                    // E.g. currEntity.Title = dbEntity.Title; currEntity.Description = dbEntity.Description; etc.
                    // WE will overwrite the current entity with the database values for all properties except for the Id and RowVersion\

                    entry.OriginalValues.SetValues(DBValues);

                    _logger.LogDebug($"Concurrency conflict detected|Source : {ex.Source}, Error Description : {ex.Message}, Retry count : {currentcount}");
                }
                catch(Exception ex)
                {
                    _logger.LogError(ex, "Updateproject failed for project Id {Id}", Obj.Id);
                    return false;
                }
            }
            return default;
        }

        public async Task<Projects?> GetprojectByName(string name, Guid userId, CancellationToken ct)
        {
            if(String.IsNullOrEmpty(name)) return default;
            
            try
            {

                return await _appDbContext.Projects.Where(x => x.Name == name && x.Userid == userId)
                                .FirstOrDefaultAsync(ct);
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "GetprojectByName failed for project name {name}", name);
                return default;
            }
        }

        public async Task<List<Tasks>?> GetTasksForProject(Guid id, CancellationToken ct)
        {
            try
            {

                return await _appDbContext.Tasks
                                .AsNoTracking()
                                .Where(t => t.ProjectId == id)
                                .ToListAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTasksForProject failed  for project id {Id}", id);
                return default;
            }
        }
    }
}
