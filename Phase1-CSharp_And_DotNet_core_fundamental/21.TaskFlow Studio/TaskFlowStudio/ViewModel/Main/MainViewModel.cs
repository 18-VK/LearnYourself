using System.Windows;
using TaskFlowStudio.Commands;
using TaskFlowStudio.ViewModel.Main;

namespace TaskFlowStudio.ViewModel
{
    public class MainViewModel : ViewModelBase
    {
        public object AppLogo => Application.Current.Resources["TaskflowLogo"];

        public MainLeftToolbarViewModel LeftToolbarVM { get; set; }
        public MainRightTaskListViewModel RightTaskListVM { get; set; }

        public MainViewModel(MainLeftToolbarViewModel lvm, MainRightTaskListViewModel rvm)
        {
            LeftToolbarVM = lvm;
            RightTaskListVM = rvm;
        }
    }
}
