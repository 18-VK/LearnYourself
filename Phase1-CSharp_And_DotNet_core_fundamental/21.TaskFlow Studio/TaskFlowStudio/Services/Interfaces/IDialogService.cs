using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio
{
    public interface IDialogService
    {
        public void ShowDialog(string message, string title);

        public bool ShowConfirmationDialog(string message, string title);
    }
}
