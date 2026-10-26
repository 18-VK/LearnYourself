using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TaskFlowStudio
{
    public interface IMessageBusService
    {
        void Publish<T>(T message);
        void Subscribe<T>(Action<T> handler);
        void UnSubscribe<T>(Action<T> handler);
    }
}
