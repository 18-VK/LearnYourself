/**
 * C# shown in the desktop visualizers' code panels, copied verbatim from the WPF notes. The content
 * pipeline checks every string below still appears in a fenced block of its note (verbatim.ts), so the
 * code panel can never drift from the notes. Indentation is kept as in the note; `dedent` is applied
 * only when the panel displays it.
 */

export const WPF = 'Phase1-CSharp_And_DotNet_core_fundamental/20.WFA_and_WPF/WPF_Tutorial';

/** 4.MVVMandDataBindings.md › "## Example how to setup things" › MainViewModel (Name and Status). */
export const BINDING_VM = `        public string Name
        {
            get => _name;
            set
            {
                if (_name == value) return;
                _name = value;
                OnPropertyChanged();
                Status = $"Name changed to: {_name}";
            }
        }

        public string Status
        {
            get => _status;
            set
            {
                if (_status == value) return;
                _status = value;
                OnPropertyChanged();
            }
        }`;

/** 5.RelayCommandNOther.md › "## Example : Manual RelayCommand (PURE MVVM)…" › 2. ViewModel. */
export const COMMAND_VM = `    private Transaction _selectedTransaction;
    public Transaction SelectedTransaction
    {
        get => _selectedTransaction;
        set
        {
            _selectedTransaction = value;
            OnPropertyChanged();

            // 🔥 Explicitly notify command
            DeleteCommand.RaiseCanExecuteChanged();
        }
    }

    public RelayCommand DeleteCommand { get; }

    public TransactionViewModel()
    {
        Transactions.Add(new Transaction { Id = 1, Category = "Food", Amount = 200 });
        Transactions.Add(new Transaction { Id = 2, Category = "Salary", Amount = 50000 });

        DeleteCommand = new RelayCommand(Delete, CanDelete);
    }

    private bool CanDelete()
        => SelectedTransaction != null;

    private void Delete()
    {
        Transactions.Remove(SelectedTransaction);
        SelectedTransaction = null;
    }`;

/** Same section › 1. Relay command (manual CanExecuteChanged). */
export const COMMAND_RELAY = `public class RelayCommand : ICommand
{
    private readonly Action _execute;
    private readonly Func<bool> _canExecute;

    public RelayCommand(Action execute, Func<bool> canExecute = null)
    {
        _execute = execute;
        _canExecute = canExecute;
    }

    public bool CanExecute(object parameter)
        => _canExecute == null || _canExecute();

    public void Execute(object parameter)
        => _execute();

    public event EventHandler CanExecuteChanged;

    public void RaiseCanExecuteChanged()
        => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}`;

/** 5.RelayCommandNOther.md › "## 6️⃣ Real example (your case)" › When selection changes. */
export const COMMAND_CM_VM = `public Transaction SelectedTransaction
{
    get => _selectedTransaction;
    set
    {
        _selectedTransaction = value;
        OnPropertyChanged();
        CommandManager.InvalidateRequerySuggested();
    }
}`;

/** Same section › ViewModel (the CanExecute lambda). */
export const COMMAND_CM_CREATE = `DeleteSelectedCommand =
    new RelayCommand(DeleteSelected, () => SelectedTransaction != null);`;

/** 5.RelayCommandNOther.md › "## Why do we call InvalidateRequerySuggested()?" */
export const COMMAND_AUTO = `public Transaction SelectedTransaction { get; set; }`;

/** 5.RelayCommandNOther.md › "## 4️⃣ Where does CommandManager fit in MVVM?" */
export const COMMAND_CM_EVENT = `public event EventHandler CanExecuteChanged
{
    add    { CommandManager.RequerySuggested += value; }
    remove { CommandManager.RequerySuggested -= value; }
}`;

/** 20.WFA_and_WPF/DebounceSearch.md › "## In WPF". */
export const DEBOUNCE_WPF = `private readonly DispatcherTimer _searchTimer;

public MyViewModel()
{
    _searchTimer = new DispatcherTimer
    {
        Interval = TimeSpan.FromMilliseconds(300)
    };

    _searchTimer.Tick += (_, __) =>
    {
        _searchTimer.Stop();
        ApplySearch();
    };
}

private string? _searchText;
public string? SearchText
{
    get => _searchText;
    set
    {
        if (_searchText != value)
        {
            OnPropertyChanged(nameof(SearchText));
            _searchTimer.Stop();
            _searchTimer.Start();
        }
    }
}`;

/** Removes the indentation every non-blank line shares (display only; line numbers are unchanged). */
export function dedent(code: string): string {
  const lines = code.split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
  return lines.map((l) => l.slice(pad)).join('\n');
}
