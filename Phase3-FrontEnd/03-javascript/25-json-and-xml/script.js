//XML Parsing 
let XmlData = `<root>
<person>
  <name>John Doe</name>
  <age>30</age>
  <email>john.doe@example.com</email>
</person>
<book>
  <title>The Adventure Begins</title>
  <author>Robert Johnson</author>
  <year>2022</year>
</book>
  <person>
  <name>John Doe</name>
  <age>30</age>
  <email>john.doe@example.com</email>
</person>
<person>
  <name>Jane Smith</name>
  <age>25</age>
  <email>jane.smith@example.com</email>
</person>
<person>
  <name>John Doe</name>
  <age>30</age>
  <email>john.doe@example.com</email>
</person>
<person>
  <name>Jane Smith</name>
  <age>25</age>
  <email>jane.smith@example.com</email>
</person>
<book>
  <title>The Adventure Begins</title>
  <author>Robert Johnson</author>
  <year>2022</year>
</book>
<person>
  <name>John Doe</name>
  <age>30</age>
  <email>john.doe@example.com</email>
</person>
</root>
`;
// Using DOM parser
// const ObjDOM = new DOMParser();
// let ParsedObj = ObjDOM.parseFromString(XmlData,'text/xml');
// console.log(typeof ParsedObj);
// ParsedObj.createElement("Temp");
// let Ele_Book = ParsedObj.getElementsByTagName('book');
// console.log(Ele_Book[Ele_Book.length - 1].firstElementChild);

//using XML2Js Library

const ObjXML2JS = require('xml2js');
ObjXML2JS.parseString(XmlData,(err,result)=>{
    if(err)
        console.log(err);
    else
        console.log(result);
})

const ObjXMLDOM = require('xmldom').DOMParser;
var parser = new ObjXMLDOM();
var document = parser.parseFromString(XmlData, 'text/xml');
console.log(document.getElementsByTagName('book')[1].textContent);

// Json Parsing
let JSONData = `
  {
    "name": "Adeel Solangi",
    "language": "Sindhi",
    "id": "V59OF92YF627HFY0",
    "bio": "Donec lobortis eleifend condimentum. Cras dictum dolor lacinia lectus vehicula rutrum. Maecenas quis nisi nunc. Nam tristique feugiat est vitae mollis. Maecenas quis nisi nunc.",
    "version": 6.1
  }`;

let JOSNObj = JSON.parse(JSONData);
console.log(JSON.stringify(JOSNObj));
// let JOSNObj = JSON.parse(JSONData,(key,value)=>{
//   console.log(key + " : " + value);
// })

for(let key in JOSNObj)
{
  if(JOSNObj.hasOwnProperty(key))
  {
    console.log(key + " : " + JOSNObj[key]);
  }
}
console.log(JOSNObj);