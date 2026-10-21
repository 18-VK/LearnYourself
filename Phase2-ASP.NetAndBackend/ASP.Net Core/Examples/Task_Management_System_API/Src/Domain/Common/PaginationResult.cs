namespace Task_Management_System_API.Src.Domain.Common
{
    public class PaginationResult<T>
    {
        
        public IEnumerable<T> Data { get; set; }
            = Enumerable.Empty<T>();

        public int? Page { get; set; }

        public int? PageSize { get; set; }

        public int? TotalCount { get; set; }

        public int? TotalPages { get; set; }

    }
}
