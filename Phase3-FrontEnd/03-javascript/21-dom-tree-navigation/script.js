console.log("DOM Node properties");
//Get all node 
/* document.body.childNodes;
 output - NodeList(4) [text, div.container, text, div#fs_div_all]
Note:- Here blank space after opening tag is also consider as node(text Node)
*/

//FirstChild 
/* document.body.childNodes[1].firstChild
 output:- here it will be #text
*/

//LastChild
/*
document.body.childNodes[1].lastChild
output :- Here also it will be #text
*/

//nextSibling
/*document.body.childNodes[1].firstChild.nextSibling
 output:- Box1 
*/

//Parent Node
/*
document.body.childNodes[1].firstChild.parentNode
output:- Container
*/
// Nodename
/*
document.body.childNodes[1].nodeName
output: element name 'Div'
*/

// Note:- check notes.. 

//Get elements (No other node will be included)


//Firstelement
/*
    document.body.firstElementChild
    output:- Container
*/

//lastelement
/*
    document.body.firstElementChild.lastElementChild
    output:- Container's box5
*/

//parent element
/*
let box = document.body.firstElementChild.lastElementChild;
box.parentElement
*/

//previous element
/*
let box = document.body.firstElementChild.lastElementChild;
box.previousElementSibling
output : box4
*/

//next element
/*
let box = document.body.firstElementChild.firstElementChild;
box.nextElementSibling
output : box2
*/