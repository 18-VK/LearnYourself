using Microsoft.Extensions.Logging;
using System.Collections.ObjectModel;
using System.Windows.Input;
using TaskFlowStudio.Commands;
using TaskFlowStudio.Services.Interfaces;

namespace TaskFlowStudio.ViewModel.Main
{
    public class MainRightTaskListViewModel : ViewModelBase
    {
        public record Filter(int Id, string FilterName);

        public record TaskRow(
            string Title,
            string Description,
            DateTime DueDate,
            string Priority,
            string Status,
            DateTime CreatedAt,
            DateTime UpdatedAt);

        private readonly IUIServices _uiServices;
        private readonly ILogger<MainRightTaskListViewModel> _logger;

        public List<Filter> TaskFilter { get; set; }
        public ObservableCollection<TaskRow> TaskDetails { get; set; } = new();

        public string CurrentProject { get; set; } = "All tasks";
        public DateTime LastUpdated { get; set; } = DateTime.Now;
        public string? SelectedFilter { get; set; }
        public ICommand AddNewTask { get; set; }

        public MainRightTaskListViewModel(IUIServices uiServices, ILogger<MainRightTaskListViewModel> logger)
        {
            _uiServices = uiServices;
            _logger = logger;

            TaskFilter = new List<Filter>
            {
                new(1, "All"),
                new(2, "High Priority"),
                new(3, "Due This Week"),
                new(4, "Completed")
            };

            SelectedFilter = "All";
            AddNewTask = new RelayCommand(ProcessAddNewTask);

            LoadSampleTasks();
        }

        private void LoadSampleTasks()
        {
            TaskDetails.Clear();
            TaskDetails.Add(new TaskRow(
                "Finalize dashboard", "Review chart layouts and reconcile data labels.",
                DateTime.Today.AddDays(2), "High", "In Progress",
                DateTime.Today.AddDays(-3), DateTime.Now.AddHours(-2)));
            TaskDetails.Add(new TaskRow(
                "Prepare sprint demo", "Gather QA notes and final backlog highlights.",
                DateTime.Today.AddDays(1), "Medium", "Pending",
                DateTime.Today.AddDays(-5), DateTime.Now.AddHours(-5)));
            TaskDetails.Add(new TaskRow(
                "Team sync", "Discuss blockers and confirm delivery timeline.",
                DateTime.Today.AddDays(4), "Low", "Completed",
                DateTime.Today.AddDays(-7), DateTime.Now.AddHours(-12)));

            LastUpdated = DateTime.Now;
        }

        private void ProcessAddNewTask()
        {
            TaskDetails.Add(new TaskRow(
                "New task",
                "Describe the task details here.",
                DateTime.Today.AddDays(3),
                "Medium",
                "Pending",
                DateTime.Now,
                DateTime.Now));

            LastUpdated = DateTime.Now;
            _logger.LogInformation("New task added");
        }
    }
}
