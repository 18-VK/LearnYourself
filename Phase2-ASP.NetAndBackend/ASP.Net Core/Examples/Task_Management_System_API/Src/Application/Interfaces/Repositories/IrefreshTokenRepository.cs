using Task_Management_System_API.Src.Domain.Entities;

namespace Task_Management_System_API.Src.Application.Interfaces.Repositories
{
    public interface IrefreshTokenRepository
    {
        Task<bool> AddRefreshToken(RefreshToken entity, CancellationToken ct);
        Task<bool> DeleteRefreshToken(Guid Id, CancellationToken ct);
        Task<bool> UpdateRefreshToken(RefreshToken entity, CancellationToken ct);
        Task<bool> UpdateRefreshTokenList(List<RefreshToken> entity, CancellationToken ct);
        Task<RefreshToken?> GetRefreshTokenById(Guid RefreshTokenId, CancellationToken ct, bool includeNavigationProp = false);
        Task<RefreshToken?> GetRefreshToken(string RefreshToken, CancellationToken ct, bool includeNavigationProp = false);
        Task<ICollection<RefreshToken>?> GetRefreshTokensByUserId(Guid UserId, CancellationToken ct, bool includeNavigationProp = false);
        Task<ICollection<RefreshToken>?> GetRefreshTokensByTokenFamilyId(Guid TokenFamilyId, CancellationToken ct, bool includeNavigationProp = false);
        Task<bool> RevokeRefreshTokenByFamilyId(Guid TokenFamilyId, CancellationToken ct);
        Task<bool> RevokeRefreshTokenByUserId(Guid TokenFamilyId, CancellationToken ct);
    }
}
