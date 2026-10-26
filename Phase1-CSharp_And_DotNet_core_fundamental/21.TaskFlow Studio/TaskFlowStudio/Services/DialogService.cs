using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace TaskFlowStudio.Services
{
    class DialogService : IDialogService
    {
        public bool ShowConfirmationDialog(string message, string title)
        {
            return( MessageBox.Show(message, title, MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes);
        }

        public void ShowDialog(string message, string title)
        {
            MessageBox.Show(message, title, MessageBoxButton.OK,MessageBoxImage.Information);
        }
    }
}
