/*
ref
----
Reference Parameter (Read & Write)
Passes a reference to the original variable.
The method can read and modify the original value.
The variable must be initialized before being passed.

out 
-----
Output Parameter (Write Only)
Also passes by reference.
Used to return multiple values from a method.
The variable does not need to be initialized before passing.
The method must assign a value to the out parameter

in 
--- 
Read-only Reference Parameter
Introduced in C# 7.2.
Passes by reference, but cannot be modified inside the method.
Improves performance for large structs.
Variable must be initialized before passing.

When to Use Each?
| Use Case                                    | Use   |
| ------------------------------------------- | ----- |
| Modify a passed variable                    | `ref` |
| Return multiple values from a method        | `out` |
| Pass large structs without copying          | `in`  |
| Pass data without risk of accidental change | `in`  |


ref vs out
----------
| Feature                          | `ref`                                 | `out`                                      |
| -------------------------------- | ------------------------------------- | ------------------------------------------ |
| **Initialization before use**    | ✅ Must be initialized before passing  | ❌ Does not need to be initialized          |
| **Initialization inside method** | ❌ Optional (can be modified)          | ✅ Mandatory (must assign before returning) |
| **Intent**                       | For both input & output (read/write)  | For output only (write only)               |
| **Readability in purpose**       | Less clear (can be used in many ways) | More clear: “this method will assign it”   |


*/
basic obj = new basic();
string name = "Aman";
obj.ExampleFuncRef(ref name);
Console.WriteLine(name);

int age ;
obj.ExampleFuncOut(out age);
Console.WriteLine(age);

long contact = 8346453643;
obj.ExampleFuncIn(contact);
Console.WriteLine(contact);

class basic
{
    public void ExampleFuncRef(ref string name)
    {
        name = "Aman kumar";
    }
    public void ExampleFuncOut(out int age)
    {
        age = 22;
    }
    public void ExampleFuncIn(in long contact)
    {
        if(contact > 0 )
        {
            Console.WriteLine("valid contact");
        }
        //contact = 8346453643; // changes won't reflect out of method.. despite having reference of contact, because it is a readonly variable
    }
}

