using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Client;
using Task_Management_System_API.Src.Application.Interfaces.Repositories;
using Task_Management_System_API.Src.Domain.Entities;
using Task_Management_System_API.Src.Infrastructure.AppDBContext;
namespace Task_Management_System_API.Src.Infrastructure.Repositories
{
    public class RefreshTokenRepository : IrefreshTokenRepository
    {
        private readonly AppDbContext _appDbContext;
        private readonly ILogger<RefreshTokenRepository> _logger;
        public RefreshTokenRepository(AppDbContext appDBContext, ILogger<RefreshTokenRepository> logger)
        {
            _appDbContext = appDBContext;
            _logger = logger;
        }
        public async Task<bool> AddRefreshToken(RefreshToken entity, CancellationToken ct)
        {
            try
            {
                if (entity is null)
                {
                    _logger.LogError("The refresh token entity is null.");
                    return false;
                }

                await _appDbContext.RefreshTokens.AddAsync(entity);
                var changes = await _appDbContext.SaveChangesAsync(ct);
                return changes > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while adding a refresh token.");
                return false;
            }
        }

        public async Task<bool> DeleteRefreshToken(Guid Id, CancellationToken ct)
        {
            try
            {
                var changes = await _appDbContext.RefreshTokens.Where(rt => rt.Id == Id).ExecuteDeleteAsync(ct);
                return changes > 0;
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "An error occurred while deleting a refresh token.");
                return false;
            }
        }

        public async Task<ICollection<RefreshToken>?> GetRefreshTokensByTokenFamilyId(Guid TokenFamilyId, CancellationToken ct, bool includeNavigationProp = false)
        {
            try
            {
                if (includeNavigationProp)
                    return await _appDbContext.RefreshTokens.Include(rt => rt.User).Where(rt => rt.TokenFamilyId == TokenFamilyId).AsNoTracking().ToListAsync(ct);
                
                return await _appDbContext.RefreshTokens.Where(rt => rt.TokenFamilyId == TokenFamilyId).AsNoTracking().ToListAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while getting a refresh token by token family id.");
                return null;
            }
        }

        public async Task<ICollection<RefreshToken>?> GetRefreshTokensByUserId(Guid UserId, CancellationToken ct, bool includeNavigationProp = false)
        {
            try
            {
                if(includeNavigationProp)
                    return await _appDbContext.RefreshTokens.Include(rt => rt.User).Where(rt => rt.UserId == UserId).AsNoTracking().ToListAsync(ct);

                return await _appDbContext.RefreshTokens.Where(rt => rt.UserId == UserId).AsNoTracking().ToListAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while getting a refresh token by user id.");
                return null;
            }
        }

        public async Task<RefreshToken?> GetRefreshTokenById(Guid RefreshTokenId, CancellationToken ct, bool includeNavigationProp = false)
        {
            try
            {
                if (includeNavigationProp)
                    return await _appDbContext.RefreshTokens.Include(rt => rt.User).AsNoTracking().FirstOrDefaultAsync(rt => rt.Id == RefreshTokenId, ct);

                return await _appDbContext.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(rt => rt.Id == RefreshTokenId, ct);
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "An error occurred while getting a refresh token by id.");
                return default;
            }
        }

        public async Task<bool> UpdateRefreshToken(RefreshToken entity, CancellationToken ct)
        {

            const int Defaultretry = 3;
            int currentcount = 0;


            while (currentcount < Defaultretry)
            {

                if (entity == null) return false;

                try
                {
                    // require this as getting refresh token as no tracking
                    _appDbContext.RefreshTokens.Attach(entity);
                    _appDbContext.Entry(entity).Property(x => x.RevokedAtUtc).IsModified = true;
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

                    var dbEntity = (RefreshToken)DBValues.ToObject();

                    // get the current values from the entity
                    var currEntity = (RefreshToken)entry.Entity;

                    // merge the changes from the database into the current entity
                    // can decide to merge or overwrite based on your business logic, here we are overwriting the current entity with the database values
                    // E.g. currEntity.Title = dbEntity.Title; currEntity.Description = dbEntity.Description; etc.
                    // WE will overwrite the current entity with the database values for all properties except for the Id and RowVersion\

                    entry.OriginalValues.SetValues(DBValues);

                    _logger.LogDebug($"Concurrency conflict detected|Source : {ex.Source}, Error Description : {ex.Message}, Retry count : {currentcount}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An error occurred while updating a refresh token.");
                    return default;
                }
            }
            return default;

        }
        // not completed
        public async Task<bool> UpdateRefreshTokenList(List<RefreshToken> entities, CancellationToken ct)
        {
            try
            {
                if (entities is null || entities.Count == 0)
                {
                    _logger.LogError("The refresh token list is null or empty.");
                    return false;
                }

                _appDbContext.RefreshTokens.UpdateRange(entities);
                var changes = await _appDbContext.SaveChangesAsync(ct);
                return changes > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating a list of refresh tokens.");
                return false;
            }
        }

        public async Task<RefreshToken?> GetRefreshToken(string RefreshToken, CancellationToken ct, bool includeNavigationProp = false)
        {
            try
            {
                if (string.IsNullOrEmpty(RefreshToken))
                {
                    _logger.LogError("The refresh token string is null or empty.");
                    return null;
                }
                if (includeNavigationProp)
                    return await _appDbContext.RefreshTokens.Include(rt => rt.User).AsNoTracking().FirstOrDefaultAsync(rt => rt.Token == RefreshToken, ct);

                return await _appDbContext.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(rt => rt.Token == RefreshToken, ct);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating a list of refresh tokens.");
                return null;
            }
        }

        public async Task<bool> RevokeRefreshTokenByFamilyId(Guid TokenFamilyId, CancellationToken ct)
        {
            try
            {
                var changes = await _appDbContext.RefreshTokens.Where(rt => rt.TokenFamilyId == TokenFamilyId && rt.RevokedAtUtc == null)
                                        .ExecuteUpdateAsync(rt =>
                                        {
                                            rt.SetProperty(t => t.RevokedAtUtc, t => DateTimeOffset.UtcNow);
                                        });

                return changes > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while revoking refresh tokens by token family id.");
                return false;
            }
        }

        public async Task<bool> RevokeRefreshTokenByUserId(Guid userId, CancellationToken ct)
        {
            try
            {
                var changes = await _appDbContext.RefreshTokens.Where(rt => rt.UserId == userId && rt.RevokedAtUtc == null)
                                        .ExecuteUpdateAsync(rt =>
                                        {
                                            rt.SetProperty(t => t.RevokedAtUtc, t => DateTimeOffset.UtcNow);
                                        });

                return changes > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while revoking refresh tokens by user id.");
                return false;
            }
        }
    }
}
