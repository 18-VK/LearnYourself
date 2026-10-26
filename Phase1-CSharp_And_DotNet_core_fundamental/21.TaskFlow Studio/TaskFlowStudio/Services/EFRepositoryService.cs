using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.AppDataContext;

namespace TaskFlowStudio.Services
{
    public class EFRepositoryService<T> : IRepository<T> where T : class
    {
        protected readonly AppDBContext _DBcontext;

        protected readonly DbSet<T> _DBSet;

        public EFRepositoryService(AppDBContext Context) 
        {
            _DBcontext = Context;
            _DBSet = Context.Set<T>();
        }

        public Task Add(T entity)
        {
            return _DBSet.AddAsync(entity).AsTask();
        }

        public async Task<IReadOnlyList<T>> GetAll()
        {
            return await _DBSet
                .AsNoTracking()
                .ToListAsync();
        }

        public Task<T?> GetByID(long val)
        {
            return _DBSet.FindAsync(val).AsTask();
        }

        public void Remove(T entity)
        {
            _DBSet.Remove(entity);
        }

        public Task<int> Save()
        {
            return _DBcontext.SaveChangesAsync();
        }
        public void Update(T entity)
        {
            _DBSet.Update(entity);
        }

    }
}
