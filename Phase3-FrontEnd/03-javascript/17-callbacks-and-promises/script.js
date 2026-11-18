let callbck = () => {
    console.log("Callback function called!!");
}

function print(value, callbck) {
    console.log('passed value :' + value);
    callbck();
}

print('aman', callbck);

//  program that shows the delay in execution

function greet() {
    console.log('Hello world');
}

function sayName(name) {
    console.log('Hello' + ' ' + name);
}

// calling the function
setTimeout(greet, 2000);
sayName('John');


// Callback Function Example to handle it 
function greet(name, myFunction) {
    console.log('Hello world');

    // callback function
    // executed only after the greet() is executed
    myFunction(name);
}

// callback function
function sayName(name) {
    console.log('Hello' + ' ' + name);
}

// calling the function after 2 seconds
setTimeout(greet, 2000, 'John', sayName);


//Promise
//creating a promise
// function resolve()
// {
//     console.log('request completed successfully');
// }
// function reject()
// {
//     console.log('error occured!');
// }
//Creation of promise
let promise1 = new Promise(function (resolve, reject) {
    if (Math.random() >= 0.5)
        resolve("I am done");
    else
        reject('request rejected');
});
// calling promise
// promise1.then((value) => {
//     //On Resolved/fulfilled or success
//     console.log(value);
// }, (err) => {
//     //On rejected 
//     console.log(err);
// });
//Note: use parameter to get value return by resolved and reject call, optional..
// Catch reject/failed response using Catch() methhod

promise1.then((val) => {
    console.log(val);
}).catch((err) => {
    console.log(err);
})

//  chain of promises
let ObjPromise = new Promise((Success,Failed)=>{
    if (Math.random() >= 0.5)
        Success("Request successfully completed");
    else
        Failed('Error as Request rejected');
});

let result = ObjPromise.then((val)=>
{
 console.log(val); 
 return "Result :" + val ; // if don't return the Promise, result will be undefined in returned object
});
//console.log(result); // return Promise result as undefined if nothin is been return through then() method

// so Now use this returned object to make a chain of Promises
// added another promise that will wait for ObjPromise to response and using that response will proccess futhur
result.then((resultofObjPromise)=>
{
    console.log(resultofObjPromise);
}).catch((err)=>
{
    console.log(err);
})