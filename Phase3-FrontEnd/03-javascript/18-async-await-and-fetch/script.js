// async function getDataFromServer() {
//     return "Data from server!!";
// }
// console.log("Fetching data from server");
// let result = getDataFromServer(); // return promise
// result.then((data) => {
//     console.log(result);
//     console.log(data);
// }).catch((Err) => {
//     console.log(Err);
// })

//Simulating the process of fetching data from server
let promise = new Promise(function (resolve, reject) {
    setTimeout(function () {
        resolve('Promise resolved')
    }, 4000);
});

// async function
async function asyncFunc() {

    // without await
    let ObjResult;
    ObjResult = promise;
    console.log("Without await promise as object returned : " );
    console.log(ObjResult);
    // wait until the promise resolves 
    ObjResult = await promise;
    console.log("With await promise's rejected or resolved value returned : " );
    console.log(ObjResult);
    //Note: we can't use then or catch with returned value return by await 
    console.log("Process completed");
}
asyncFunc().then(()=>
{
    console.log('Successfully completed');
}).catch(()=>
{
    console.log("error");
});
// fetch

// fetch('https://jsonplaceholder.typicode.com/todos/1')
//       .then(response => response.json())
//       .then(json => console.log(json))

async function UseOfFetch()
{
    const responseobj = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    const responseData = await responseobj.json();
    console.log(responseData);
}
UseOfFetch();