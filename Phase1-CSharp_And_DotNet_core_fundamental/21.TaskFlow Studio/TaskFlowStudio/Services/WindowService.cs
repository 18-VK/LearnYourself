using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace TaskFlowStudio.Services
{
    public class WindowService : IWindowService
    {
        private readonly Dictionary<Type, Type> _windowVMMap;
        private readonly IServiceProvider _serviceProvider;

        private readonly Dictionary<Type, Window> _OpenedWindows = new ();
        
        public WindowService(Dictionary<Type, Type> map, IServiceProvider serviceProvider)
        {
            _windowVMMap = map;
            _serviceProvider = serviceProvider;
        }
        public void Show<TViewModel>(bool IsMain = false)
        {
            if(_OpenedWindows.TryGetValue(typeof(TViewModel), out var window))
            {
                window.Activate();
                return;
            }
            window = CreateWindow(typeof(TViewModel));
            // setting event to remove window from dictionary while closing it 
            window.Closed += (_, _) => _OpenedWindows.Remove(typeof(TViewModel));

            if (IsMain)
            {
                Application.Current.MainWindow = window;

                window.Closed += (_, __) =>
                {
                    Application.Current.Shutdown();
                };
            }

            _OpenedWindows.Add(typeof(TViewModel), window);
            window.Show();

        }

        public bool ShowDialog<TViewModel>()
        {
            if (_OpenedWindows.TryGetValue(typeof(TViewModel), out var window))
            {
                window.Activate();
                return true;
            }
            window = CreateWindow(typeof(TViewModel));
            // setting event to remove window from dictionary while closing it 
            window.Closed += (_, _) => _OpenedWindows.Remove(typeof(TViewModel));

            _OpenedWindows.Add(typeof(TViewModel), window);
            
            return window.ShowDialog() == true;
        }

        private Window CreateWindow(Type viewmodeltype)
        {
            if(!_windowVMMap.TryGetValue(viewmodeltype, out var _window))
            {
                throw new InvalidOperationException(
                $"No window registered for {viewmodeltype.Name}");
            }
            var scope = _serviceProvider.CreateScope();

            var viewmodel = scope.ServiceProvider.GetRequiredService(viewmodeltype);
            Window window = (Window)Activator.CreateInstance(_window)!;

            window.DataContext = viewmodel;

            var main = Application.Current.MainWindow;
            if (main != null && window != main)
            {
                window.Owner = main;
            }

            return window;
        }
    }
}
