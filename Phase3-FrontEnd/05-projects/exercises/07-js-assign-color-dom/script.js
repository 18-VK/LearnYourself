var lower_limit= 0;
var upper_limit = 255;

var red, green, blue;
let boxes = document.querySelectorAll('.box');

boxes.forEach(element => {
    red = lower_limit + Math.random() * upper_limit;
    green = lower_limit + Math.random() * upper_limit;
    blue = lower_limit + Math.random() * upper_limit;
    // element.style.backgroundColor = "rgb(red,green,blue)";
    element.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
});