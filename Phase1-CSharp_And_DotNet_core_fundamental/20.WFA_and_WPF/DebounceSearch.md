# What debouncing actually means

Debouncing = "wait until the user stops typing, then do the work once."

Instead of:

```text
t  → search
ta → search
tas → search
task → search
```

We want:

```text
task → search (only once)
```

## In WPF

```csharp
private readonly DispatcherTimer _searchTimer;

public MyViewModel()
{
    _searchTimer = new DispatcherTimer
    {
        Interval = TimeSpan.FromMilliseconds(300)
    };

    _searchTimer.Tick += (_, __) =>
    {
        _searchTimer.Stop();
        ApplySearch();
    };
}

private string? _searchText;
public string? SearchText
{
    get => _searchText;
    set
    {
        if (_searchText != value)
        {
            OnPropertyChanged(nameof(SearchText));
            _searchTimer.Stop();
            _searchTimer.Start();
        }
    }
}
```

🔍 **What happens internally (timeline)**

Let's say debounce interval = 300 ms.

**User types: `T`**

- `SearchText = "T"`
- Setter runs
- `_searchTimer.Stop()` → nothing to stop yet
- `_searchTimer.Start()` → timer scheduled for 300 ms

⏳ Waiting…

**User types quickly: `Ta` (before 300 ms)**

`SearchText = "Ta"`

- Setter runs again
- `_searchTimer.Stop()` → previous timer cancelled
- `_searchTimer.Start()` → new 300 ms countdown starts

⏳ Waiting again…

**User types: `Tas`**

Same thing happens:

- Old timer cancelled
- New timer started

⏳ Still waiting…

- User stops typing at `Task`
- No more setter calls.

⏱ 300 ms passes…

**Timer fires (Tick event)**

```csharp
_searchTimer.Tick += (_, __) =>
{
    _searchTimer.Stop();
    ApplySearch();
};
```

- ✅ Only NOW does `ApplySearch()` run
- ✅ Exactly one time

### Why Stop() before Start() is critical

This line is the entire debounce logic:

```csharp
_searchTimer.Stop();
_searchTimer.Start();
```

It means:

> "Cancel whatever was planned, and plan it again."

So as long as the user keeps typing:

- The timer never reaches `Tick`
- The search never runs

## In Winform

```csharp
private readonly Timer _searchTimer;

public Form1()
{
    InitializeComponent();

    _searchTimer = new Timer();
    _searchTimer.Interval = 300; // milliseconds
    _searchTimer.Tick += SearchTimer_Tick;
}
```

**TextBox TextChanged event**

```csharp
private void textBoxSearch_TextChanged(object sender, EventArgs e)
{
    _searchTimer.Stop();  // cancel previous
    _searchTimer.Start(); // restart countdown
}
```

**TextBox TextChanged event**

```csharp
private void textBoxSearch_TextChanged(object sender, EventArgs e)
{
    _searchTimer.Stop();  // cancel previous
    _searchTimer.Start(); // restart countdown
}
```

### How this works (timeline)

```text
User types → TextChanged
→ Timer stopped
→ Timer restarted

User types again quickly
→ Timer stopped
→ Timer restarted

User stops typing
⏱ 300ms passes
→ Tick fires
→ Search runs ONCE
```
