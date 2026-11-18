const person = {
  name: ["Bob", "Smith"],
  age: 32,
  bio: function () {
    console.log(`${this.name[0]} ${this.name[1]} is ${this.age} years old.`);
  },
  introduceSelf: function () {
    console.log(`Hi! I'm ${this.name[0]}.`);
  },
};
console.log(person.bio());
console.log("Type of person's name " + typeof person.name);
//An object property can itself be an object.
const person2 = {
  name: {
    first: "Bob",
    last: "Smith",
  },
  age: 32
};
console.log(person2.name);
console.log("Type of person 2's name " + typeof person2.name);

console.log(person2.name.first); // dot notation 
console.log(person2['name']['first']); // backet notation

// setting property to object
person.phone = "555-0100";
console.log(person);

// Functions are objects

function message() {
  console.log("Greetings Linda!");
}

console.log(typeof message);               // => function
console.log(message instanceof Object);  // true

//Function Constructor 
function FuncPerson(firstName, lastName) {
  // this = {};

  // add properties to this
  this.firstName = firstName;
  this.lastName = lastName;

  // add Method to this
  this.getFullName = function () {
    return this.firstName + " " + this.lastName;
  };
  // return this;
}

let ObjFuncPerson = new FuncPerson('Aman','Kumar');
let ObjectPerson2 = new FuncPerson("Virat","Kohli");
console.log(ObjFuncPerson.getFullName());
// Adding a new property to an existing object 
ObjectPerson2.Age = 37;

console.log("ObjectPerson2 age:" + ObjectPerson2.Age);
console.log("ObjFuncPerson age: " + ObjFuncPerson.Age); // Undefined becoz Age only belong to ObjectPerson2

// You cannot add a new property to an object constructor the same way you add a new property to an existing object:
FuncPerson.City = "Delhi";
console.log(ObjFuncPerson.City); // Undefined

// Function prototype
//--------------------- 
function Car() {
  console.log("Car instance created!");
};
// add a property to prototype
Car.prototype.color = "Red";

// add a method to the prototype
Car.prototype.drive = function () {
  console.log(`Driving the car painted in ${this.color}...`);
};

// display the added property
console.log(`The car's color is: ${Car.prototype.color}`);

// call the added method 
Car.prototype.drive(); // Function prototype

let ObjCar = new Car();
console.log(ObjCar.__proto__); // Object Prototype 