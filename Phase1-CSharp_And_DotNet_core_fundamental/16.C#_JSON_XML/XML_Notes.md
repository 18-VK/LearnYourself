# XML serialization and deserialization

XML serialization in C# is the process of converting an object's public state (fields and properties) into an XML
format that can be stored or transmitted, and then reconstructing the object later (deserialization). In C#, the
`System.Xml.Serialization.XmlSerializer` class handles this. It generates an XML stream that represents the object's
public data (but not methods, private fields, or read-only properties).

## Basic Serialization

To serialize a simple object, define a public class and then use `XmlSerializer.Serialize`. For example:

```csharp
public class Person {
    public string Name;
    public int Age;
}

// Create a person object.
var person = new Person { Name = "Alice", Age = 30 };

// Create an XmlSerializer for the Person type.
var serializer = new XmlSerializer(typeof(Person));

// Serialize to a file.
using (var writer = new StreamWriter("person.xml"))
{
    serializer.Serialize(writer, person);
}
```

This will produce XML like:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Person>
  <Name>Alice</Name>
  <Age>30</Age>
</Person>
```

## Deserializing is the inverse: call `Deserialize` on the same type and cast the result

For example:

```csharp
Person person2;
using (var reader = new StreamReader("person.xml"))
{
    person2 = (Person)serializer.Deserialize(reader);
}
Console.WriteLine(person2.Name);  // Outputs: Alice
```

> **Note:** The `XmlSerializer` uses the class and member names by default for XML element names.

## Using Attributes

The `XmlSerializer` uses the class and member names by default for XML element names. You can control the XML structure
using attributes in `System.Xml.Serialization`:

### `[XmlElement]`

Override the XML element name or namespace for a field/property. For example:

```csharp
public class Product {
    [XmlElement(ElementName = "ItemName")]
    public string Name;
    public decimal Price;
}
```

This will serialize `<ItemName>Value</ItemName>` instead of `<Name>`.

### `[XmlAttribute]`

Serialize a member as an XML attribute instead of an element. By default fields become elements,
but with `[XmlAttribute]` they appear as attributes. For example:

```csharp
public class Product {
    [XmlAttribute]
    public int ID;
    public string Name;
}
```

This yields `<Product ID="123"><Name>...</Name></Product>`. In fact, "`[XmlAttribute]` informs the `XmlSerializer` to
serialize the member as an XML attribute. By default ... public fields and properties are serialized as XML elements".

### `[XmlRoot]`

Change the name or namespace of the root element. For example:

```csharp
[XmlRoot("Order")]
public class PurchaseOrder {
    public int OrderID;
}
```

Serializing an instance produces `<Order>…</Order>` instead of `<PurchaseOrder>…</PurchaseOrder>`.
You can also set a namespace or change schema type with `[XmlType]` on the same class.

### `[XmlIgnore]`

Exclude a field/property from serialization. If some public field should not appear in XML (e.g. a
calculated or sensitive property), decorate it with `[XmlIgnore]`. The serializer will skip it. For example:

```csharp
public class User {
    public string Username;
    [XmlIgnore]
    public string PasswordHash;
}
```

Here `PasswordHash` is not included in the XML. In other words, applying `XmlIgnoreAttribute` "instructs the `XmlSerializer`
to ignore the public field or property when serializing or deserializing".

### `[XmlArray]` and `[XmlArrayItem]`

Customize array or list serialization. By default, serializing a collection creates a
wrapper element named after the field, containing child elements. For example:

```csharp
public class Team {
    public string[] Members;
}
```

Serializing `Team` might yield:

```xml
<Team>
  <Members>
    <string>Alice</string>
    <string>Bob</string>
  </Members>
</Team>
```

You can change the outer tag or the item tags with `[XmlArray]` and `[XmlArrayItem]`. For example:

```csharp
public class Team {
    [XmlArray("Players")]
    [XmlArrayItem("Player")]
    public List<string> Members;
}
```

Now the XML becomes `<Players><Player>Alice</Player><Player>Bob</Player></Players>`.

> **Note:** Can gone through XML validation using XSD

## XmlWriter + XmlWriterSettings

### Key `XmlWriterSettings` properties (what they do)

- **`Indent` (bool)** — pretty-print with indentation.
- **`IndentChars` (string)** — characters used for each indent level (default `" "`).
- **`NewLineChars` (string)** — newline sequence (`"\n"` or `"\r\n"`).
- **`NewLineHandling` (NewLineHandling)** — how to handle newlines in content (`Replace`, `Entitize`, `None`).
- **`OmitXmlDeclaration` (bool)** — omit `<?xml ... ?>` prolog when true.
- **`Encoding` (Encoding)** — target encoding used when writing to a stream (ignored by `StringWriter`).
- **`CloseOutput` (bool)** — whether `XmlWriter.Close()` also closes the underlying stream.
- **`NamespaceHandling` (NamespaceHandling)** — `Default` or `OmitDuplicates` (helps prevent duplicate `xmlns` declarations).
- **`CheckCharacters` (bool)** — validate characters for XML validity; set false only when you know what you're doing.
- **`ConformanceLevel` (ConformanceLevel)** — `Document` (default), `Fragment`, or `Auto`. Use `Fragment` for writing fragments (no root).
- **`Async` (bool)** — enable async write methods (`WriteStartElementAsync`, etc.). Use when streaming asynchronously.

**Example:**

```csharp
using System.Text;
using System.Xml;

