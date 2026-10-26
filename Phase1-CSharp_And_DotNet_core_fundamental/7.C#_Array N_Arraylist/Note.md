# Array in C#

An array in C# is a collection of elements of the same type stored in contiguous memory locations. Arrays are used to
store fixed-size sequential data.

## Key Characteristics

- Stores multiple values in a single variable.
- All elements must be of the same data type.
- Has a fixed size (cannot grow/shrink after initialization).
- Indexing starts at 0.
- Stored in heap memory.
- Derives from the `System.Array` class.

## Types of Arrays in C#

### 1. Single-Dimensional Array

```csharp
string[] fruits = { "Apple", "Banana", "Mango" };
Console.WriteLine(fruits[1]); // Output: Banana
```

### 2. Declaring a 2D Array

```csharp
int[,] arr = new int[2, 2];

arr[0, 0] = 1;
arr[0, 1] = 2;
arr[1, 0] = 3;
arr[1, 1] = 4;

Console.WriteLine(arr[1, 1]); // Output: 4
```

> A 2D array in C# is declared with a comma in the brackets: `int[,] arr = new int[2, 2];`

### 3. Multi-Dimensional Array (Rectangular Array)

```csharp
int[,] matrix = {
    {1, 2, 3},
    {4, 5, 6}
};

Console.WriteLine(matrix[1, 2]); // Output: 6
```

### 3. Jagged Array (Array of Arrays)

```csharp
int[][] jagged = new int[2][];
jagged[0] = new int[] { 1, 2 };
jagged[1] = new int[] { 3, 4, 5 };

Console.WriteLine(jagged[1][2]); // Output: 5
```

## Common Operations on Arrays

```csharp
Array.Sort(numbers);       // Sort the array
Array.Reverse(numbers);    // Reverse elements
int index = Array.IndexOf(numbers, 20);  // Search index
Array.Clear(numbers, 0, 2); // Clear first 2 elements
```

## Jagged vs Multi-Dimensional array

### Multi-Dimensional Array (Rectangular Array)

A multi-dimensional array in C# is an array where all rows have the same number of columns. It's typically used
for tables, grids, and matrices.

**Memory Layout**

- Stored in a single continuous block of memory.
- Elements are arranged row by row in memory.
- Cache-friendly (better performance for large arrays).

**Advantages**

- Simple structure
- Better performance for large data (cache locality)
- Easy for matrix operations

**Disadvantages**

- Cannot have rows of different lengths
- Difficult to resize dynamically

### Jagged Array (Array of Arrays)

A jagged array is an array of arrays, meaning each row is a separate array. Rows can have different lengths.

**Memory Layout**

- Each row is a separate object in memory.
- Non-contiguous memory → extra memory reference needed.

**Advantages**

- Flexible → Rows can have different lengths
- Saves memory when row sizes vary
- Easier for irregular data

**Disadvantages**

- Slightly slower due to extra memory references
- More complex to manage than rectangular arrays

## Mixing 1D and 2D arrays (Using `Array[]`)

```csharp
using System;

class Program
{
    static void Main()
    {
        Array[] jagged = new Array[2];

        jagged[0] = new int[] { 1, 2, 3 };           // 1D array
        jagged[1] = new int[,] { { 10, 20 }, { 30, 40 } }; // 2D array
    }
}
```

## Array class in C#

`Array` class in C# is part of the `System` namespace and provides methods for creating, searching, and sorting arrays. The
`Array` class is not part of the `System.Collections` namespace, but it is still considered as a collection because it is
based on the `IList` interface.

### Common Properties of Array

| Property       | Description |
|---------------|-------------|
| Length        | Total number of elements in all dimensions. |
| Rank          | Number of dimensions. |
| IsFixedSize   | true if array has a fixed size. |
| IsReadOnly    | true if array is read-only. |
| IsSynchronized| true if array is thread-safe. |

### Common Methods of Array

| Method                          | Description |
|--------------------------------|-------------|
| Sort(array)                   | Sorts the array in ascending order. |
| Reverse(array)                | Reverses the elements. |
| IndexOf(array, value)         | Returns the index of first occurrence. |
| LastIndexOf(array, value)     | Returns last occurrence index. |
| Copy(source, destination, length)| Copies elements from one array to another. |
| Clear(array, startIndex, length)| Sets a range of elements to the default value. |
| Resize(ref array, newSize)    | Changes the size of a 1D array. |
| BinarySearch(array, value)    | Searches for a value using binary search. |

## Detailed Examples for Each

### 1. Array Creation and Basic Properties

```csharp
int[] numbers = { 10, 20, 30, 40 };
Console.WriteLine("Length: " + numbers.Length); // 4
Console.WriteLine("Rank: " + numbers.Rank);     // 1 (1D array)
```

### 2. Sort an Array

```csharp
int[] nums = { 30, 10, 50, 20 };
Array.Sort(nums);
foreach (int n in nums) Console.Write(n + " "); // Output: 10 20 30 50
```

### 3. Reverse an Array

```csharp
Array.Reverse(nums);
foreach (int n in nums) Console.Write(n + " "); // Output: 50 30 20 10
```

