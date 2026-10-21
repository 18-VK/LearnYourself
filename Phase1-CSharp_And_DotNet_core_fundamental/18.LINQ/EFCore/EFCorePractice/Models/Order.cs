using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EFCorePractice.Models
{
    public class Order
    {
        public int Id { get; set; }
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public DateTime CreatedAt { get; set; }

        
        public int UnitPrice { get; set; }
        public int Quantity { get; set; }

        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public int Total {  get; set; } 

        public ICollection<Product> ItemsOrdered { get; set; } = new List<Product>();
    }
}
