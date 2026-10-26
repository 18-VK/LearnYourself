using System;
using System.Windows.Input;

namespace TaskFlowStudio.Commands
{
    class RelayCommand : ICommand
    {
        private Action _Action;
        public event EventHandler? CanExecuteChanged;
        private Func<bool>? _canexecute;

        public RelayCommand(Action action, Func<bool>? canexecute = null) 
        {
            _Action = action ?? throw new ArgumentNullException(nameof(action));
            _canexecute = canexecute;
        }

        public void RaiseCanExecuteChanged()
        {
            CanExecuteChanged?.Invoke(this, EventArgs.Empty);
        }
        public bool CanExecute(object? parameter)
        {
            return _canexecute?.Invoke() ?? true;
        }

        public void Execute(object? parameter)
        {
            _Action();
        }
    }
}
