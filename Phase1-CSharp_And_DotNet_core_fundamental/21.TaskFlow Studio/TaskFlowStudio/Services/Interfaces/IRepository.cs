using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio
{
    public interface IRepository<T> where T : class
    {
        Task<T?> GetByID(long Id);
        Task Add(T entity);
        void Update(T entity);
        void Remove(T entity);
        Task<IReadOnlyList<T>> GetAll();
        Task<int> Save();
    }
}
