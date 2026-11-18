console.log("Enum using object.freeze() method");
const DaysOfWeek = Object.freeze({
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thrusday: 5,
  Friday: 6,
  Saturday: 7,
});

console.log(DaysOfWeek.Thrusday);
// try to modify
DaysOfWeek.Thrusday = 10;
console.log(DaysOfWeek.Thrusday);
DaysOfWeek.None = 16; // try to add
console.log(DaysOfWeek.None); // undefined

// Object 1
const person = {
  fullName: function () {
    return this.firstName + " " + this.lastName;
  }
}
// Object  2
const person1 = {
  firstName: "John",
  lastName: "Doe"
}
console.log(person.fullName.call(person1));

// The call() method can accept arguments:

const objperson = {
  fullName: function (city, country) {
    return this.firstName + " " + this.lastName + "," + city + "," + country;
  }
}
console.log(objperson.fullName.call(person1, "Delhi", "India"));
console.log(person1['firstName']);

class Train {
  constructor() {
    this.length = 0; 
  }
  add(car, contents) {
    this[car] = contents;
    this.length++;
  }
}
let freightTrain = new Train();
freightTrain.add('refrigerator car', 'cattle');
freightTrain.add('flat car', 'aircraft parts');
freightTrain.add('tank car', 'milk');
freightTrain.add('hopper car', 'coal');

console.log(freightTrain['refrigerator car']);