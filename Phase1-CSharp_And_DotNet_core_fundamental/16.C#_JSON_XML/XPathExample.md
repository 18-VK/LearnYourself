# What is XPath — and why you'd use it

XPath (XML Path Language) is a query language for selecting nodes from an XML document. Think of it as SQL for XML — it
lets you locate elements, attributes, text nodes and navigate the XML tree with powerful filters and functions.

XPath is used heavily in:

- querying XML from code (`SelectNodes` / `SelectSingleNode`),
- tools that extract or validate values from XML.

## Core ideas (short & practical)

- `//` — descendant-or-self: find nodes anywhere below.
- `/` — root or direct child separator.
- `.` and `..` — current node and parent.
- `@` — attribute selector (e.g. `@id`).
- `*` — wildcard for any element.
- Predicates `[...]` — filter results (like `[@id='B1']` or `[price>30]`).
- Functions: `contains()`, `starts-with()`, `text()`, `normalize-space()`, `position()`, `last()`.

## Example

### Sample XML we'll query

```xml
<library>
  <section name="Programming">
    <book id="B1">
      <title>Mastering C#</title>
      <price>49.99</price>
    </book>
    <book id="B2">
      <title>XML Basics</title>
      <price>29.50</price>
    </book>
  </section>
  <section name="Fiction">
    <book id="B3">
      <title>Space Odyssey</title>
      <price>19.99</price>
    </book>
  </section>
</library>
```

### 1. `//` — descendant-or-self

Find all `book` elements anywhere in the document:

```xpath
//book
```

**Returns:** all three `<book>` nodes, no matter where they are nested.

### 2. `/` — root or direct child

Get `section` elements directly under the root `<library>`:

```xpath
/library/section
```

**Returns:** the two `<section>` nodes only.

### 3. `.` and `..` — current node and parent

Assume you already selected a `<title>` node.

Current node's text:

```xpath
./text()
```

Returns the text of that specific `<title>`.

Parent `<book>` of a `<title>`:

```xpath
../@id
```

Returns the parent book's `id` attribute.

### 4. `@` — attribute selector

All `name` attributes of `<section>`:

```xpath
//section/@name
```

**Returns:** `Programming`, `Fiction`.

### 5. `*` — wildcard for any element

All direct child elements of the first `<book>` in the document:

```xpath
(//book)[1]/*
```

**Returns:** its `<title>` and `<price>` elements.

### 6. Predicates `[...]` — filters

Books with price greater than 30:

```xpath
//book[price > 30]
```

**Returns:** book B1.

Book with a specific id:

```xpath
//book[@id='B2']
```

**Returns:** book B2.

### 7. Functions

| Function              | Example                                         | Result                                                              |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| **contains()**        | `//book[contains(title,'XML')]`                 | Book B2 (title contains “XML”)                                      |
| **starts-with()**     | `//book[starts-with(@id,'B')]`                  | All three books (all ids start with “B”)                            |
| **text()**            | `//book/title/text()`                           | Text of every title (`Mastering C#`, `XML Basics`, `Space Odyssey`) |
| **normalize-space()** | `//book[normalize-space(title)='Mastering C#']` | Book B1 (ignores extra spaces)                                      |
| **position()**        | `//book[position()=2]`                          | The second `<book>` encountered (B2)                                |
| **last()**            | `(//book)[last()]`                              | The last `<book>` in the document (B3)                              |

```csharp
// Example: all book titles containing 'XML'
foreach (XmlNode n in doc.SelectNodes("//book[contains(title,'XML')]"))
    Console.WriteLine(n["title"].InnerText);
```

## Example program

```csharp
using System;
using System.Xml;

class XPathDemo
{
    static void Main()
    {
        string xml = @"
<library>
  <section name='Programming'>
    <book id='B1'>
      <title>Mastering C#</title>
      <price>49.99</price>
    </book>
    <book id='B2'>
      <title>XML Basics</title>
      <price>29.50</price>
    </book>
  </section>
  <section name='Fiction'>
    <book id='B3'>
      <title>Space Odyssey</title>
      <price>19.99</price>
    </book>
  </section>
</library>";

        XmlDocument doc = new XmlDocument();
        doc.LoadXml(xml);

        // 1. // descendant-or-self
        Console.WriteLine("\n=== //book : all books ===");
        foreach (XmlNode n in doc.SelectNodes("//book"))
            Console.WriteLine(n.OuterXml);

        // 2. / root or direct child
        Console.WriteLine("\n=== /library/section : sections under root ===");
        foreach (XmlNode n in doc.SelectNodes("/library/section"))
            Console.WriteLine(n.OuterXml);

        // 3. . and .. current node and parent
        Console.WriteLine("\n=== . and .. : current node & parent ===");
        XmlNode titleNode = doc.SelectSingleNode("(//book/title)[1]");
        Console.WriteLine("Current node text: " + titleNode.SelectSingleNode("./text()").Value);
        Console.WriteLine("Parent book id: " + titleNode.SelectSingleNode("../@id").Value);

        // 4. @ attribute selector
        Console.WriteLine("\n=== //section/@name : all section names ===");
        foreach (XmlNode n in doc.SelectNodes("//section/@name"))
            Console.WriteLine(n.Value);

        // 5. * wildcard
        Console.WriteLine("\n=== (//book)[1]/* : children of first book ===");
        foreach (XmlNode n in doc.SelectNodes("(//book)[1]/*"))
            Console.WriteLine(n.OuterXml);

        // 6. Predicates
        Console.WriteLine("\n=== //book[price > 30] : books price > 30 ===");
        foreach (XmlNode n in doc.SelectNodes("//book[price > 30]"))
            Console.WriteLine(n.OuterXml);

        Console.WriteLine("\n=== //book[@id='B2'] : book with id B2 ===");
        foreach (XmlNode n in doc.SelectNodes("//book[@id='B2']"))
            Console.WriteLine(n.OuterXml);

        // 7. Functions
        Console.WriteLine("\n=== contains() : books whose title contains 'XML' ===");
        foreach (XmlNode n in doc.SelectNodes("//book[contains(title,'XML')]"))
            Console.WriteLine(n.OuterXml);

        Console.WriteLine("\n=== starts-with() : books with id starting with 'B' ===");
        foreach (XmlNode n in doc.SelectNodes("//book[starts-with(@id,'B')]"))
            Console.WriteLine(n.OuterXml);

        Console.WriteLine("\n=== text() : text of every title ===");
        foreach (XmlNode n in doc.SelectNodes("//book/title/text()"))
            Console.WriteLine(n.Value);

        Console.WriteLine("\n=== normalize-space() : title equals 'Mastering C#' ignoring spaces ===");
        foreach (XmlNode n in doc.SelectNodes("//book[normalize-space(title)='Mastering C#']"))
            Console.WriteLine(n.OuterXml);

        Console.WriteLine("\n=== position()=2 : second book ===");
        foreach (XmlNode n in doc.SelectNodes("//book[position()=2]"))
            Console.WriteLine(n.OuterXml);

        Console.WriteLine("\n=== last() : last book ===");
        foreach (XmlNode n in doc.SelectNodes("(//book)[last()]"))
            Console.WriteLine(n.OuterXml);
    }
}
```
