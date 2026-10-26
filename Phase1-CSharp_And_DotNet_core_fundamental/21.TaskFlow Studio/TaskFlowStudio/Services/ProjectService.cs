using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.Model;

namespace TaskFlowStudio.Services
{

    public class ProjectService
    {
        private readonly ILogger<ProjectService> _logger;
        private readonly IRepository<Project> _projectRepo;

        public ProjectService(ILogger<ProjectService> logger, IRepository<Project> projectrepo)
        {
            _logger = logger;
            _projectRepo = projectrepo;
        }
    }
}
