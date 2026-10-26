using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Update.Internal;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Threading;
using TaskFlowStudio.Commands;
using TaskFlowStudio.Services;
using TaskFlowStudio.Services.Interfaces;

namespace TaskFlowStudio.ViewModel.Main
{
    public class MainLeftToolbarViewModel : ViewModelBase
    {
        IUIServices UIServices { get; }
        ILogger _logger { get; }
        public ICommand ImportFile {  get; set; }
        public ICommand ExportFile { get; set; }
        public ICommand cmdLiveMonitor { get; set; }
        public ICommand cmdSetting { get; set; }

        public ICommand AddProject { get; set; }

        private ProjectService _projectService;
        private TaskItemService _taskitemService;

        private readonly DispatcherTimer _searchTimer;
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
                    if(_name != value)
                    {
                        _name = value;
                        OnPropertyChanged(nameof(Name));
                    }
                }
            }

        }
        private string? _SearchText;
        public string? SearchText
        {
            get => _SearchText;
            set
            {
                if (_SearchText != value)
                {
                    _SearchText = value;
                    OnPropertyChanged(nameof(SearchText));
                    // call function to search project name from lists
                    _searchTimer?.Stop();
                    _searchTimer?.Start();
                }
            }
        }
        public ObservableCollection<ProjectList>? ActiveProjects { get; set; }
        public ObservableCollection<ProjectList>? CompletedProjects { get; set; }

        public MainLeftToolbarViewModel(IUIServices UIservices, 
                                        ILogger<MainLeftToolbarViewModel> logger,
                                        ProjectService projectService,
                                        TaskItemService taskitemService) 
        {
            UIServices = UIservices;
            _logger = logger;

            ImportFile = new RelayCommand(ProcessImportFile);
            ExportFile = new RelayCommand(ProcessExportFile);

            cmdLiveMonitor = new RelayCommand(ShowLiveMonitor);
            cmdSetting = new RelayCommand(ShowSettingWidow);

            AddProject = new RelayCommand(ProcessAddProject);
            _projectService = projectService;
            _taskitemService = taskitemService;

            _searchTimer = new DispatcherTimer() { Interval = TimeSpan.FromMilliseconds(300) }; // 300ms waiting time

            _searchTimer.Tick += (_, __) =>
            {
                _searchTimer.Stop();
                // call apply serach
                ApplySearch();
            };
            // Update Initially 
            UpdateProjects();

        }

        // Functions 
        private void ProcessImportFile()
        {

            return;
        }
        private void ProcessExportFile()
        {

            return;
        }
        private void ShowLiveMonitor()
        {
            UIServices?.WindowsService.Show<LiveMonitorViewModel>();
        }
        private void ShowSettingWidow()
        {
            UIServices?.WindowsService.ShowDialog<SettingsViewModel>();
        }
        private void UpdateProjects()
        {
            if (ActiveProjects == null)
                ActiveProjects = new ObservableCollection<ProjectList>();

            if (CompletedProjects == null)
                CompletedProjects = new ObservableCollection<ProjectList>();

            ActiveProjects.Add(new ProjectList { IsCompleted = false, Name = "RAS Estamping" });
            ActiveProjects.Add(new ProjectList { IsCompleted = true, Name = "RAS Estamping 1" });


            CompletedProjects.Add(new ProjectList { IsCompleted = false, Name = "RAS Estamping 3" });
            CompletedProjects.Add(new ProjectList { IsCompleted = true, Name = "RAS Estamping 4" });

        }

        private void ProcessAddProject()
        {
            return;
        }
        private void ApplySearch()
        {
            return;
        }
    }
}
