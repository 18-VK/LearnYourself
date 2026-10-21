using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.Services;

namespace TaskFlowStudio.Model
{
    public class TaskItem
    {
        public int Id { get; set; }

        public int ProjectId { get; set; }

        public Project Project { get; set; } = null!;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public int Status { get; set; }
        public int Priority { get; set; }

        public DateTime DueDate { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }


    }
}
