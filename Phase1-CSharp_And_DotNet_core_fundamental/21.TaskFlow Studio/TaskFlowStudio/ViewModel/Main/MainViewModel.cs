using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using TaskFlowStudio.Commands;
using TaskFlowStudio.ViewModel.Main;

namespace TaskFlowStudio.ViewModel
{
    internal class MainViewModel : ViewModelBase
    {
        public object AppLogo => Application.Current.Resources["TaskflowLogo"];

        // Left and right viewmodel of window 
        public MainLeftToolbarViewModel LeftToolbarVM { get; set; }
        public MainRightTaskListViewModel RightTaskListVM { get; set; }
       
        public MainViewModel(MainLeftToolbarViewModel LVM, MainRightTaskListViewModel RVM)
        {
            // setting them passed by DI 
            LeftToolbarVM = LVM;
            RightTaskListVM = RVM;

        }
    }
}
