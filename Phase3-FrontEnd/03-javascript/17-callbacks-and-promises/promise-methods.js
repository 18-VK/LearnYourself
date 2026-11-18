const ObjPromise1 = new Promise((resolve, reject) => {
    setTimeout(resolve, 300, "resolved");//Handler,time,argument to handler
});
const ObjPromise2 = new Promise((resolve, reject) => {
    if (Math.random() >= 0.5)
        setTimeout(resolve, 100, "resolved2");//Handler,time,argument to handler
    else
        reject("Rejected!")
});
const ObjPromise3 = 93; //non-promise

//Promise.all()

const result = Promise.all([ObjPromise1, ObjPromise2, ObjPromise3]) // passed a non-promise value also
console.log(result);

result.then((values) => {
    console.log("Using Promise.all()");
    console.log(values);
}).catch((msg) => {
    console.log("Using Promise.all()");
    console.log(msg);
});
//Promise.any
const resultAny = Promise.any([ObjPromise1, ObjPromise2]) // passed a non-promise value also

resultAny.then((values) => {
    console.log("Using Promise.any()");
    console.log(values); // output: resolved2 because it will get completed first
}).catch((msg) => {
    console.log("Using Promise.any()");
    console.log(msg);
});
//Rejection of Promise.any()
const ObjPromise = new Promise((resolve, reject) => {
    setTimeout(reject, 100, "Reject");//Handler,time,argument to handler
});
const rejection = Promise.any([ObjPromise]);
ObjPromise.then((values) => {
    console.log(values);
}).catch((msg) => {
    console.log(msg); // AggregateError 
})
//Promise.allsettle()
const objAllSettle = Promise.allSettled([ObjPromise1, ObjPromise2, ObjPromise3]);

objAllSettle.then((values) => {
    console.log("Using Promise.allsettle()");
    console.log(values);
}).catch((msg) => {
    console.log("Using Promise.allsettle()");
    console.log(msg);
});

// Promise.race()
const pro1 = new Promise((resolve, reject) => {
    setTimeout(() => resolve("one"), 200);
});

const pro2 = new Promise((resolve, reject) => {
    setTimeout(() => resolve("two"), 100);
});

const pro3 = new Promise((resolve, reject) => {
    setTimeout(() => reject("rejected"), 300);
});

const pro4 = new Promise((resolve, reject) => {
    setTimeout(() => resolve("four"), 400);
});

Promise.race([pro1, pro2, pro3, pro4])
    .then((response) => {
        console.log("Using Promise.race()");
        console.log(response);
    })
    .catch((err) => {
        console.log("Using Promise.race()");
        console.log(err);
    });
