# Project structure

```text
WpfApp
│
├── Models
│   └── Transaction.cs
│
├── Services
│   ├── ITransactionService.cs
│   └── TransactionService.cs
│
├── Commands
│   └── RelayCommand.cs
│
├── ViewModels
│   └── TransactionViewModel.cs
│
├── MainWindow.xaml
└── MainWindow.xaml.cs
```

## 1️⃣ Model – Transaction.cs

```csharp
namespace WpfApp.Models;

public class Transaction
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string Category { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; }
}
```

```csharp
namespace WpfApp.Models;
```

## 2️⃣ Service (DB simulation)

**ITransactionService.cs**

```csharp
using WpfApp.Models;

namespace WpfApp.Services;

public interface ITransactionService
{
    List<Transaction> GetAll();
    void Delete(int id);
}
```

**TransactionService.cs**

```csharp
using WpfApp.Models;

namespace WpfApp.Services;

public class TransactionService : ITransactionService
{
    private readonly List<Transaction> _data = new()
    {
        new Transaction { Id=1, Date=DateTime.Today, Category="Food", Amount=200, Type="Expense" },
        new Transaction { Id=2, Date=DateTime.Today, Category="Salary", Amount=50000, Type="Income" },
        new Transaction { Id=3, Date=DateTime.Today, Category="Travel", Amount=1500, Type="Expense" }
    };

    public List<Transaction> GetAll() => _data.ToList();

    public void Delete(int id)
    {
        var item = _data.FirstOrDefault(x => x.Id == id);
        if (item != null)
            _data.Remove(item);
    }
}
```

## 3️⃣ RelayCommand (non-generic + generic)

**RelayCommand.cs**

👉 Used by: `LoadCommand`, `DeleteSelectedCommand`

```csharp
using System;
using System.Windows.Input;

namespace WpfApp.Commands;

public class RelayCommand : ICommand
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

    // Instead of this manually raising, suggested, check file 5.RelayCommandNOther.md
    public event EventHandler CanExecuteChanged
    {
        add => CommandManager.RequerySuggested += value;
        remove => CommandManager.RequerySuggested -= value;
    }
}
```

👉 Used by: `DeleteItemCommand`

```csharp
public class RelayCommand<T> : ICommand
{
    private readonly Action<T> _execute;

    public RelayCommand(Action<T> execute)
    {
        _execute = execute;
    }

    public bool CanExecute(object parameter) => true;

    public void Execute(object parameter)
        => _execute((T)parameter);

    public event EventHandler CanExecuteChanged
    {
        add => CommandManager.RequerySuggested += value;
        remove => CommandManager.RequerySuggested -= value;
    }
}
```

## 4️⃣ ViewModel – your class completed

**TransactionViewModel.cs**

```csharp
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using WpfApp.Commands;
using WpfApp.Models;
using WpfApp.Services;

namespace WpfApp.ViewModels;

public class TransactionViewModel : INotifyPropertyChanged
{
    private readonly ITransactionService _service;

    public ObservableCollection<Transaction> Transactions { get; } = new();

    private Transaction _selectedTransaction;
    public Transaction SelectedTransaction
    {
        get => _selectedTransaction;
        set
        {
            _selectedTransaction = value;
            OnPropertyChanged();
            CommandManager.InvalidateRequerySuggested();}
    }

    public ICommand LoadCommand { get; }
    public ICommand DeleteSelectedCommand { get; }
    public ICommand DeleteItemCommand { get; }

    public TransactionViewModel()
    {
        _service = new TransactionService();

        LoadCommand = new RelayCommand(Load);
        DeleteSelectedCommand = new RelayCommand(DeleteSelected, () => SelectedTransaction != null);
        DeleteItemCommand = new RelayCommand<Transaction>(DeleteItem);

        Load();
    }

    private void Load()
    {
        Transactions.Clear();
        foreach (var t in _service.GetAll())
            Transactions.Add(t);

        CommandManager.InvalidateRequerySuggested();
    }

    private void DeleteSelected()
    {
        _service.Delete(SelectedTransaction.Id);
        Transactions.Remove(SelectedTransaction);
    }

    private void DeleteItem(Transaction t)
    {
        _service.Delete(t.Id);
        Transactions.Remove(t);
    }

    public event PropertyChangedEventHandler PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
```

## 5️⃣ View – MainWindow.xaml

```xml
<Window x:Class="WpfApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="clr-namespace:WpfApp.ViewModels"
        Title="Transactions" Height="350" Width="650">

    <Window.DataContext>
        <vm:TransactionViewModel/>
    </Window.DataContext>

    <DockPanel Margin="10">

        <!-- Top buttons -->
        <StackPanel DockPanel.Dock="Top"
                    Orientation="Horizontal"
                    Margin="0,0,0,10">
            <Button Content="Refresh"
                    Width="100"
                    Command="{Binding LoadCommand}" />

            <Button Content="Delete Selected"
                    Width="120"
                    Margin="10,0,0,0"
                    Command="{Binding DeleteSelectedCommand}" />
        </StackPanel>

        <!-- DataGrid -->
        <DataGrid ItemsSource="{Binding Transactions}"
                  SelectedItem="{Binding SelectedTransaction}"
                  AutoGenerateColumns="False"
                  IsReadOnly="True">

            <DataGrid.Columns>
                <DataGridTextColumn Header="Date" Binding="{Binding Date}" />
                <DataGridTextColumn Header="Category" Binding="{Binding Category}" />
                <DataGridTextColumn Header="Amount" Binding="{Binding Amount}" />
                <DataGridTextColumn Header="Type" Binding="{Binding Type}" />

                <!-- Row delete button -->
                <DataGridTemplateColumn Header="Action">
                    <DataGridTemplateColumn.CellTemplate>
                        <DataTemplate>
                            <Button Content="Delete"
                                    Command="{Binding DataContext.DeleteItemCommand,
                                              RelativeSource={RelativeSource AncestorType=DataGrid}}"
                                    CommandParameter="{Binding}" />
                        </DataTemplate>
                    </DataGridTemplateColumn.CellTemplate>
                </DataGridTemplateColumn>

            </DataGrid.Columns>
        </DataGrid>

    </DockPanel>
</Window>
```

## 6️⃣ Code-behind – NO business logic

**MainWindow.xaml.cs**

```csharp
namespace WpfApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        // No need to set datacontext as already done in xaml 
    }
}
```

# What this project demonstrates (important)

- ✔ Pure MVVM
- ✔ No logic in code-behind
- ✔ DataGrid with SelectedItem
- ✔ Button → RelayCommand
- ✔ Row-level command using RelativeSource
- ✔ Real-world service abstraction

# Flow summary

```text
Button Click
   ↓
RelayCommand.Execute
   ↓
ViewModel method
   ↓
Service (DB)
   ↓
ObservableCollection updates
   ↓
DataGrid refreshes automatically
```

# If you want next, I can:

- Replace service with EF Core + SQL Server
- Add async loading
- Add paging / scrolling
- Add search + filter
- Convert to Production MVVM folder structure
