let choice1 = {1:"Amazing",2:"Crazy",3:"Fire"};
let choice2 = {1:"Engine", 2:"food", 3:"Garments"};
let choice3 = {1:"Bros", 2:"limited", 3:"Hub"};
let lower_limit = 1;
let upper_limit = 3;
let Index1 = parseInt(lower_limit + Math.random() * upper_limit);  // this "Math.random() * upper_limit' will be btw 0 to 2 we need to add 1 to make it 1 to 3 
let Index2 = parseInt(lower_limit + Math.random() * upper_limit);  
let Index3 = parseInt(lower_limit + Math.random() * upper_limit); 

console.log(`Business Name: ${choice1[Index1]} ${choice2[Index2]} ${choice3[Index3]}`);
