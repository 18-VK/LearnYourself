//function declaration
function add(a,b)
{
    return (a+b);
}

// calling 
let c = add(3,5);
console.log(c);

// Hoisting using Function Declaration

let diff = subtract(2,4);  // calling function before declaration

function subtract(a,b)
{
    return (a>=b)?(a-b) :(b-a);
}

console.log(diff);


// function expression

let  addition = function(a, b) { 
  
    return a + b;
  
};

let  total = addition(5, 5) ;

console.log(total);

// arrow function

const greet = name => console.log("Hello " + name); //don't need to use paraenthesis and return if it has single line statement

const print = () => console.log("Arrow function without any parameter");
greet("Aman");
print();
// Syntax :-
// const functionName = (arg1, arg2, ?..) => {  
//     //body of the function  
// }  


//CallBack function using Timer:

function paritech() {

console.log('Hello world');

}

function sayName(name) {

console.log('Hello' + ' ' + name);

}

// calling the function

setTimeout(paritech, 2000);

sayName('John');

// Output:

// Hello John

// Hello world

// Explanation of this example

// First we call the sayName function so,  It prints (Hello John) and after 2 seconds greet functions will call, it prints the output as Hello World.

