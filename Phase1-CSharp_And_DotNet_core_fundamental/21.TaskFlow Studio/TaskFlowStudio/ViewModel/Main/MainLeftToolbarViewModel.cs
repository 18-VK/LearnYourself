using Microsoft.Extensions.Logging;
using System.Collections.ObjectModel;
using System.Windows.Input;
using System.Windows.Threading;
using TaskFlowStudio.Commands;
using TaskFlowStudio.Services;
using TaskFlowStudio.Services.Interfaces;
using TaskFlowStudio.ViewModel;

namespace TaskFlowStudio.ViewModel.Main
{
    public class MainLeftToolbarViewModel : ViewModelBase
    {
        private readonly IUIServices _uiServices;
        private readonly ILogger<MainLeftToolbarViewModel> _logger;
        private readonly ProjectService _projectService;
        private readonly TaskItemService _taskItemService;
        private readonly DispatcherTimer _searchTimer;

        public ICommand ImportFile { get; set; }
        public ICommand ExportFile { get; set; }
        public ICommand cmdLiveMonitor { get; set; }
        public ICommand cmdSetting { get; set; }
        public ICommand AddProject { get; set; }

        public class ProjectList : ViewModelBase
        {
            private bool _isCompleted;
            public bool IsCompleted
            {
                get => _isCompleted;
                set
                {
                    if (_isCompleted != value)
                    {
                        _isCompleted = value;
                        OnPropertyChanged(nameof(IsCompleted));
                    }
                }
            }

            private string? _name;
            public string? Name
            {
                get => _name;
                set
                {
                    if (_name != value)
                    {
                        _name = value;
                        OnPropertyChanged(nameof(Name));
                    }
                }
            }
        }

        private string? _searchText;
        public string? SearchText
        {
            get => _searchText;
            set
            {
                if (_searchText != value)
                {
                    _searchText = value;
                    OnPropertyChanged(nameof(SearchText));
                    _searchTimer.Stop();
                    _searchTimer.Start();
                }
            }
        }

        public ObservableCollection<ProjectList> ActiveProjects { get; set; } = new();
        public ObservableCollection<ProjectList> CompletedProjects { get; set; } = new();

        public MainLeftToolbarViewModel(
            IUIServices uiServices,
            ILogger<MainLeftToolbarViewModel> logger,
            ProjectService projectService,
            TaskItemService taskItemService)
        {
            _uiServices = uiServices;
            _logger = logger;
            _projectService = projectService;
            _taskItemService = taskItemService;

            ImportFile = new RelayCommand(ProcessImportFile);
            ExportFile = new RelayCommand(ProcessExportFile);
            cmdLiveMonitor = new RelayCommand(ShowLiveMonitor);
            cmdSetting = new RelayCommand(ShowSettingWidow);
            AddProject = new RelayCommand(ProcessAddProject);

            _searchTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(300) };
            _searchTimer.Tick += (_, __) =>
            {
                _searchTimer.Stop();
                ApplySearch();
            };

            UpdateProjects();
        }

        private void ProcessImportFile()
        {
            _logger.LogInformation("Import file action triggered");
        }

        private void ProcessExportFile()
        {
            _logger.LogInformation("Export file action triggered");
        }

        private void ShowLiveMonitor()
        {
            _uiServices.WindowsService.Show<LiveMonitorViewModel>();
        }

        private void ShowSettingWidow()
        {
            _uiServices.WindowsService.ShowDialog<SettingsViewModel>();
        }

        private void UpdateProjects()
        {
            ActiveProjects.Clear();
            CompletedProjects.Clear();

            ActiveProjects.Add(new ProjectList { IsCompleted = false, Name = "RAS Estamping" });
            ActiveProjects.Add(new ProjectList { IsCompleted = false, Name = "Client Portal" });
            ActiveProjects.Add(new ProjectList { IsCompleted = false, Name = "Finance Ops" });

            CompletedProjects.Add(new ProjectList { IsCompleted = true, Name = "Launch Checklist" });
            CompletedProjects.Add(new ProjectList { IsCompleted = true, Name = "Marketing Assets" });
        }

        private void ProcessAddProject()
        {
            var projectName = string.IsNullOrWhiteSpace(SearchText)
                ? "New Project"
                : SearchText.Trim();

            ActiveProjects.Add(new ProjectList { IsCompleted = false, Name = projectName });
            SearchText = string.Empty;
        }

        private void ApplySearch()
        {
            if (string.IsNullOrWhiteSpace(SearchText))
            {
                UpdateProjects();
                return;
            }

            var term = SearchText.Trim();
            ActiveProjects = new ObservableCollection<ProjectList>(
                ActiveProjects.Where(x => x.Name != null && x.Name.Contains(term, StringComparison.OrdinalIgnoreCase))
            );
            CompletedProjects = new ObservableCollection<ProjectList>(
                CompletedProjects.Where(x => x.Name != null && x.Name.Contains(term, StringComparison.OrdinalIgnoreCase))
            );

            OnPropertyChanged(nameof(ActiveProjects));
            OnPropertyChanged(nameof(CompletedProjects));
        }
    }
}
