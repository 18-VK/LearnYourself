using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio.Commands
{
    public class ViewModelBase : INotifyPropertyChanged, INotifyDataErrorInfo
    {
        public bool HasErrors => _errors.Count > 0;

        public event EventHandler<DataErrorsChangedEventArgs>? ErrorsChanged;

        private readonly Dictionary<string, List<string>> _errors = new();
        public IEnumerable GetErrors(string? propertyName)
        {
            // Get all error if not property provided
            if (string.IsNullOrEmpty(propertyName))
                return _errors.SelectMany(e => e.Value);

            return _errors.ContainsKey(propertyName) ? _errors[propertyName] : Enumerable.Empty<string>();
        }
        public void AddError(string errorMsg, [CallerMemberName] string? PropertyName = null)
        {
            if (PropertyName == null) return;

            if (!_errors.ContainsKey(PropertyName))
                _errors[PropertyName] = new List<string>();
            
            _errors[PropertyName].Add(errorMsg);
            OnErrorChanged(PropertyName);
        }
        public void ClearErrors([CallerMemberName] string? propertyName = null)
        {
            if (string.IsNullOrEmpty(propertyName))
                return;
            
            if (_errors.Remove(propertyName))
            {
                ErrorsChanged?.Invoke(this,new DataErrorsChangedEventArgs(propertyName));
            }
        }
        private void OnErrorChanged([CallerMemberName] string? name = null)
        {
            ErrorsChanged?.Invoke(this, new DataErrorsChangedEventArgs(name));
        }
        // INotifyPropertyChanged
        public event PropertyChangedEventHandler? PropertyChanged;

        public void OnPropertyChanged([CallerMemberName] string? name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }

    }
}
