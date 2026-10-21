# C# Operators with Examples

## 1. Arithmetic Operators

| Operator | Description                |
| -------- | -------------------------- |
| `+`      | Addition (`5 + 3 = 8`)     |
| `-`      | Subtraction (`10 - 4 = 6`) |
| `*`      | Multiplication (`2 * 3 = 6`) |
| `/`      | Division (`10 / 2 = 5`)    |
| `%`      | Modulus (`7 % 3 = 1`)      |

**Example:**

```csharp
int a = 10, b = 3;
Console.WriteLine(a + b);  // 13
Console.WriteLine(a % b);  // 1
```

## 2. Relational / Comparison Operators

| Operator | Description                        |
| -------- | ---------------------------------- |
| `==`     | Equal to (`5 == 5` → true)         |
| `!=`     | Not equal to (`5 != 3` → true)     |
| `>`      | Greater than (`7 > 2` → true)      |
| `<`      | Less than (`4 < 8` → true)         |
| `>=`     | Greater or equal (`5 >= 5` → true) |
| `<=`     | Less or equal (`3 <= 2` → false)   |

**Example:**

```csharp
int x = 10, y = 20;
Console.WriteLine(x < y);  // True
```

## 3. Logical Operators

| Operator | Description                            |
| -------- | -------------------------------------- |
| `&&`     | Logical AND (`true && false` → false)  |
| `\|\|`   | Logical OR (`true \|\| false` → true)  |
| `!`      | Logical NOT (`!true` → false)          |

**Example:**

```csharp
bool a = true, b = false;
Console.WriteLine(a && b);  // False
Console.WriteLine(a || b);  // True
Console.WriteLine(!a);      // False
```

## 4. Assignment Operators

| Operator | Description                    |
| -------- | ------------------------------ |
| `=`      | Assign (`x = 10`)              |
| `+=`     | Add and assign (`x += 5`)      |
| `-=`     | Subtract and assign (`x -= 3`) |
| `*=`     | Multiply and assign (`x *= 2`) |
| `/=`     | Divide and assign (`x /= 2`)   |
| `%=`     | Modulo and assign (`x %= 3`)   |

**Example:**

```csharp
int x = 10;
x += 5;  // x = 15
Console.WriteLine(x);
```

## 5. Unary Operators

| Operator | Description         |
| -------- | ------------------- |
| `++`     | Increment (`x++`)   |
| `--`     | Decrement (`x--`)   |
| `+`      | Unary plus          |
| `-`      | Unary minus         |
| `!`      | NOT                 |

**Example:**

```csharp
int a = 5;
Console.WriteLine(a++);  // 5 (then a = 6)
Console.WriteLine(++a);  // 7
```

## 6. Bitwise Operators

| Operator | Description                  |
| -------- | ---------------------------- |
| `&`      | AND (`5 & 3` → 1)            |
| `\|`     | OR (`5 \| 3` → 7)            |
| `^`      | XOR (`5 ^ 3` → 6)            |
| `~`      | NOT (`~5` → -6)              |
| `<<`     | Left shift (`5 << 1` → 10)   |
| `>>`     | Right shift (`5 >> 1` → 2)   |

**Example:**

```csharp
int a = 5, b = 3;
Console.WriteLine(a & b);  // 1
Console.WriteLine(a | b);  // 7
```

## 7. Ternary Operator

```csharp
condition ? expr1 : expr2;
```

**Example:**

```csharp
int age = 20;
string result = (age >= 18) ? "Adult" : "Minor";
Console.WriteLine(result);  // Adult
```

## 8. Null-Coalescing Operators

| Operator | Description                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `??`     | Returns the left-hand operand if not null; otherwise right                                                                                        |
| `?.`     | Null-conditional access. This avoids `NullReferenceException` and is very useful for safe access to properties or methods of potentially null objects. |

**Example:**

```csharp
string name = null;
Console.WriteLine(name ?? "Default");  // Output: Default

obj?.MethodName(); // Safe call if obj is not null
```
