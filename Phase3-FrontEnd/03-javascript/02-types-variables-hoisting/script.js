var a = 12; // number
console.log("Number:" + a);
a = "Aman";  // reassigning as string
console.log("String: " + a);

var b;
console.log(b); // undefined
var b = true; // redecalaring and reassigning as boolean
console.log(b); // boolean

b = null; // Null

console.log(b);

//BigInt :- is a built-in object in JavaScript that provides a way to represent whole numbers larger than 253-1.
// The largest number that JavaScript can reliably represent with the Number primitive is 253-1, 
//which is represented by the MAX_SAFE_INTEGER constant. This has various uses where operations on large numbers are required.

let bigNum = BigInt(
    "123422222222222222222222222222222222222");
console.log(bigNum);  // appends 'n' 

// Parameter in hexadecimal format
let bigHex = BigInt("0x1ffffffeeeeeeeeef");
console.log(bigHex);

// Parameter in binary format
let bigBin = BigInt(
    "0b1010101001010101001111111111111111");
console.log(bigBin);


// Object
//Note:- Object()  can be called with or without new. Both create a new object.

var obj = {Name: "aman", Age :20};
console.log(obj.Name);

var obj1 = new Object();
obj1.Name = "harry";

console.log(obj1.Name);




