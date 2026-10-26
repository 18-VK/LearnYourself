using System;
using System.Windows.Input;

namespace TaskFlowStudio.Commands
{
    public class RelayCommand<T> : ICommand
    {
        private Action<T> _Action;
        public event EventHandler? CanExecuteChanged;
        private Predicate<T> _canexecute;
        public RelayCommand(Action<T> action, Predicate<T> canexecute)
        {
            _Action = action;
            _canexecute = canexecute;
        }
        public bool CanExecute(object? parameter)
        {
            if (_canexecute == null) return true;
            return parameter == null && typeof(T).IsValueType == false
                ? _canexecute(default!)
                : _canexecute((T)parameter!);
        }

        public void Execute(object? parameter)
        {
            _Action((T)parameter!);                        
        }

        public void RaiseCanExecuteChanged()
        {
            CanExecuteChanged?.Invoke(this, EventArgs.Empty);
        }
    }
}
