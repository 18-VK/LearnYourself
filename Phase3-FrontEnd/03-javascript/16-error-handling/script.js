// error handling 
let num1 = prompt("Enter a number below");
let num2 = prompt("Enter another number below");

// try {
//     //throw a custom error 
//     const result = num1 / num2;
//     // console.log(result);
//     if (isNaN(result) || result === Infinity)
//         throw Error('input numbers are not valid ')
//     console.log(result);
// }
// catch (err) {
//     console.log(err);
// }
// finally {
//     //here finally will always call.. but this not only work finally do 
//     console.log("Task completed.")
// }

// lets take an example
function ErrorHandlingExample() {
    try {
        //throw a custom error 
        const result = num1 / num2;
        // console.log(result);
        if (isNaN(result) || result === Infinity)
            throw Error('input numbers are not valid ')
        console.log(result);
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
    finally {
        // where are returning in both scenario, so what you think? now will it get execute ?
        // Answer is :- it will that why we use finally 
        // if we want to execute something after returning from a block within a function then we can using finally block
        console.log("Task completed.");
    }
}
ErrorHandlingExample();