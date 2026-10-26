using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio
{
    public interface IWindowService 
    {
        void Show<TViewModel>(bool isMain = false);
        bool ShowDialog<TViewModel>();
    }
}
