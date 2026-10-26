using System;
using System.Collections;
using System.Text;
using Program;
using static System.Net.Mime.MediaTypeNames;

namespace Program
{
    // Generic class 
    public class ClsGeneric<T>
    {
        //Default  Constructor 
        public ClsGeneric() { 
        }
        //Parameterize Constructor 
        public ClsGeneric(T obj) {
            Console.WriteLine(obj);
        }
        public T Val{get; set; }
        public void PrintVal(T val)
        {
            Console.WriteLine($"Value is : {val}");
        }

    }
    // Generic class with constraints
    class Box
    {
        public int Id; 
        public Box() { 
        }
    }
    class Box1 : Box { 
        
        public void print() => Console.WriteLine("Print function : " + Id);

    }
    class Gen<T> where T : Box, new() {
        public T getobject() { return new T(); }

    }
    class Program
    {
        //Delegates 
        public delegate void Print(string Str);

        static Print ObjPrint = (string s) =>
        {
            Console.WriteLine(s);
        };

        int Id { get; set; }

        // Delegate as callback

        private void AddNPrint(Print func, params int[] parm)
        {
            int ret = 0;
            foreach(int ele in parm) {
                
                ret += ele;
            }
            func(ret.ToString());

        }

        public static void Main(string[] args)
        {
            Program Obj = new Program();

            ObjPrint("For practice");
            Obj.Id = 1;
            ObjPrint(Obj.Id.ToString());
            ObjPrint("Delegates as callback");
            Obj.AddNPrint(ObjPrint, 1, 2, 67, 8);
            
            ObjPrint("Generic class");
            ClsGeneric<String> ObjGeneric = new ClsGeneric<string>("Start");
            ObjGeneric.PrintVal("1 as string");

            // Array and Arraylist
            int[] arr = new int[5];
            arr[0] = 1;

            // multi-dimensional
            int[,] TwoD =
            {
               {1,2,4 },
               {3,4,6},
               {4,5,6},
                {5,6,4 }
            };


            Console.WriteLine($"rows : {TwoD.GetLength(0)}");
            Console.WriteLine($"Columns : {TwoD.GetLength(1)}");

            Console.WriteLine(TwoD[0, 1]);
            // Jagged array
            int[][] JaggedArr = new int[3][];

            JaggedArr[0] = arr;
            Console.WriteLine(JaggedArr[0][0]);
            ArrayList Arrlist = new ArrayList(arr);
            Arrlist.Add("Hello");
            foreach(var ele in Arrlist) { 
                Console.WriteLine(ele);
            }
            Arrlist.RemoveRange(0, 3);
            ObjGeneric.PrintVal("After RemoveRange");
            foreach (var ele in Arrlist)
            {
                Console.WriteLine(ele);
            }
            // Generic with constraints 
            Gen<Box> ObjGen = new Gen<Box>();

            Box newObj = ObjGen.getobject();
            newObj.Id = 1;

            // File handling 
            byte[] data;
            using(var fs = new FileStream(".//Filetext.text",FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None))
            {
                data = Encoding.UTF8.GetBytes("Write this line\n Another line");
                fs.Write(data);
                Console.WriteLine(Encoding.UTF8.GetString(data));
            }
            Console.WriteLine("Stream writer example");
            using (var SW = new StreamWriter(".//Filetext.text"))
            {
                SW.WriteLine("Tera bhai seedhe maut for life");
                SW.WriteLine("Tera bhai ka naam ky haii, naam 47 haii");
            }

            Console.WriteLine("Stream reader example");
            using(var sr = new StreamReader(".//Filetext.text"))
            {
                while(!sr.EndOfStream)
                {
                    Console.WriteLine(sr.ReadLine());
                }
            }
        }
    }

}