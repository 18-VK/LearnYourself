Console.WriteLine("Hello from C#");
// Data type 
//1 Value type
//1.1 Integral types
byte Btype = 255; // 1 byte - 8 bits, Unsigned 
Console.WriteLine(Btype);
sbyte SBtype = -122; // 1 byte - 8 bits, Signed 
Console.WriteLine(SBtype);
short SHType = -4432; // 2 byte - 16 bits, Signed 
Console.WriteLine(SHType);
ushort USHType = 4432; // 2 byte - 16 bits, Unsigned 
Console.WriteLine(USHType);
int IntType = -5334432; // 4 byte - 32 bits, Signed 
Console.WriteLine(IntType);
uint UIntType = 5334432; // 4 byte - 32 bits, unsigned  
Console.WriteLine(UIntType);
long LongType = -3424534345334432; // 8 byte - 64 bits, Signed 
Console.WriteLine(LongType);
ulong ULongType = 5543424534345334432; // 8 byte - 64 bits, unsigned 
Console.WriteLine(ULongType);
char A = 'B'; // 1 byte, 8 bits
Console.WriteLine(A);

// 1.2 Floating 
float FType = -124.116767f;
Console.WriteLine(FType);
double DType = -124.1112172346562;
Console.WriteLine(DType);
decimal DeType = -124444.13454324534645346453m;
Console.WriteLine(DeType);
//1.3 Boolean
bool IsTrue = true;
Console.WriteLine(IsTrue);
// 1.4 Enum 
/*Console.WriteLine((int)Colours.Red);
Employee ObjEmp;
Console.WriteLine(ObjEmp.age);
*/
// enum Colours
// {
//     Red = 0,
//     green = 1,
//     blue = 2
// };
// 1.5 Struct
// struct Employee
// {
//     public string name;
//     public int age;
// }

//2 Reference type 
//2.1 string
string name = "Aman";
Console.WriteLine(name);
//2.2 Object
object obj;

//2.3 dynamic
dynamic temp;
temp = 2;
Console.WriteLine(temp);
temp = "Dynamic";
Console.WriteLine(temp);

// 3 Nullable
int? a = null;
a = 2;
Console.WriteLine(a);

//4 user-defined 
// 4.1 class
// Student ObjStud = new Student();
// ObjStud.name = "Aman";
// ObjStud.age = 22;
// Console.WriteLine(ObjStud.name);
// Console.WriteLine(ObjStud.age);
// class Student
// {
//     public string name;
//     public int age;
// }

//4.2 interface
// interface IAnimal
// {
//     void Speak();
// }
// class Dog : IAnimal
// {
//     public void Speak()
//     {
//         Console.WriteLine("Woof!");
//     }
// }
// 5 pointers 

Main.Method();
class Main
{

    static public unsafe void Method()
    {
        int x = 10;
        int* ptr1 = &x;
        Console.WriteLine((int)ptr1);
        Console.WriteLine(*ptr1);
    }
}