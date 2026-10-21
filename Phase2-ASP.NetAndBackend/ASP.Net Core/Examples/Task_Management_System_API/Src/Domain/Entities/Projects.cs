namespace Task_Management_System_API.Src.Domain.Entities
{
    public class Projects
    {
        public Guid Id { get; set; }    
        public string Name { get; set; } = String.Empty;
        public Guid Userid { get; set; }
        public string Description { get; set; } = String.Empty; 
        public DateTimeOffset DueDate { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public List<Tasks> TaskItems { get; set; } = new List<Tasks>();
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}
