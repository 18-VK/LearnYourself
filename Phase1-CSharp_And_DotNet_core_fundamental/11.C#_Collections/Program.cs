// Generic collection
Console.WriteLine("Generic Collection");
Console.WriteLine("List......");

var ObjList = new List<string>();
// or List<string> ObjList = new List<string>();
ObjList.Add("Aman");
ObjList.Add("Kumar");
ObjList.Add("22");
ObjList.Remove("Aman");
foreach (var item in ObjList)
{
    Console.WriteLine(item);
}
Console.WriteLine(ObjList.Count());
var Temp = new List<String>();
Temp.AddRange(ObjList);
Console.WriteLine(Temp.Count());

Temp.Insert(1,"seedhe maut for life");
foreach (var item in Temp)
{
    Console.WriteLine(item);
}

Console.WriteLine("Dictionary......");

var Dict = new Dictionary<string,int>();
// or Dictionary<string,int> Dict = new Dictionary<string,int>();
Dict.Add("Aman",22);
// Dict.Add("Aman",23); Exception, can't have same  key again 
Dict["Aman"] = 23; // add or update
foreach(var item in Dict)
{
    Console.WriteLine($"{item.Key}, {item.Value}");
}