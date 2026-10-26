using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio.Services.Interfaces
{
    public interface IUIServices
    {
        public IWindowService WindowsService { get;  }
        public IDialogService DialogsService { get; }
        public IFileService FilesService { get; }

    }
}
