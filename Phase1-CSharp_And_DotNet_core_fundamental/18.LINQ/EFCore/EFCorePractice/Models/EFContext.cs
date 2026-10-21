using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EFCorePractice.Models
{
    class EFContext : DbContext
    {
        string ConnectionString = "Server=LAPTOP-0DCLBA10\\SQLEXPRESS;Database=SysDBPractice;Trusted_Connection=True;Encrypt=False;";
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlServer(ConnectionString);
        }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Order>().Property(O => O.Total).HasComputedColumnSql("Quantity*UnitPrice");
            modelBuilder.Entity<Order>().Property(O => O.CreatedAt).HasDefaultValueSql("GETDATE()");

            modelBuilder.Entity<Post>().HasOne(P => P.Blog).WithMany(B => B.posts)
                                       .HasForeignKey(P => P.BlogId).OnDelete(DeleteBehavior.Restrict);
        }
        public DbSet<Product> Products { get; set; } 
        public DbSet<Order> Orders { get; set; }

        public DbSet<Blog> Blogs { get; set; }
        public DbSet<Post> Posts { get; set; }
    }
}