var settings = new XmlWriterSettings {
    Indent = true,
    OmitXmlDeclaration = false,
    Encoding = Encoding.UTF8
};

using var ms = new MemoryStream();
using (var xw = XmlWriter.Create(ms, settings)) {
    xw.WriteStartDocument();
    xw.WriteStartElement("Products");
    xw.WriteStartElement("Product");
    xw.WriteAttributeString("ID", "123");
    xw.WriteElementString("Name", "Laptop");
    xw.WriteEndElement(); // Product
    xw.WriteEndElement(); // Products
    xw.WriteEndDocument();
    xw.Flush();
}

// ms contains UTF8 bytes; get string:
string xml = Encoding.UTF8.GetString(ms.ToArray());
Console.WriteLine(xml);
```

## Preparing XML data without Class

### XML DOM

**XML DOM Useful Methods for Preparing XML**

#### 1. Creating Documents & Elements

- `XmlDocument doc = new XmlDocument();` → Creates an empty XML document.
- `doc.CreateElement("TagName")` → Creates a new XML element node.
- `doc.CreateAttribute("AttrName")` → Creates an attribute for attaching to elements.
- `doc.CreateTextNode("text")` → Creates a text node inside an element.
- `doc.CreateCDataSection("data")` → Adds CDATA sections (for raw data like `<` `>` `&`).
- `doc.CreateComment("some comment")` → Adds comments to XML.
- `doc.CreateProcessingInstruction("xml-stylesheet", "type='text/xsl' href='style.xsl'")` → For special instructions.

#### 2. Adding Nodes

- `AppendChild(node)` → Attaches a node as the last child.
- `InsertBefore(newNode, refNode)` → Inserts before an existing node.
- `InsertAfter(newNode, refNode)` → Inserts after an existing node.
- `SetAttribute("name", "value")` (on `XmlElement`) → Adds/updates attribute.

#### 3. Modifying Data

- `InnerText` → Gets/sets the text inside an element.
- `InnerXml` → Gets/sets XML content inside a node.
- `OuterXml` → Gets the entire XML (including the node itself).
- `RemoveChild(node)` → Removes a child node.
- `ReplaceChild(newNode, oldNode)` → Replaces existing node.

#### 4. Searching & Selecting

- `SelectSingleNode(xpath)` → Finds one node by XPath.
- `SelectNodes(xpath)` → Finds multiple nodes by XPath.
- `GetElementsByTagName("TagName")` → Retrieves nodes by tag name.
- `HasChildNodes` → Check if a node has children.

#### 5. Saving & Loading

- `Load("file.xml")` → Loads XML from a file.
- `LoadXml(string)` → Loads XML from a string.
- `Save("file.xml")` → Saves to file.
- `Save(Stream/TextWriter)` → Saves to stream or writer.

## XML DOM + XmlWriter with Settings

```csharp
using System;
using System.Xml;

class Program
{
    static void Main()
    {
        // 1. Create DOM document
        XmlDocument doc = new XmlDocument();

        // XML declaration
        XmlDeclaration xmlDecl = doc.CreateXmlDeclaration("1.0", "UTF-8", null);
        doc.AppendChild(xmlDecl);

        // Root element
        XmlElement library = doc.CreateElement("Library");
        doc.AppendChild(library);

        // Book element
        XmlElement book = doc.CreateElement("Book");
        book.SetAttribute("id", "101");

        XmlElement title = doc.CreateElement("Title");
        title.InnerText = "XML DOM with XmlWriter";

        XmlElement author = doc.CreateElement("Author");
        author.InnerText = "Aman Kumar";

        book.AppendChild(title);
        book.AppendChild(author);
        library.AppendChild(book);

        // 2. Configure XmlWriterSettings
        XmlWriterSettings settings = new XmlWriterSettings
        {
            Indent = true,                     // Pretty-print XML
            IndentChars = "  ",                // Two spaces for indentation
            Encoding = System.Text.Encoding.UTF8,
            OmitXmlDeclaration = false,        // Keep XML declaration
            NewLineOnAttributes = true         // Write each attribute on a new line
        };

        // 3. Save with XmlWriter
        using (XmlWriter writer = XmlWriter.Create("library.xml", settings))
        {
            doc.Save(writer);
        }

        Console.WriteLine("XML saved with XmlWriter settings!");
    }
}
```

## Using MemoryStream

### Why MemoryStream is Useful

- ✔️ Return XML from Web API without saving to disk.
- ✔️ Send XML via HTTP requests / sockets.
- ✔️ Convert directly to string or `byte[]`.
- ✔️ Temporary XML manipulation before saving to DB.

```csharp
// Write into MemoryStream
using (MemoryStream ms = new MemoryStream())
{
    using (XmlWriter writer = XmlWriter.Create(ms, settings))
    {
        doc.Save(writer);
    }

    // Reset stream position to beginning
    ms.Position = 0;

    // Convert to string
    string xmlString = Encoding.UTF8.GetString(ms.ToArray());
    Console.WriteLine("XML String:\n" + xmlString);

    // If needed: get raw byte[]
    byte[] xmlBytes = ms.ToArray();
    Console.WriteLine("\nByte length: " + xmlBytes.Length);
}
```

## Namespace in XML

An XML namespace is a way to give unique names to the elements and attributes in an XML document so that there's no
confusion when different vocabularies (schemas) are combined in the same document.

### 1. Why a Namespace Is Needed

Imagine two different XML vocabularies:

```xml
<order>
    <name>John</name>
