// Array 
let array =['Perry','smriti','RCB'];

console.log(array[1]);
console.log(array.pop()); // remove element from end of array
console.log(array);

console.log(typeof array); // Array is object in JS
console.log(array.push('Into the final of 2024'));
console.log(array);

// A single array can hold more than one type of element 
array.push(2024);
console.log(array);
console.log(array.length);

console.log(typeof array[3]);
console.log(typeof array[2]);

let obj ={1:"all rounder", 2:"Opener"};
array.push(obj);
console.log(array);
console.log(typeof array[4]);

// We can print array as string
console.log(array.toString());

//remove element from start
console.log(array.shift());
console.log(array);

// delete element at from any index
delete array[2]; // will delete element but space will not delete..
console.log(array);
console.log(array.length); 
console.log(array[2]); // undefined

// add element in starting of array
array.unshift('Perry');
console.log(array);

// concat two array

let arr1 = ["VK",18];
let arr2 = ["ABD",17];
let final = arr1.concat(arr2);

console.log(final);
final[2] = "565";
console.log(arr2);

console.log(arr2.sort());

let nums = [1,2,3,4,5];

// nums.splice(1,3); //arg1 - start index, arg2 - nums of element
// console.log(nums);

// splice and add in place of them
nums.splice(1,3,22,33); // removed 3 element and add 2 in place of them 
console.log(nums);

//slice array
let part1= nums.slice(0,2);
console.log(part1);
console.log(nums);

// iterate array
for (let i = 0; i < nums.length; i++) {
    console.log(nums[i]);
}

// foreach method of array
nums.forEach((value,index)=> console.log(index,value));


// Map function - To get a copy of array
// Syntax :- array.map(function(currentValue, index, arr), thisValue) 

let newNumsArr = nums.map((e=> e*2)); // arrow function as call back
console.log(newNumsArr);


//filter function
let filteredArr = nums.filter((value=>{ return (value%2) == 0? value : undefined}));

console.log(filteredArr);

const add =(a,b) => (a+b); // add function
console.log(nums.reduce(add));

