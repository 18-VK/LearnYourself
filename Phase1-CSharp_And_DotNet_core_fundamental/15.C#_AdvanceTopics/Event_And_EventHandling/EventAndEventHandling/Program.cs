using System;

// 1) custom EventArgs to carry data
public class TemperatureChangedEventArgs : EventArgs
{
    public double Old { get; }
    public double New { get; }
    public TemperatureChangedEventArgs(double oldTemp, double newTemp)
    {
        Old = oldTemp;
        New = newTemp;
    }
}

// 2) Publisher
public class TemperatureSensor
{
    private double _temp;
    // standard event pattern
    public event EventHandler<TemperatureChangedEventArgs>? TemperatureChanged;

    public double Temperature
    {
        get => _temp;
        set
        {
            if (Math.Abs(_temp - value) < 0.0001) return;
            var old = _temp;
            _temp = value;
            OnTemperatureChanged(old, _temp);
        }
    }

    // protected virtual so subclasses can override/extend behavior
    protected virtual void OnTemperatureChanged(double oldVal, double newVal)
    {
        // capture local copy for thread-safety
        var handler = TemperatureChanged;
        handler?.Invoke(this, new TemperatureChangedEventArgs(oldVal, newVal));
    }
}

// 3) Subscriber
public class Display
{
    public void Subscribe(TemperatureSensor sensor)
    {
        sensor.TemperatureChanged += Sensor_TemperatureChanged;
    }

    private void Sensor_TemperatureChanged(object? sender, TemperatureChangedEventArgs e)
    {
        Console.WriteLine($"Temp changed from {e.Old} to {e.New}");
    }
}
// Practice 1 
/*
  Create a class Clock with an event Ticked.
  Every second, raise the event.
  Create a subscriber that prints:
 */
class clock
{
    public event EventHandler? Tick;

    public void Start()
    {
        int i = 1;
        while (i <= 10)
        {
            Thread.Sleep(1000);
            OnTicked(); // Raise event
            i++;
        }
    }

    public void OnTicked()
    {
        Tick?.Invoke(this, EventArgs.Empty);
    }
}

class Clock_subscriber
{
    public void DoSubscribe(clock obj)
    {
        obj.Tick += DoPrintEvent;
    }
    public void DoPrintEvent(object? sender, EventArgs e)
    {
        Console.WriteLine("Tick received at: " + DateTime.Now);
    }
}
/* 
    Same TemperatureSensor, but add two handlers:

    Logger → prints to console
    AlertService → prints "WARNING" if temperature > 50
 */
public class TemperatureSensor2
{
    double _temp;
    public event EventHandler<TemperatureChangedEventArgs> TemperatureChanged;
    public event EventHandler<Double> Alert;

    public double Temperature
    {
        get => _temp;
        set
        {
            if (Math.Abs(_temp - value) < 0.0001) return;
            var old = _temp;
            _temp = value;
            OnTemperatureChanged(old, _temp);
        }
    }
   protected virtual void OnTemperatureChanged(double old, double New)
    {

        if (New > 30)
            Alert?.Invoke(this, New);
        else
            TemperatureChanged?.Invoke(this, new TemperatureChangedEventArgs(old, New));
    }

}
public class Display2
{
    public void Subscribe(TemperatureSensor2 sensor)
    {
        sensor.TemperatureChanged += Sensor_TemperatureChanged;
        sensor.Alert += Sensor_Alert;
    }

    private void Sensor_TemperatureChanged(object? sender, TemperatureChangedEventArgs e)
    {
        Console.WriteLine($"Temp changed from {e.Old} to {e.New}");
    }
    private void Sensor_Alert(object? sender, Double temperature)
    {
        Console.WriteLine($"Alert! Temperature has been exceeded to {temperature}");
    }
}

public class Program
{
    public static void Main(string[] args)
    {
        //var sensor = new TemperatureSensor();
        //var display = new Display();
        //display.Subscribe(sensor);

        //sensor.Temperature = 22.5;
        //sensor.Temperature = 23.0;

        //var clock = new clock();
        //var objSub = new Clock_subscriber();
      
        //objSub.DoSubscribe(clock);
        //clock.Start();

        var sensor = new TemperatureSensor2();
        var display = new Display2();
        display.Subscribe(sensor);

        sensor.Temperature = 22.5;
        sensor.Temperature = 30.5;
    }
}