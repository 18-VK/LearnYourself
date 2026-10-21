using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio.Services.Interfaces
{
    public interface IDataChangeTracker
    {
        bool HasChange { get; }

        void MakeChanged();
        void MakeClean();
    }
}
