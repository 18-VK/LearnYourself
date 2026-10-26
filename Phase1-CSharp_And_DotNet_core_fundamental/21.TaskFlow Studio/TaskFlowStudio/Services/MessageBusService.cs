using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace TaskFlowStudio.Services
{
    public class MessageBusService: IMessageBusService
    {
        private Dictionary<Type, List<Delegate>> _TypeHanldesMap = new();

        private object _lock = new object();
        public void Publish<T>(T message)
        {
            List<Delegate>? Subscribers = new();

            lock(_lock)
            {
                if (!_TypeHanldesMap.TryGetValue(typeof(T), out Subscribers))
                    return;

                Subscribers = Subscribers.ToList();
            }
            foreach(var sub in Subscribers.Cast<Action<T>>())
            {
                sub(message); // Invoke
            }
        }

        public void Subscribe<T>(Action<T> handler)
        {
            var Type = typeof(T);
            List<Delegate>? Subscribers;

            lock (_lock)
            {
                if (!_TypeHanldesMap.TryGetValue(Type, out Subscribers))
                {
                    Subscribers = new List<Delegate>();
                    _TypeHanldesMap[Type] = Subscribers;
                }
                Subscribers.Add(handler);   
            }
        }


        public void UnSubscribe<T>(Action<T> handler)
        {
            var Type = typeof(T);
            List<Delegate>? Subscribers;

            lock(_lock)
            {
                if (!_TypeHanldesMap.TryGetValue(Type, out Subscribers))
                    return;
                Subscribers.Remove(handler);
            }
        }
    }
}
