console.log("using getElementById");

let box2 = document.getElementById('B2')
console.log(box2);
box2.style.backgroundColor = "green";

console.log("Using getElementsByClassName");
let box3 = document.getElementsByClassName('box3');
console.log(box3); // it return a collection which contains all element with class name 

box3[0].style.backgroundColor = "red"

console.log("using getElementsByTagName");
let divElements = document.getElementsByTagName('div');
console.log(divElements);

for (let index = 0; index < divElements.length; index++) {
    divElements[index].style.textAlign = "center";
}

console.log("Using queryselector");
let element = document.querySelector('.box');

element.style.width = "50px";

console.log("Using queryselectorAll");
let elements = document.querySelectorAll('.box');

for (let index = 0; index < elements.length; index++) {
    elements[index].style.height = "120px";
}
