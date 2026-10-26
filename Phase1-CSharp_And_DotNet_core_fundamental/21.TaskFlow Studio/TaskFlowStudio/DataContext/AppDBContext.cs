using Microsoft.EntityFrameworkCore;
using Microsoft.SqlServer;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Controls;
using TaskFlowStudio.Model;
using TaskFlowStudio.Services;

namespace TaskFlowStudio.AppDataContext
{
    public class AppDBContext : DbContext
    {
        public DbSet<Project>  Tbl_Projects => Set<Project>();
        public DbSet<TaskItem> Tbl_TaskItems => Set<TaskItem>();

        public AppDBContext(DbContextOptions<AppDBContext> options) : base(options)
        {
            /* DbContextOptions<AppDbContext> options:
            This is the parameter the constructor accepts.
            It contains all the necessary configuration settings for the database, such as the Connection String and the database provider (e.g., SQL Server, PostgreSQL, or SQLite).
            */

        }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Project>()
                .ToTable("Projects");

            modelBuilder.Entity<TaskItem>()
                .ToTable("TaskItems");

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tasks)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskItem>()
                .HasIndex(t => t.ProjectId);

        }
    }
}
