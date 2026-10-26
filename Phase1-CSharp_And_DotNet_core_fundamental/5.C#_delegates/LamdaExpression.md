# Lambda expressions — the shorthand for anonymous functions

A lambda expression is an inline anonymous function using `=>` (goes-to). It can be converted to delegates (`Action`,
`Func`, `Predicate`) or to expression trees (`Expression<Func<...>>`).

## Example

```csharp
// parameterless
() => Console.WriteLine("Hi");

// single parameter (parentheses optional)
x => x * x

// multiple parameters
(x, y) => x + y

// typed parameters (rarely needed because of type inference)
(int x, int y) => x + y

// statement lambda (multiple statements, explicit return)
(x, y) =>
{
    var sum = x + y;
    return sum;
}

// async lambda
async x => await DoSomethingAsync(x);
```
