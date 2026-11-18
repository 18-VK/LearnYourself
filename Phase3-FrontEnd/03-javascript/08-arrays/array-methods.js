let Values = [12,34,56,0,3,4];
// filter
let result = Values.filter(num => num % 2 == 0);
console.log(result);
// map
result = Values.map(num => num *2);
console.log(result);
// concat
console.log(Values.concat(result));
//reduce
// sum of value using reduce method
console.log(Values.reduce((Initial,Current)=>
{
    return Initial + Current;
}));
// splice
let removedValues = Values.splice(0,3);
console.log(Values);
console.log(removedValues);
//slice
console.log(removedValues.slice(0,2));
console.log(removedValues);

//push
Values.push(90);
console.log(Values);
Values.push(98,99);
console.log(Values);
// pop 
Values.pop();
console.log(Values);


