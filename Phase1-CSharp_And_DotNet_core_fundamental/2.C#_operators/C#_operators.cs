string name = null;
// if variable holds the null value then return default value
Console.WriteLine(name ?? "Default value");

Student Obj = new Student();
Obj.StudentName = "AMAN";
Console.WriteLine(Obj?.StudentName);
Obj = null;
Console.WriteLine(Obj?.StudentName);
class Student
{
    public string StudentName;
}