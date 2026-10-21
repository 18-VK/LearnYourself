# Events and Event Handling in C#

In C#, events and event handling provide a mechanism for objects to notify other objects about specific
occurrences or changes in their state, enabling a decoupled, publisher-subscriber model.

# Events

- An event is a way for a class (the "publisher") to provide notifications to other classes (the "subscribers") when something interesting happens to an object of that class.

- Events are declared using the `event` keyword and are essentially encapsulated delegates. The delegate defines the signature of the event handler method that subscribers must implement.

- The `event` keyword restricts how the delegate can be accessed, primarily allowing only subscription (`+=`) and unsubscription (`-=`) by external code.

Here is the standard event syntax in C#, covering declaration, subscription, invocation, and custom accessors.

## Standard Declaration

The most common pattern uses the built-in `EventHandler` delegate. You must declare the delegate type (or use `EventHandler`) before declaring the event with the `event` keyword.

```csharp
// 1. Define the delegate (optional if using standard EventHandler)
public delegate void MyHandler(object sender, EventArgs e);

public class Publisher
{
    // 2. Declare the event
    // Standard pattern:
    public event EventHandler MyEvent; 
    
    // Custom delegate pattern:
    // public event MyHandler MyCustomEvent; 
    // syntax : event <delegate> <eventName>
}
```

# Event Handlers

- An event handler is a method that responds to an event. It contains the code to be executed when the event is raised.
- Event handlers are typically `void` methods that take two parameters:
  - `object sender`: The object that raised the event (the publisher).
  - `EventArgs e` (or a derived type): An object containing data related to the event. `EventArgs` is the base
    class for all event data classes; specialized classes like `MouseEventArgs` or custom `MyCustomEventArgs` can
    be derived from it to carry specific information.

`EventHandler` and `EventHandler<T>` are predefined delegate types provided by .NET.

They enforce a standard event signature:

- `object sender` → the source of the event.
- `EventArgs` (or `T : EventArgs`) → additional data about the event.

This makes events consistent across the .NET ecosystem.

**Example with `EventHandler`:**

```csharp
public class Worker
{
    public event EventHandler WorkCompleted;

    public void DoWork()
    {
        WorkCompleted?.Invoke(this, EventArgs.Empty);
    }
}
```

**Example with `EventHandler<T>`:**

```csharp
public class WorkEventArgs : EventArgs
{
    public string Message { get; set; }
}

public class Worker
{
    public event EventHandler<WorkEventArgs> WorkCompleted;

    public void DoWork()
    {
        WorkCompleted?.Invoke(this, new WorkEventArgs { Message = "Work finished!" });
    }
}
```

# How it works (Publisher-Subscriber Model)

- **Publisher:** A class declares an event using a delegate type. It also provides a method (often named
  `On<EventName>`) to raise thect interested in the event creates an event handler method matching the delegate's
  signature.
- **Subscription:** The subscriber registers its event handler with the publisher's event using the `+=` operator.
- **Event Raising:** When the publisher's `On<EventName>` method is called, it invokes the event, which in turn calls
  all registered event handlers.
- **Unsubscription:** Subscribers can also detach their event handlers using the `-=` operator when they no longer
  need to receive notifications.

**Example: using standard event pattern**

```csharp
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
    public event EventHandler<TemperatureChangedEventArgs>? TemperatureChanged; // this is the event

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
        handler?.Invoke(this, new TemperatureChangedEventArgs(oldVal, newVal)); // raise the event
    }
}

// 3) Subscriber
public class Display
{
    public void Subscribe(TemperatureSensor sensor)
    {
        sensor.TemperatureChanged += Sensor_TemperatureChanged;
    }

    private void Sensor_TemperatureChanged(object? sender, TemperatureChangedEventArgs e) // this is the event handler
    {
        Console.WriteLine($"Temp changed from {e.Old} to {e.New}");
    }
}

public class Program
{
    public static void Main(string[] args)
    {
        var sensor = new TemperatureSensor(); //Publisher
        var display = new Display(); // subscriber
        display.Subscribe(sensor);

        sensor.Temperature = 22.5; // publishing new data
        sensor.Temperature = 23.0; // publishing new data
    }
}
```

**Example 2: using delegate**

```csharp
using System;

// 1. Define a delegate for the event
public delegate void ButtonClickHandler(object sender, EventArgs e);

public class Button
{
    // 2. Declare an event using the delegate
    public event ButtonClickHandler Click;

    // 3. Method to raise the event
    public void SimulateClick()
    {
        Console.WriteLine("Button is being clicked...");
        // Check if there are any subscribers before raising the event
        Click?.Invoke(this, EventArgs.Empty); 
    }
}

public class Program
{
    public static void Main(string[] args)
    {
        Button myButton = new Button();

        // 4. Subscribe an event handler
        myButton.Click += MyButton_Click;

        // 5. Simulate the event
        myButton.SimulateClick();

        // 6. Unsubscribe the event handler
        myButton.Click -= MyButton_Click;

        // Simulate again, no output from handler
        myButton.SimulateClick(); 
    }

    // 4. Event handler method
    private static void MyButton_Click(object sender, EventArgs e)
    {
        Console.WriteLine("Button was clicked! (Handler executed)");
    }
}
```

# Best-practice patterns

- Use `EventHandler` or `EventHandler<TEventArgs>` for public events. Provide a `protected virtual OnXxx(...)` method to raise the event — allows derived classes to override/augment raising logic.
- Copy the delegate locally before invoking to avoid race conditions: `var h = Event; h?.Invoke(...)`.
- Keep `EventArgs` immutable and small (avoid passing heavy objects).
- Avoid raising events inside locks since handlers may run user code that blocks or throws.
- Document when events are raised (threading context — UI thread? background?).

# Unsubscribe and memory leaks

- If subscriber lifetime < publisher lifetime, unsubscribe or keep weak references. Otherwise you leak subscriber.
- Typical fix: unsubscribe in `Dispose`, or use weak-event pattern / `WeakReference`.
- Example: UI controls that subscribe to long-lived services must unsubscribe on disposal.

# Multicast and ordering

- Events are multicast; multiple handlers run in order they were added (but don't rely on order).
- If one handler throws, it will stop further handlers unless you handle exceptions. Libraries often iterate
  handlers manually to isolate exceptions.
