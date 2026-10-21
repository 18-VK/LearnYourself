using System;
using System.Xml;
using static System.Runtime.InteropServices.JavaScript.JSType;
using System.Xml.Linq;
using System.Xml.Serialization;
using System.Collections.Generic;
using System.Diagnostics;

namespace XMLPractice
{
    public class Book
    {
        [XmlAttribute("Id")]
        public int Id { get; set; }
        public string Title { get; set; }
        public string Author { get; set; }
        public int Price { get; set; }
        public int PublishYear { get; set; }

        public Book()
        {

        }
        public Book(int ID, string title, string author, int price, int pubishyear)
        {
            this.Id = ID;
            this.Title = title;
            this.Author = author;
            this.Price = price;
            this.PublishYear = pubishyear;
        }
    }
    [XmlRoot("Catalog")]
    public class ClsCatalog
    {
        [XmlElement("Book")]
        public Book[] ObjBook;
    }
    class ClsMain
    {
        static void CreateCatalog()
        {
            /* Create a Catalog
            Generate an XML file named catalog.xml containing a root<Catalog> element with five<Book> child elements, 
            each with id, title, and price data.
            */
            ClsCatalog ObjCat = new ClsCatalog();
            ObjCat.ObjBook = new Book[]
            {   new Book(101, "C# Fundamentals", "Aman", 350,2019),
                new Book(105, "Advanced LINQ", "Vikram", 550,2020),
                new Book(105, "Async Programming", "Vikram", 501,2020)
            };

            // XML Serialise 
            XmlSerializer XS = new XmlSerializer(typeof(ClsCatalog));
            using(var SW = new StreamWriter(".//Catalog.xml"))
            {
                XS.Serialize(SW, ObjCat);
            }

            return;
        }

        /*
          XmlDocument approach is perfectly fine for small–medium files.
          If the file might be huge or performance-critical, consider a streaming XmlReader/XmlWriter solution;
        */

        static void UpdateAttribute()
        {
            /* Update Attribute
               Given an XML file with <Book id="101">, change the id of a specific book to 202 and save it.
            */
           
            XmlDocument Doc = new XmlDocument();
            Doc.Load(".//Catalog.xml");
            XmlNode Node = Doc.SelectSingleNode("//Book[@Id=101]");
            if(Node != null)
            {
                XmlAttributeCollection Attrs = Node.Attributes;
                foreach(XmlAttribute ele in Attrs)
                {
                    ele.InnerText = "202";
                }
            }
            Doc.Save(".//Catalog.xml");
            

        }
        

        static void InsertElement()
        {
            /*
                Insert Element
                Add a new <InStock> element to every<Book> node, placing it after<Title>.
             */

            XmlDocument Doc = new XmlDocument();
            Doc.Load(".//Catalog.xml");

            XmlNodeList Nodes = Doc.SelectNodes("//Book");
            foreach(XmlNode ele in Nodes)
            {

                XmlElement Element = Doc.CreateElement("InStock");
                Element.InnerText = "Y";

                XmlNode title = ele.SelectSingleNode("Title");

                ele.InsertAfter(Element, title);
            }

            Doc.Save(".//Catalog.xml");
        }
        
        static void DeleteNodes()
        {
            /*
               Remove Node
               Delete all<Book> elements whose <Price> value is greater than 500.
             */
            XmlDocument Doc = new XmlDocument();
            Doc.Load(".//Catalog.xml");

            XmlNodeList Nodes = Doc.SelectNodes("//Book[Price > 500]");

            foreach(XmlNode ele in Nodes)
            {
                XmlNode parent = ele.ParentNode;
                parent.RemoveChild(ele);
            }
            Doc.Save(".//Catalog.xml");
        }
        static void PrintData()
        {
            /*
               Read Specific Data
               Load an XML document and print the titles of books published after 2019.
             */
            XmlDocument Doc = new XmlDocument();
            Doc.Load(".//Catalog.xml");

            XmlNodeList Nodes = Doc.SelectNodes("//Book[PublishYear > 2019]");

            foreach (XmlNode ele in Nodes)
            {
                XmlNode node = ele.SelectSingleNode("Title");
                Console.WriteLine($"Book Title : {node.InnerText}");
            }
            
        }
        public static void Main(string[] args)
        {
            CreateCatalog();
            //UpdateAttribute();
            //InsertElement();
            //DeleteNodes();
            PrintData();
        }
    }

}
