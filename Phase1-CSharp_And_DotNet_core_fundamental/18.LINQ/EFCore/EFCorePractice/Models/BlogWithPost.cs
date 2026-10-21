using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EFCorePractice.Models
{
    public class Blog
    {
        public int Id { get; set; }
        public string? Title { get; set; }

        // Navigation property — one Blog has many Posts
        public ICollection<Post> posts { get; set; } = new List<Post>();
    }
    public class Post
    {
        public int Id { get; set; }
        public string? Title { get; set; }

        // Foreign Key
        public int BlogId { get; set; }

        // Navigation property — each Post belongs to one Blog
        public Blog Blog { get; set; }
    }

}
