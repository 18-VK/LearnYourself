using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.Services.Interfaces;

namespace TaskFlowStudio.Services
{
    class DataChangeTracker : IDataChangeTracker
    {
        private bool _hasChange;
        public bool HasChange => _hasChange;

        public void MakeChanged() => _hasChange = true;
        
        public void MakeClean() => _hasChange = false;
    }
}
