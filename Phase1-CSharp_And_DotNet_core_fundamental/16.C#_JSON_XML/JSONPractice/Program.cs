using System;
using System.IO;
using Newtonsoft;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace Example
{
    /*
    Level 1 – Fundamentals
    ----------------------
    Parse a Simple JSON String
    Convert {"Name":"Aman","Age":30}
    into a C# object and print the properties.

    Serialize an Object
    Create an object (e.g., Person { Name="Rita", Age = 25 }) and serialize it to a JSON string.

    Formatting
    Serialize with indented formatting and compare file size to compact formatting.

    Level 2 – Dynamic & LINQ to JSON
    --------------------------------
    Dynamic Access
    Parse {"User":{"Id":1,"Roles":["Admin","Editor"]}} and print all roles without defining a class.

    Modify a JSON Tree
    Load JSON from a file, add a new property "LastLogin":"2025-09-07", and save it back.

    Query with LINQ
    From a JSON array of users, select names of users older than 25.


    Level 3 – Advanced Scenarios
    -----------------------------
    Custom Converter
    Create a class with a DateTime property that serializes as yyyyMMdd.

    Ignore & Rename
    Use attributes so one property is ignored during serialization and another is renamed.

    Large File Streaming
    Write 10 000 random objects to a file incrementally without loading all data into memory.

    */
    class Person
    {
        [JsonProperty("Name")]
        public string FullName{ get; set; }
        public int Age { get; set; }

        [JsonConverter(typeof(FormatDateTime))]
        public DateTime Date { get; set; }

        [JsonIgnore]
        public char Gender { get; set; }
    }

    class FormatDateTime : JsonConverter<DateTime>
    {
        string format = "yyyy/MM/dd";
        public override void WriteJson(JsonWriter writer, DateTime value, JsonSerializer serializer)
        {
            writer.WriteValue(value.ToString(format));
        }
        public override DateTime ReadJson(JsonReader reader, Type objectType, DateTime existingValue, bool hasExistingValue, JsonSerializer serializer)
        {

            return DateTime.ParseExact(reader.Value.ToString()!, format,null);
        }
    }

    class JSONPractice
    {
        public static void LevelOne_Practice()
        {
            Console.WriteLine("Level 1 Practice set");
            Console.WriteLine("-----------------------");
            
            Console.WriteLine("1. Parse a Simple JSON String into C# class object");
            String JSONStr = "{\"Name\":\"Aman\",\"Age\":30}";
            Person ObjPerson = JsonConvert.DeserializeObject<Person>(JSONStr);
            Console.WriteLine($"Name : {ObjPerson?.FullName}, Age : {ObjPerson?.Age}");

            Console.WriteLine("2. Serialize an Object");
            // using same object ObjPerson

            string filejson = ".//compressedjson.json";
            using (StreamWriter SW = new StreamWriter(filejson))
            using (var JW = new JsonTextWriter(SW))
            {
                JsonSerializer JS = new JsonSerializer();
                JS.Serialize(JW, ObjPerson);
            }
            var Settings = new JsonSerializerSettings
            {
                Formatting= Formatting.Indented
            };
            string filejsonInd = ".//Indentedjson.json";
            using (StreamWriter SW = new StreamWriter(filejsonInd))
            using (var JW = new JsonTextWriter(SW))
            {
                JsonSerializer JS = new JsonSerializer();
                JS.Serialize(JW, ObjPerson);
            }
            var objFileinfo = new FileInfo(filejson);
            Console.WriteLine($"Size of compressed : {objFileinfo.Length / 1024.0}");
            objFileinfo = new FileInfo(filejsonInd);
            Console.WriteLine($"Size of Indentedjson : {objFileinfo.Length / 1024.0}");
            return;
        }
        public static void LevelTwo_Practice()
        {
            Console.WriteLine("Level 2 Practice set");
            Console.WriteLine("-----------------------");

            Console.WriteLine("1. Print roles");

            string jsonstr = "{ \"User\": { \"Id\": 1, \"Roles\": [\"Admin\", \"Editor\"] } }";

            JObject ObjJson = JObject.Parse(jsonstr);
            Console.WriteLine($"USer : {ObjJson["User"]}");

            JArray ObjRoles = (JArray)ObjJson["User"]["Roles"];
            foreach( JToken ele in ObjRoles)
            {
                Console.WriteLine(ele.ToString());
            }

            Console.WriteLine("2. Modify json");

            using(var SR = new StreamReader(".//compressedjson.json"))
            using (var JR = new JsonTextReader(SR))
            {
                JObject Obj = JObject.Load(JR);
                Console.WriteLine(Obj.ToString());
                //LastLogin":"2025-09-07"
                Obj.Add("LastLogin", "25-09-07");
                // option 1 : better option, no need of re-open file as doing in option 2
                File.WriteAllText(".//compressedjson.json", Obj.ToString(Formatting.Indented));

                // option 2 
                /*
                SR.Close();
                JR.Close();
                using (var SW = new StreamWriter(".//compressedjson.json"))
                using (var JW = new JsonTextWriter(SW))
                {
                    JsonSerializer obj = new JsonSerializer();
                    obj.Serialize(JW, Obj);
                }
                */
            }
            return;
        }
        public async static void LevelThree_Practice()
        {
            Console.WriteLine("Level 3 Practice set");
            Console.WriteLine("-----------------------");

            Console.WriteLine("1. Date format");
            Person obj = new Person
            {
                FullName = "Aman",
                Age = 22,

                Date= new DateTime(2025,09,14),
                Gender = 'M'
            };
            Console.WriteLine(obj.Date.ToString());

            Console.WriteLine(JsonConvert.SerializeObject(obj));
            Console.WriteLine("2. Print random objects");

            using(var SW = new StreamWriter(".//Example.json"))
            using(var jw = new JsonTextWriter(SW))
            {
                jw.Formatting = Formatting.Indented;
                jw.WriteStartArray();
                for (int i =0; i < 1000; i++) {
                    jw.WriteStartObject();
                    jw.WritePropertyName("Id");
                    jw.WriteValue(i);
                    jw.WritePropertyName("Name");
                    jw.WriteValue("Value" + i.ToString());
                    jw.WriteEndObject();
                }
                jw.WriteEndArray();
                await SW.FlushAsync(); // final flush
            }
            return;

        }
        public static void Main(String[] args)
        {
            //LevelOne_Practice();
            //LevelTwo_Practice();
            LevelThree_Practice();
        }
        
    }
}
