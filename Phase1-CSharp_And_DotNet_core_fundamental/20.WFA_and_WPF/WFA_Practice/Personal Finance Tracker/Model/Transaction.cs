using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Personal_Finance_Tracker.Model
{
    public class ClsTransaction
    {
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public ulong Id { get; set; }
        public DateTime Date { get; set; }
        public string? Type { get; set; } // "Income" or "Expense"
        public string? Category { get; set; }
        public decimal Amount { get; set; }
         
    }
}
