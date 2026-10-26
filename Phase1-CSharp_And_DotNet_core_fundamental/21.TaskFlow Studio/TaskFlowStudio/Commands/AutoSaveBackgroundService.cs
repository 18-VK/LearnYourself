using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using TaskFlowStudio.Services;
using TaskFlowStudio.Settings;

namespace TaskFlowStudio.Commands
{
    public class AutoSaveBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AutoSaveBackgroundService> _logger;
        private readonly IMessageBusService _bus;
        private readonly int _intervalInSeconds; 
        public AutoSaveBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<AutoSaveBackgroundService> logger,
            IMessageBusService bus,
            IOptions<ApplicationSettings> AppSettings)// Need to create a class for getting appsettings for applicationsetting
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _intervalInSeconds = AppSettings.Value.AutoSaveIntervalSeconds;
            _bus = bus;
        }
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {

                    //using( var _scope = _scopeFactory.CreateScope())
                    //{
                    //    var _repo = _scope.ServiceProvider.GetRequiredService<TaskItemService>();

                    //    await _repo.ProcessPendingOrdersAsync(stoppingToken);

                    //}
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AutoSave failed");
                }

                await Task.Delay(TimeSpan.FromSeconds(_intervalInSeconds),stoppingToken);
            }
        }
    }
}