### 4. Find Index of Element

```csharp
int index = Array.IndexOf(nums, 30);
Console.WriteLine("Index of 30: " + index);
```

### 5. Copy One Array to Another

```csharp
int[] source = { 1, 2, 3, 4, 5 };  
int[] destination = new int[5];
Array.Copy(source, destination, source.Length);
```

### 6. Clear Elements

```csharp
Array.Clear(destination, 1, 3);
```

### 7. Resize an Array

```csharp
Array.Resize(ref destination, 8);
```

### 8. Binary Search

```csharp
int[] sortedNums = { 10, 20, 30, 40, 50 };
int position = Array.BinarySearch(sortedNums, 30);
```

### 9. Multi-Dimensional Array Properties

```csharp
int[,] multiArray = { { 1, 2 }, { 3, 4 } };
Console.WriteLine("Length: " + multiArray.Length); // 4
Console.WriteLine("Rank: " + multiArray.Rank);     // 2
```

### 10. Clone an Array

```csharp
int[] original = { 1, 2, 3 };
int[] clone = (int[])original.Clone();
```

## Important Points

- ✔ `Array` is the base class, so you can use static methods without creating an instance.
- ✔ Arrays in C# are zero-based indexed.
- ✔ For performance-critical code, manual loops are sometimes faster than `Array` methods.

> **Note:** Go to this link for more details - <https://www.geeksforgeeks.org/c-sharp/c-sharp-array-class/>

# ArrayList in C# - Explanation, Constructors, and Examples

## What is ArrayList?

- A non-generic collection class in `System.Collections` namespace.
- Dynamic array that can store elements of any data type (heterogeneous).
- Allows duplicate elements.
- Provides index-based access.
- Legacy class; prefer `List<T>` for modern code.

## Syntax

```csharp
using System.Collections;
ArrayList list = new ArrayList();
```

### Initializer Example

```csharp
using System.Collections;

ArrayList list = new ArrayList() { 1, 4, 5, 5 };

foreach (var item in list)
    Console.WriteLine(item);
```

This creates an `ArrayList` with the values `1, 4, 5, 5` in order, and duplicate values are allowed.

## Constructors

### 1. `ArrayList()`

Initializes an empty `ArrayList` with default capacity.

**Example:**

```csharp
ArrayList list = new ArrayList();
list.Add(10);
list.Add("Hello");
```

### 2. `ArrayList(int capacity)`

Initializes an `ArrayList` with specified initial capacity.

**Example:**

```csharp
ArrayList list = new ArrayList(5);
list.Add(1);
list.Add(2);
Console.WriteLine("Capacity: " + list.Capacity); // Output: 5
```

### 3. `ArrayList(ICollection c)`

Initializes an `ArrayList` with elements copied from the specified collection.

**Example:**

```csharp
int[] arr = {1, 2, 3};
ArrayList list = new ArrayList(arr);
```

## Example Code (Default Constructor)

```csharp
using System;
using System.Collections;

class Program
{
    static void Main()
    {
        ArrayList list = new ArrayList();
        list.Add(10);
        list.Add("Hello");
        list.Add(3.14);

        Console.WriteLine("ArrayList Elements:");
        foreach (var item in list)
            Console.WriteLine(item);
    }
}
```

**Output:**

```text
ArrayList Elements:
10
Hello
3.14
```

## Common Methods

- **`Add(object value)`**: Adds an element to the `ArrayList`.
- **`AddRange(ICollection c)`**: Adds a collection to the `ArrayList`.
- **`Insert(int index, object value)`**: Inserts an element at the specified index.
- **`Remove(object obj)`**: Removes the first occurrence of the object.
- **`RemoveAt(int index)`**: Removes element at the given index.
- **`Sort()`**: Sorts elements in ascending order.
- **`Reverse()`**: Reverses the order of elements.
- **`Capacity`**: Gets/sets the capacity of `ArrayList`.
- **`Count`**: Gets the number of elements.

## Example Demonstrating Multiple Methods

```csharp
using System;
using System.Collections;

class Program
{
    static void Main()
    {
        ArrayList list = new ArrayList() { 10, 5, 20 };

        list.Add(15);
        list.Insert(1, 7);
        Console.WriteLine("After Insert:");
        foreach (var item in list) Console.Write(item + " ");  // 10 7 5 20 15

        list.Sort();
        Console.WriteLine("\nSorted:");
        foreach (var item in list) Console.Write(item + " ");  // 5 7 10 15 20

        list.Remove(10);
        Console.WriteLine("\nAfter Remove 10:");
        foreach (var item in list) Console.Write(item + " ");  // 5 7 15 20
    }
}
```

## Key Points

- Stores elements as `object` (boxing/unboxing occurs for value types).
- Use `List<T>` instead for type safety and better performance.
- Not thread-safe by default; use `ArrayList.Synchronized()` for thread safety.

## Comparison with `List<T>`

**ArrayList:**

- Non-generic
- Stores any type (boxing for value types)
- Slower for large datasets

**`List<T>`:**

- Generic (type-safe)
- No boxing for value types
- Better performance
