const person = {
    name: 'Sara',
    age: 25,
    gender: 'female'    
}

// let name = person.name;
// let age = person.age;
// let gender = person.gender;

// console.log(name); // Sara
// console.log(age); // 25
// console.log(gender); // female

// Using Destructuring of object
let { name, age, gender } = person;
console.log(name);
console.log(age);
// using different variable names
let { name: name1, age: age1, gender:gender1 } = person;
console.log(name1);
console.log(age1);

// In object destructuring, you can pass default values ,
let{name :nameTemp, Height = 168} = person;
console.log(Height); // Height is not in object person instead of undefined Height will give Default value assigned to it

// Using Destructuring of array
const profile = ["Oluwatobi", "Sofela", "codesweetly.com"];

const [firstName, lastName, website] = profile;

console.log(firstName); // "Oluwatobi"
console.log(lastName); // "Sofela"
console.log(website); // "codesweetly.com"

// In array destructuring, you can pass default values in a similar way.,
let[firstName1,lastName1, website1,Domain = ".com"] = profile;
console.log(firstName1);
console.log(Domain);

//Swapping Variables

let x = 4;
let y = 7;

// swapping variables
[x, y] = [y, x];

console.log(x); // 7
console.log(y); // 4
// Skip Items
// You can skip unwanted items in an array without assigning them to local variables. For example,

const arrValue = ['one', 'two', 'three'];

// destructuring assignment in arrays
const [i, , j] = arrValue;

console.log(i); // one
console.log(j); // three

// Assign Remaining Elements to a Single Variable
// You can assign the remaining elements of an array to a variable using the spread syntax
let[first, ...all]= arrValue;
console.log(first); // one
console.log(all); 
// same way for object
let {PropFirst, ...rest } = person;

console.log(PropFirst); // Sara
console.log(rest); // {age: 25, gender: "female"}


let arr = ['RCB','MI','KKR','GT'];
let Obj = {
    Name :"AMAN",
    Age : 21,
    Height: 168
};

console.log(arr[0], arr[1], arr[2]);
console.log(Obj.Name,Obj.Age,Obj.Height);
// using spread operator 
console.log(...arr);
// Only iterable values, like Array and String, can be spread in array literals and argument lists. Many objects are not iterable

// console.log(...Obj); // Error

// Spread Operator Inside Arrays
let arr2 = ['RR',...arr,'CSK','SRH'];
console.log(arr2);

// Spread Operator Inside Object
let obj2 = {
    weight: 59,
    city : 'Delhi'
};

let obj3 = {...Obj,...obj2};
console.log(obj3);
// rest parameter
function sum(...args)
{
    return args;
}
console.log(sum(12,23,45), typeof sum(12,23,45));
//Note: Using the rest parameter will pass the arguments as array elements.

//Spread Operator as Part of Function Argument
function add(num1,num2,num3)
{
    return (num1 + num2 + num3);
}
console.log(add(1,2,4,5,6)); // will only take first three as function can only accept 2 arguments

// copy object using spread operator

let copyObj = {...Obj};
console.log(copyObj);
copyObj.Name = 'harry';
console.log(copyObj);
console.log(Obj);

// IIFE 
var print = (function()
{
    var StrVar = "RCB";
    console.log("Inside Function: "+ StrVar);
    console.log(arr2); // global variable
})(); 
// console.log("Outside function " + print.StrVar);  here StrVar variable will give but the same variable in traditional function
// will give undefined value


function foo(outer_arg) {

    function inner(inner_arg) {
        return outer_arg + inner_arg;
    }
    return inner;  // retruning a function 
} 
let InnerFunction = foo(5); // outer_arg = 5

console.log(InnerFunction(4)); // even after foo execution has completed outer_arg value will be 5

// Outer function
function outer() {
    let arr = [];
    let i;
    for (i = 0; i < 4; i++) {
        // storing anonymous function
        arr[i] = function () { return i; }
    }

    // returning the array.
    return arr;
}

let get_arr = outer();

console.log(get_arr[0]());
console.log(get_arr[1]());
console.log(get_arr[2]());
console.log(get_arr[3]());

//, we have created four closures that point to the variable i which is the local variable to the function outer. 
//Closure doesn’t remember the value of the variable it only points to the variable or stores the reference of the variable and 
//hence, returns the current value. 
//In the above code when we try to update the value it gets reflected all because the closure stores the reference. 


