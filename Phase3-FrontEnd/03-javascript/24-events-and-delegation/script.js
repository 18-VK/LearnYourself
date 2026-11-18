function random(number) {
    return Math.floor(Math.random() * (number + 1));
}

let box = document.querySelector('.box');
let btn = document.getElementById('BTN1');
let eventHandler = () => {
    box.style.backgroundColor = `rgb(${random(255)},${random(255)},${random(255)})`;
}
// btn.addEventListener('click', () => {
//     box.style.backgroundColor = `rgb(${random(255)},${random(255)},${random(255)})`;
// })

btn.addEventListener('click',eventHandler);
btn.removeEventListener('click',eventHandler); // removed

// Event bubbling

let innermost = document.querySelector('.innermost');

console.log(innermost);
innermost.addEventListener('click',(e) =>{
    alert('innermost called!');
    e.stopPropagation(); // stop event call propogate to parent 'Middle' element
    console.log(e);
});
let middle = document.querySelector('.middle');

middle.addEventListener('click',(e)=>{
    e.stopPropagation(); // stop event call propogate to parent 'outermost' element
    alert('middle called!');
});
let outermost = document.querySelector('.outermost');

outermost.addEventListener('click',(e)=>{
    alert('outermost called!');
});

let ret = setInterval(eventHandler,2000);
clearInterval(ret);

let ret1 = setTimeout(eventHandler,2000); // only once
clearTimeout(ret1);

//Event Capturing 

// let innermost = document.querySelector('.innermost');

// console.log(innermost);
// innermost.addEventListener('click',(e) =>{
//     alert('innermost called!');
//     console.log(e);
// },true);
// let middle = document.querySelector('.middle');

// middle.addEventListener('click',(e)=>{
//     alert('middle called!');
// },true);
// let outermost = document.querySelector('.outermost');

// outermost.addEventListener('click',(e)=>{
//     e.stopPropagation();
//     alert('outermost called!');
// },true);
