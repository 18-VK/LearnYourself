using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.Commands;
using TaskFlowStudio.Services;
using TaskFlowStudio.Services.Interfaces;

namespace TaskFlowStudio.ViewModel.Main
{
    public class MainRightTaskListViewModel : ViewModelBase
    {
        public record Filter(int Id, string filtername);

        public List<Filter> TaskFilter { get; set; }

        IUIServices UIServices { get; }

        ILogger _logger { get; }

        public MainRightTaskListViewModel(IUIServices UIservices, ILogger<MainRightTaskListViewModel> logger)
        {

            UIServices = UIservices;
            _logger = logger;

            TaskFilter = new List<Filter>();
            TaskFilter.Add(new Filter(1, "aman"));
            TaskFilter.Add(new Filter(2, "chaman"));
        }
    }
}
