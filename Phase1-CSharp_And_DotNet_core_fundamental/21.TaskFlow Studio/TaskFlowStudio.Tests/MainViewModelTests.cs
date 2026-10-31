using System.Text;
using TaskFlowStudio.Model;
using TaskFlowStudio.Services;
using TaskFlowStudio.Services.Interfaces;
using TaskFlowStudio.ViewModel;
using TaskFlowStudio.ViewModel.Main;
using Xunit;

namespace TaskFlowStudio.Tests;

public class MainViewModelTests
{
    [Fact]
    public void MainViewModel_Should_Initialize_LeftAndRightViewModels()
    {
        var left = new MainLeftToolbarViewModel(
            new FakeUiServices(),
            new FakeLogger<MainLeftToolbarViewModel>(),
            new FakeProjectService(),
            new FakeTaskItemService());

        var right = new MainRightTaskListViewModel(
            new FakeUiServices(),
            new FakeLogger<MainRightTaskListViewModel>());

        var viewModel = new MainViewModel(left, right);

        Assert.NotNull(viewModel.LeftToolbarVM);
        Assert.NotNull(viewModel.RightTaskListVM);
        Assert.Same(left, viewModel.LeftToolbarVM);
        Assert.Same(right, viewModel.RightTaskListVM);
    }

    [Fact]
    public void MainLeftToolbarViewModel_Should_Load_Projects_On_Construction()
    {
        var vm = new MainLeftToolbarViewModel(
            new FakeUiServices(),
            new FakeLogger<MainLeftToolbarViewModel>(),
            new FakeProjectService(),
            new FakeTaskItemService());

        Assert.NotNull(vm.ActiveProjects);
        Assert.NotNull(vm.CompletedProjects);
        Assert.NotEmpty(vm.ActiveProjects);
        Assert.NotEmpty(vm.CompletedProjects);
    }

    private sealed class FakeUiServices : IUIServices
    {
        public IWindowService WindowsService => new FakeWindowService();
        public IDialogService DialogsService => new FakeDialogService();
        public IFileService FilesService => new FakeFileService();
    }

    private sealed class FakeWindowService : IWindowService
    {
        public void Show<TViewModel>(bool isMain = false) { }
        public bool ShowDialog<TViewModel>() => true;
    }

    private sealed class FakeDialogService : IDialogService
    {
        public void ShowDialog(string message, string title) { }
        public bool ShowConfirmationDialog(string message, string title) => true;
    }

    private sealed class FakeFileService : IFileService
    {
        public string? OpenFileDialog(string Filter, string Title, string InitialDirectory = "") => null;
        public Task<string?> SaveFileAsync(string defaultFileName, string filter, string title, byte[] buffer, Encoding encoding, CancellationToken cancellationToken = default) => Task.FromResult<string?>(null);
        public string? BrowseFolder(string InitialDirectory, string Title) => null;
        public List<string> BrowseFolders(string InitialDirectory, string Title) => new();
    }

    private sealed class FakeProjectService : ProjectService
    {
        public FakeProjectService() : base(new FakeLogger<ProjectService>(), new FakeRepository<Project>()) { }
    }

    private sealed class FakeTaskItemService : TaskItemService
    {
        public FakeTaskItemService() : base(new FakeLogger<TaskItemService>(), new FakeRepository<TaskItem>()) { }
    }

    private sealed class FakeRepository<T> : IRepository<T> where T : class
    {
        public Task<T?> GetByID(long Id) => Task.FromResult<T?>(null);
        public Task Add(T entity) => Task.CompletedTask;
        public void Update(T entity) { }
        public void Remove(T entity) { }
        public Task<IReadOnlyList<T>> GetAll() => Task.FromResult<IReadOnlyList<T>>(Array.Empty<T>());
        public Task<int> Save() => Task.FromResult(0);
    }

    private sealed class FakeLogger<T> : Microsoft.Extensions.Logging.ILogger<T>
    {
        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;
        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => false;
        public void Log<TState>(Microsoft.Extensions.Logging.LogLevel logLevel, Microsoft.Extensions.Logging.EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) { }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }
}
