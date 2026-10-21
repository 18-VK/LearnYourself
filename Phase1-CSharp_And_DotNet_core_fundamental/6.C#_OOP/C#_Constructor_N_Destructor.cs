Example obj = new Example();
obj.class_id = 2;
Example Obj2 = new Example("Hey");
// Copy constructor: creates a new object by copying values from another
// object of the same class.
Example Obj3 = new Example(obj);
obj = null;
//Example2 ObjEX2 = new Example2(); // error, because we can't create object of class with priavte constructor 

Console.WriteLine(Obj3.class_id);
class Example
{
    public int class_id;
    public Example()//default constructor
    {
        Console.WriteLine("Deafult Constructor");
    }
    public Example(string val) //Parameterize Constructor
    {
        Console.WriteLine("Parameterize Constructor, val : " + val);
    }
    // Copy constructor
    public Example(Example g)
    {
        this.class_id = g.class_id;
    }
    // A static constructor cannot have parameters because the CLR calls it
    // automatically and there is no caller to provide arguments.
    static Example() //static Constructor
    {
        Console.WriteLine("Static Constructor");
    }
    ~Example()
    {
        Console.WriteLine("Destructor called");
    }
};

class Example2
{
    // A private constructor prevents other classes from creating instances
    // or deriving from this class outside the class itself.
    private Example2()
    {
         Console.WriteLine("private Constructor");
    }
}

// A private constructor is commonly used when a class exposes only static
// members or when implementing a singleton pattern.
class SingletonExample
{
    private static SingletonExample? instance;

    private SingletonExample()
    {
    }

    public static SingletonExample Instance
    {
        get
        {
            instance ??= new SingletonExample();
            return instance;
        }
    }
}
