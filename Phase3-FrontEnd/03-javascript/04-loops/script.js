// for loop

for(let i =0; i<5; i++)
{
    console.log("Sigma Web Dev");
}

// for in (object) 
let person ={Name: "Aman", Age:20};

for (const key in person) {
    const value = person[key];
    console.log(key +" : " + value);
}

// for of (array or string)

var Name = "Aman";  // it should be string or array can't be a number
for (const i of Name) {
    console.log(i);
}

// while
let c = 4;
while(c <8)
{
    console.log(c);
    c++
}

// do while
c = 11;
do {
    console.log(c);
    c++
} while (c<10);