using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Settings.Configuration;
using System.Configuration;
using System.Data;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.JavaScript;
using System.Windows;
using TaskFlowStudio;
using TaskFlowStudio.AppDataContext;
using TaskFlowStudio.Commands;
using TaskFlowStudio.Services;
using TaskFlowStudio.Services.Interfaces;
using TaskFlowStudio.Settings;
using TaskFlowStudio.View;
using TaskFlowStudio.ViewModel;
using TaskFlowStudio.ViewModel.Main;

namespace TaskFlowStudio
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    /// 
    public partial class App : Application
    {
        //
        // Summary:
        //     Raises the System.Windows.Application.Startup event.
        //
        // Parameters:
        //   e:
        //     A System.Windows.StartupEventArgs that contains the event data.

        private IHost _host = null!;
        protected override async void OnStartup(StartupEventArgs e)
        {
            
            base.OnStartup(e);

            _host = Host.CreateDefaultBuilder(e.Args)
                        .UseDefaultServiceProvider(options =>
                        {
                            options.ValidateScopes = true;
                            options.ValidateOnBuild = true; // 🔥 THIS is the key
                        })
                        .ConfigureAppConfiguration((ctx, cb) =>
                        {
                            cb.SetBasePath(AppContext.BaseDirectory)
                            .AddJsonFile("appsettings.json", optional: false,
                            reloadOnChange: true)
                            .AddEnvironmentVariables();
                        })
                        .ConfigureServices((context, services) => {
                            // Settings 
                            //services.Configure<ApplicationSettings>(context.Configuration.GetSection("ApplicationSettings"));

                            services.AddOptions<ApplicationSettings>()
                                .Bind(context.Configuration.GetSection("ApplicationSettings"))
                                .ValidateOnStart();

                            // db context
                            var connection = context.Configuration.GetConnectionString("DefaultConnection");
                            services.AddDbContext<AppDBContext>(option => option.UseSqlServer(connection));

                            // viewmodel
                            services.AddTransient<MainViewModel>();
                            services.AddTransient<AboutViewModel>();
                            services.AddTransient<SettingsViewModel>();
                            services.AddTransient<LiveMonitorViewModel>();
                            services.AddTransient<TaskEditViewModel>();
                            services.AddTransient<MainLeftToolbarViewModel>();
                            services.AddTransient<MainRightTaskListViewModel>();

                            // services
                            services.AddSingleton<IDataChangeTracker, DataChangeTracker>();
                            services.AddSingleton<IDialogService, DialogService>();
                            services.AddSingleton<IWindowService, WindowService>();
                            services.AddSingleton<IFileService, FileService>();
                            services.AddSingleton<IMessageBusService, MessageBusService>();
                            services.AddSingleton<IUIServices, UIServices>();

                            // repository and repo services
                            services.AddScoped(typeof(IRepository<>), typeof(EFRepositoryService<>));
                            services.AddScoped<ProjectService>();
                            services.AddScoped<TaskItemService>();

                            // model to view model mapping 
                            services.AddSingleton<Dictionary<Type, Type>>(D => new Dictionary<Type, Type>
                            {
                                {typeof(MainViewModel), typeof(MainWindow) },
                                {typeof(AboutViewModel), typeof(AboutWindow) },
                                {typeof(SettingsViewModel), typeof(SettingsWindow) },
                                {typeof(LiveMonitorViewModel), typeof(LiveMonitorWindow) },
                                {typeof(TaskEditViewModel), typeof(TaskEditWindow) }
                            });
                            // Background service 
                            services.AddHostedService<AutoSaveBackgroundService>();
                        })
                        .UseSerilog((context, services, configuration) => {
                            var appName = Assembly.GetEntryAssembly()!.GetName().Name;

                            configuration.ReadFrom.Configuration(context.Configuration)
                                        .ReadFrom.Services(services);
                        })
                        .Build();

            // in winform/ wpf should not await 
            try
            {
                _ = _host.StartAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.ToString(), "Host.StartAsync sync failure");
            }
            var _logger = _host.Services.GetRequiredService<ILogger<MainViewModel>>();
            _logger.LogInformation("Starting Main..");
            _logger.LogError("Error Starting Main..");

           

            // Start main window 
           var _windowservice = _host.Services.GetRequiredService<IWindowService>();
            _windowservice.Show<MainViewModel>(true);
        }
        protected override void OnExit(ExitEventArgs e)
        {
            if (_host != null)
            {
                // 🔥 Blocking is CORRECT here
                _host.StopAsync().GetAwaiter().GetResult();
                _host.Dispose();
            }
            base.OnExit(e);
        }

    }

}
