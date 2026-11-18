// A classic dedicated worker: no DOM, no window, its own global scope (self).
importScripts("primes.js"); // classic workers load helpers synchronously; module workers use import

self.addEventListener("message", (event) => {
  const message = event.data; // a structured clone of what the page sent

  if (message.type === "count-primes") {
    const start = performance.now();
    const count = countPrimes(message.limit);
    self.postMessage({
      type: "primes-result",
      limit: message.limit,
      count,
      ms: Math.round(performance.now() - start),
    });
  }

  if (message.type === "buffer") {
    // The buffer was transferred, not copied: it now belongs to this worker.
    self.postMessage({ type: "buffer-received", byteLength: message.buffer.byteLength });
  }
});
