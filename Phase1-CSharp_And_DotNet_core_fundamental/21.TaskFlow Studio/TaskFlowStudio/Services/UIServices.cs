using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TaskFlowStudio.Services.Interfaces;

namespace TaskFlowStudio.Services
{
    public class UIServices : IUIServices
    {
        public IWindowService WindowsService { get; }
        public IDialogService DialogsService { get; }
        public IFileService FilesService { get; }

        public UIServices(IWindowService windowsService, IDialogService dialogsService, IFileService filesService)
        {
            WindowsService = windowsService;
            DialogsService = dialogsService;
            FilesService = filesService;
        }
    }
}
