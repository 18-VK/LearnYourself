console.log("DOM element insertion and deleteion");

let cont = document.body.getElementsByClassName('container');
console.log(cont);
console.log(cont[0].tagName); // Div - tagname for element , we can use node name for element also 
console.log(document.body.firstChild.nodeName); // text node, node name to non - element type, can't use tagname here

console.log("using Inner HTML");
console.log(cont[0].firstElementChild.innerHTML);

console.log("using outer HTML");
console.log(cont[0].firstElementChild.outerHTML);

console.log(cont[0].childNodes); // second node is comment

console.log("using node value");
console.log(cont[0].childNodes[1].nodeValue);

console.log("using text content ");
console.log(cont[0].textContent);

let ele = document.getElementById('NotHiddenEle');
ele.hidden = true;

// Attribute method

if(ele.hasAttribute('hidden'))
{
    console.log("using hasAttribute");
    ele.hidden = false;
}

console.log("using getAttribute");
console.log(ele.getAttribute('id'));

console.log("using setAttribute");
ele.setAttribute('class', 'Class1');
console.log(ele.hasAttribute('class'));

console.log("using removeAttribute");
ele.removeAttribute("class");    
console.log(ele.hasAttribute('class'));

console.log("using Attributes");
console.log(ele.attributes);

console.log("using creatAttribute");
const att = document.createAttribute("hidden");
att.value = true
ele.setAttributeNode(att);
console.log(ele.attributes);
console.log(ele.outerHTML)
// Diff between setAttribute and setAttributeNode - https://www.w3schools.com/jsref/met_element_setattributenode.asp

console.log(document.querySelector(".box").dataset);


// Insertion and deletion of elements/nodes

// Insertion
const div_box = document.createElement('div');
div_box.setAttribute('class','box');
div_box.innerHTML = "Box5";
document.querySelector('.container').append(div_box); // add node in last

const text_node = document.createTextNode('This is new text node');
document.body.append(text_node);

// insert before
const container = document.querySelector('.container');

const temp_box = document.createElement('div');
temp_box.setAttribute('class','box');
temp_box.innerHTML = 'temp box';

// container.append(temp_box);
// syntax - insertBefore(newNode, referenceNode)
// made a copy
container.insertBefore(temp_box,div_box);

const cloneEle = temp_box.cloneNode(); // clone a element 
//Warning: cloneNode() may lead to duplicate element IDs in a document!
cloneEle.innerHTML = 'clone';
console.log(cloneEle);

// container.before(cloneEle);
temp_box.after(cloneEle); 

temp_box.insertAdjacentHTML('afterend','<p> insert adjacent html </p>');
// remove your child
// container.removeChild(temp_box);
// remove yourself
// div_box.remove();

container.replaceChild(cloneEle,div_box); // removed div box and replace it with cloneele

console.log(temp_box.classList);
console.log(temp_box.className);
temp_box.classList.add('temp');
console.log(temp_box.classList);
console.log(temp_box.className);

temp_box.classList.toggle('temp'); // if already added then remove otherwise add
console.log(temp_box.classList);
console.log(temp_box.className);

console.log(temp_box.classList.contains('temp'));

