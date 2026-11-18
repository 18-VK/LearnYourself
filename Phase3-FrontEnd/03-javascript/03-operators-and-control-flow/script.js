let a = 3;
let b = 4;

// exponential operator(Arthmetic operator)
console.log(a**b);   // 3^4

// strict equality operator
//e.g
b = "3";

console.log(a==b); // true becoz only value is getting compare not considering type here
console.log(a===b); // false becoz here type is also getting compare..

// strict inequality operator 

if(a !==b)
{
    console.log("May the value or their type is not equal");
}
else
{
    console.log("Equal");
}

// ternary operator 

console.log((a === b)? "true" : "false");