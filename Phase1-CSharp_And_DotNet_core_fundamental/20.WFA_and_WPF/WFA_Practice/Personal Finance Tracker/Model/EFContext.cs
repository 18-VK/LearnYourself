using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace Personal_Finance_Tracker.Model
{
    internal class EFContext : DbContext
    {
        string? _ConnectionString = string.Empty;
        public EFContext(string? Connectionstring) {
            _ConnectionString = Connectionstring;
        }
        
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlServer(_ConnectionString);
        }
        public DbSet<ClsTransaction> TableTransactions { get; set; }
    }
}
