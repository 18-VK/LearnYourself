using System.Collections;
void functionArrays()
{
    int[] Nums = new int[5]; // Declaration and allocating size 
    int[] Values = { 1, 344, 44, 2131 }; // Declaring and assigning values 

    // Multi-dimensional array 
    int[,] TwoD = new int[2, 4];
    TwoD[0, 0] = 5; // Setting 5 at row idx 0 and column idx 0 
    Console.WriteLine(TwoD[0, 0]);
    // Jagged array, Two dimesional 
    int[][] jagged = new int[2][];
    jagged[0] = new int[3];
    jagged[1] = new int[5];
    jagged[0][0] = 4;// Setting 4 at row idx 0's array at idx 0
    Console.WriteLine(jagged[0][0]);
    for (int i = 0; i < Nums.Length; i++)
    {
        Nums[i] = i;
        Console.WriteLine(Nums[i]);
    }
    // properties 
    Console.WriteLine("Array class properties");
    Console.WriteLine(Values.Length);
    Console.WriteLine(Values.Rank);
    Console.WriteLine(Values.IsFixedSize);
    Console.WriteLine(Values.IsReadOnly);
    Console.WriteLine(Values.IsSynchronized);

    // method 
    Console.WriteLine("Array class method");
    Array.Sort(Values);
    for (int i = 0; i < Values.Length; i++)
    {
        Console.WriteLine(Values[i]);
    }
    Array.Reverse(Values);
    for (int i = 0; i < Values.Length; i++)
    {
        Console.WriteLine(Values[i]);
    }
    Console.WriteLine(Array.IndexOf(Values, 44));

    Console.WriteLine("ArrayList..");
    ArrayList ArrList = new ArrayList();
    ArrList.Add(5);
    ArrList.Add(-1);
    ArrList.Add("Aman");
    ArrList.Add(9);
    ArrList.AddRange(Values);
    ArrList.Add(98);
    foreach (var item in ArrList)
    {
        Console.WriteLine(item);
    }
    Console.WriteLine(ArrList.Capacity);
}
functionArrays();


