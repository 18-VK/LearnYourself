StudentDetails Obj = new StudentDetails();
Obj.StudentDetail();

abstract class Student
{
    public Student(string name, int age)
    {
        StudentName = name;
        this.age = age;
    }
    public readonly int age; // use of read only.. it can't be overwrite and change after once it get assigned value
    public abstract void StudentDetail();
    public string StudentName;
}

class StudentDetails : Student
{
    public StudentDetails() : base("AMAN",22) // ✅ Correct way to call base constructor
    {
    }

    public override void StudentDetail()  // ✅ Correct override syntax
    {
        Console.WriteLine(StudentName);
        Console.WriteLine(age);
    }
}

// Note : go through abstract vs interface

// | Feature                             | Abstract Class                  | Interface (C# 8+)                         |
// | ----------------------------------- | ------------------------------- | ----------------------------------------- |
// | **Can have method implementations** | ✅ Yes                           | ✅ Yes (C# 8.0+ only, default methods)     |
// | **Can have abstract methods**       | ✅ Yes (must be overridden)      | ✅ Yes (all are abstract by default)       |
// | **Can have constructors**           | ✅ Yes                           | ❌ No                                      |
// | **Can have fields**                 | ✅ Yes                           | ❌ No (only properties/constants allowed)  |
// | **Can have properties**             | ✅ Yes                           | ✅ Yes                                     |
// | **Can contain access modifiers**    | ✅ Yes (public, protected, etc.) | ❌ Not until C# 8+ (still limited)         |
// | **Supports multiple inheritance**   | ❌ No (only one abstract class)  | ✅ Yes (can implement multiple interfaces) |
// | **Static members**                  | ✅ Yes (C# 6+)                   | ✅ Yes (C# 8+)                             |
// | **Events, Indexers**                | ✅ Yes                           | ✅ Yes                                     |
// | **Use Case**                        | Shared base logic + structure   | Define capabilities/roles                 |

interface IAnimal
{
    void Speak();
}

class Cat : IAnimal
{
    public void Speak() // ✅ No override keyword needed
    {
        Console.WriteLine("Meow");
    }
    // even if interface method has implemntation already then also override not needed
}