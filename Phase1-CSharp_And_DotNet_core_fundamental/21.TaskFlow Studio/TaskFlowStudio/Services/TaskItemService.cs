using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.Model;

namespace TaskFlowStudio.Services
{
    public class TaskItemService
    {
        private readonly ILogger<TaskItemService> _logger;
        private readonly IRepository<TaskItem> _taskitemRepo;

        public TaskItemService(ILogger<TaskItemService> logger, IRepository<TaskItem> taskitemRepo) 
        { 
            _logger = logger;
            _taskitemRepo = taskitemRepo;
        }

        // Need to modify it 
        public async Task ProcessPendingOrdersAsync(CancellationToken ct)
        {
            //var orders = await _taskitemRepo.GetPendingAsync(ct);

            //foreach (var order in orders)
            //{
            //    order.Status = OrderStatus.Processed;
            //}

            //await _repository.SaveChangesAsync(ct);

            //_logger.LogInformation("Processed {Count} orders", orders.Count);

        }
    }
}
