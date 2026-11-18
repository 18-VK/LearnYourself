// Shared by the page (<script src="primes.js">) and the worker (importScripts("primes.js")).
// Deliberately slow trial division, so the work takes a second or two.
function countPrimes(limit) {
  let count = 0;
  for (let n = 2; n < limit; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) count++;
  }
  return count;
}