</order>

<customer>
    <name>Acme Corp</name>
</customer>
```

Both have a `<name>` element, but they mean different things (person's name vs. company name).
If you merge them into a single XML document, the processor cannot tell which `<name>` belongs to which vocabulary.

### 2. What a Namespace Is

A namespace is essentially a unique identifier (URI) associated with a prefix that qualifies element/attribute names.

- **Namespace URI:** A unique string, usually a URL-like identifier (not necessarily an actual web page).
- **Prefix:** A short label used in the XML document to refer to that URI.

### 3. Declaring a Namespace

You declare it using the `xmlns` attribute:

```xml
<order xmlns:ord="http://example.com/order"
       xmlns:cust="http://example.com/customer">
    <ord:name>John</ord:name>
    <cust:name>Acme Corp</cust:name>
</order>
```

Here:

- `ord` and `cust` are prefixes.
- The URIs `http://example.com/order` and `http://example.com/customer` identify each vocabulary.

### 4. Default Namespace

You can set a namespace without a prefix (default) for elements:

```xml
<order xmlns="http://example.com/order">
    <name>John</name>
</order>
```

All child elements without their own prefix belong to this default namespace.
Attributes, however, do not inherit the default namespace unless explicitly prefixed.

### 5. How It's Used

- **Validation:** XML parsers use namespaces to match elements/attributes to their correct schema definitions (XSD).
- **Integration:** Lets you safely mix XML vocabularies (for example, combining SVG graphics with XHTML).
- **Disambiguation:** Prevents naming conflicts when two different XML sources use the same element names.

### 1️⃣ Using LINQ to XML (XDocument / XElement) – Recommended

```csharp
using System.Xml.Linq;

class Program
{
    static void Main()
    {
        // Define the namespace
        XNamespace ns = "http://example.com/order";

        // Build the XML
        var doc = new XDocument(
            new XElement(ns + "Order",
                new XAttribute(XNamespace.Xmlns + "ord", ns),  // xmlns:ord="http://example.com/order"
                new XElement(ns + "Id", 1001),
                new XElement(ns + "Customer", "John Doe")
            )
        );

        doc.Save("order.xml");
    }
}
```

**Key points**

- `XNamespace` holds the URI.
- `ns + "ElementName"` ensures the element belongs to that namespace.
- `XNamespace.Xmlns + "ord"` sets the prefix (`ord`) in the root.

**Output**

```xml
<Order xmlns:ord="http://example.com/order">
  <Id>1001</Id>
  <Customer>John Doe</Customer>
</Order>
```

If you don't care about a prefix and want a default namespace, omit the prefix in the attribute:

```csharp
new XAttribute(XNamespace.Xmlns + "","http://example.com/order")
```

### 2️⃣ Using XmlWriter

Gives you fine-grained control over prefixes and namespaces.

```csharp
using System.Xml;

class Program
{
    static void Main()
    {
        var settings = new XmlWriterSettings { Indent = true };

        using (XmlWriter writer = XmlWriter.Create("order.xml", settings))
        {
            writer.WriteStartDocument();

            // Start root with a namespace prefix
            writer.WriteStartElement("ord", "Order", "http://example.com/order");

            writer.WriteElementString("ord", "Id", "http://example.com/order", "1001");
            writer.WriteElementString("ord", "Customer", "http://example.com/order", "John Doe");

            writer.WriteEndElement();
            writer.WriteEndDocument();
        }
    }
}
```

This produces:

```xml
<ord:Order xmlns:ord="http://example.com/order">
  <ord:Id>1001</ord:Id>
  <ord:Customer>John Doe</ord:Customer>
</ord:Order>
```

### 3️⃣ Using XmlDocument (classic DOM)

```csharp
using System.Xml;

var doc = new XmlDocument();

// Create root with a namespace
XmlElement root = doc.CreateElement("ord", "Order", "http://example.com/order");
doc.AppendChild(root);

// Child element in same namespace
XmlElement id = doc.CreateElement("ord", "Id", "http://example.com/order");
id.InnerText = "1001";
root.AppendChild(id);

doc.Save("order.xml");
```
