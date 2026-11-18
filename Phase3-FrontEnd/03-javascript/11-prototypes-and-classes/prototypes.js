//Object prototype and prototype inheritance
let human ={
    speak:  ()=>{
        console.log("Hey!!!");
    },
    Food_type: ['Veg','Non-veg']
}

let Man ={
    Name :"Aman",
    // Inherit properties of human
    __proto__ : human
}
// Inherit properties of human

// Man.__proto__ = human;
console.log(Man);  
console.log(Man.speak());

// Class
class Automobile
{
    // variable of class
    myField = "foo";
    constructor(name)
    {
        this.name = name; // no need to declare it 
    }
    get_value(){
        return myField;
    }
}
let obj = new Automobile();
console.log(obj.get_value());

// Encapsulation 
// Using Closures

function Person(firstName, lastName) {
  let _firstName = firstName;
  let _lastName = lastName;

  this.getFirstName = function() {
    return _firstName;
  };

  this.getLastName = function() {
    return _lastName;
  };

  this.greet = function() {
    console.log(`Hello, my name is ${this.getFirstName()} ${this.getLastName()}`);
  };
}

const sam = new Person('Sam', 'Smith');
sam.greet(); // Hello, my name is Sam Smith

// Using Private Fields (ES2020)

class Person {
  #firstName;
  #lastName;

  constructor(firstName, lastName) {
    this.#firstName = firstName;
    this.#lastName = lastName;
  }

  greet() {
    console.log(`Hello, my name is ${this.#firstName} ${this.#lastName}`);
  }
}

const alice = new Person('Alice', 'Johnson');
alice.greet(); // Hello, my name is Alice Johnson
