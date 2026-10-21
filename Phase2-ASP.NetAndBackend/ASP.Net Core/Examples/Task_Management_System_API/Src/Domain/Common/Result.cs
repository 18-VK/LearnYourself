namespace Task_Management_System_API.Src.Domain.Common
{
    public class Result<T>
    {
        public bool IsSuccess { get; init; }
        public T? Value { get; init; }
        public string? Error { get; init; }
        public int StatusCode { get; init; }
    }
}
