using System;
using System.Xml;

class XmlDomExamples
{
    static void Main()
    {
        // 1. Create an empty document
        XmlDocument doc = new XmlDocument();

        // Create root element <Library>
        XmlElement root = doc.CreateElement("Library");
        doc.AppendChild(root);

        // -------------------------------
        // 2. Create nodes
        XmlElement book = doc.CreateElement("Book");         // <Book>
        XmlAttribute attr = doc.CreateAttribute("id");       // attribute id
        attr.Value = "101";
        book.Attributes.Append(attr);                        // <Book id="101">

        XmlElement title = doc.CreateElement("Title");       // <Title>
        XmlText titleText = doc.CreateTextNode("XML Basics");
        title.AppendChild(titleText);                        // <Title>XML Basics</Title>

        XmlElement author = doc.CreateElement("Author");
        author.InnerText = "Aman Kumar";                     // Using InnerText

        XmlCDataSection cdata = doc.CreateCDataSection("Special <tag> & data"); // <![CDATA[...]]>

        XmlComment comment = doc.CreateComment("Book details start here");

        XmlProcessingInstruction pi =
            doc.CreateProcessingInstruction("xml-stylesheet", "type='text/xsl' href='style.xsl'");

        // Add processing instruction at top
        doc.InsertBefore(pi, root);

        // -------------------------------
        // 3. Adding nodes
        root.AppendChild(comment);            // Add comment
        book.AppendChild(title);              // Add <Title> to <Book>
        book.AppendChild(author);             // Add <Author>
        book.AppendChild(cdata);              // Add CDATA section
        root.AppendChild(book);               // Add <Book> to <Library>

        // InsertBefore & InsertAfter
        XmlElement publisher = doc.CreateElement("Publisher");
        publisher.InnerText = "Tech Press";
        book.InsertBefore(publisher, author); // <Publisher> before <Author>

        XmlElement year = doc.CreateElement("Year");
        year.InnerText = "2025";
        book.InsertAfter(year, author);       // <Year> after <Author>

        // -------------------------------
        // 4. Modifying
        author.InnerText = "Updated Author";   // Change text
        publisher.SetAttribute("location", "India"); // Add attribute to <Publisher>

        // ReplaceChild
        XmlElement newTitle = doc.CreateElement("Title");
        newTitle.InnerText = "Advanced XML";
        book.ReplaceChild(newTitle, title);   // Replace old title

        // RemoveChild
        book.RemoveChild(cdata);              // Remove CDATA section

        // -------------------------------
        // 5. Searching & Selecting
        XmlNode foundBook = doc.SelectSingleNode("//Book[@id='101']");
        Console.WriteLine("Found Book Node: " + foundBook.OuterXml);

        XmlNodeList allTitles = doc.GetElementsByTagName("Title");
        foreach (XmlNode t in allTitles)
        {
            Console.WriteLine("Title: " + t.InnerText);
        }

        if (book.HasChildNodes)
            Console.WriteLine("Book has children.");

        // -------------------------------
        // 6. Saving & Loading
        doc.Save("library.xml");
        Console.WriteLine("XML Saved as library.xml");

        // Load from file again
        XmlDocument doc2 = new XmlDocument();
        doc2.Load("library.xml");
        Console.WriteLine("Loaded XML: " + doc2.OuterXml);

        // Load XML from string
        string xmlString = "<Root><Child>Hello</Child></Root>";
        XmlDocument doc3 = new XmlDocument();
        doc3.LoadXml(xmlString);
        Console.WriteLine("Loaded from string: " + doc3.OuterXml);
    }
}
