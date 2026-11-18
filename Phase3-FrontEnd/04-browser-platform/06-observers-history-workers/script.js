// ---------- Log + MutationObserver ----------
const logList = document.getElementById("log");
const logCount = document.getElementById("log-count");

function log(text) {
  const li = document.createElement("li");
  li.textContent = text;
  logList.append(li);
  logList.scrollTop = logList.scrollHeight;
}

// Watches the log list and updates the counter. It writes to a *different* element,
// so the callback cannot trigger itself in a loop.
const logObserver = new MutationObserver((records) => {
  const added = records.reduce((sum, record) => sum + record.addedNodes.length, 0);
  logCount.textContent = String(logList.children.length);
  console.log(`MutationObserver: ${records.length} record(s), ${added} node(s) added`);
});
logObserver.observe(logList, { childList: true });

// ---------- 1. IntersectionObserver ----------
const gallery = document.getElementById("gallery");

function placeholderImage(n) {
  const hue = (n * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
    <rect width="100%" height="100%" fill="hsl(${hue}, 70%, 55%)"/>
    <text x="50%" y="58%" font-size="48" text-anchor="middle" fill="white" font-family="sans-serif">${n}</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

for (let n = 1; n <= 12; n++) {
  const figure = document.createElement("figure");
  figure.className = "card";
  figure.dataset.card = String(n);
  const img = document.createElement("img");
  img.alt = `Placeholder image ${n}`;
  img.width = 320;
  img.height = 180;
  img.dataset.src = placeholderImage(n); // real src is set only when the card gets close
  figure.append(img);
  gallery.append(figure);
}

// Lazy loading: start loading 100px before the image scrolls into the gallery box.
const lazyObserver = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    img.src = img.dataset.src;
    observer.unobserve(img); // load once, then stop watching
    log(`lazy: loaded image ${img.closest(".card").dataset.card}`);
  }
}, { root: gallery, rootMargin: "100px 0px" });

// Impression tracking: at least 50% visible for 1 second, counted once per card.
const impressionTimers = new Map();
const impressionObserver = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    const card = entry.target;
    if (entry.isIntersecting) {
      const timer = setTimeout(() => {
        log(`impression: card ${card.dataset.card} (>= 50% visible for 1 s)`);
        observer.unobserve(card);
        impressionTimers.delete(card);
      }, 1000);
      impressionTimers.set(card, timer);
    } else {
      clearTimeout(impressionTimers.get(card)); // scrolled away too soon
      impressionTimers.delete(card);
    }
  }
}, { root: gallery, threshold: 0.5 });

gallery.querySelectorAll(".card").forEach((card) => {
  lazyObserver.observe(card.querySelector("img"));
  impressionObserver.observe(card);
});

// ---------- 2. ResizeObserver ----------
const resizable = document.getElementById("resizable");
const sizeOutput = document.getElementById("size");

const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { inlineSize, blockSize } = entry.contentBoxSize[0];
    // The readout lives outside the observed box, so updating it cannot resize the box again.
    sizeOutput.textContent = `${Math.round(inlineSize)} x ${Math.round(blockSize)} px`;
    entry.target.classList.toggle("is-narrow", inlineSize < 260);
  }
});
resizeObserver.observe(resizable);

// ---------- 3. Worker ----------
const dot = document.getElementById("dot");
const framesOutput = document.getElementById("frames");
const result = document.getElementById("result");
const limitInput = document.getElementById("limit");
let frames = 0;

function animate(time) {
  const trackWidth = dot.parentElement.clientWidth - dot.offsetWidth;
  const x = (Math.sin(time / 500) + 1) / 2 * trackWidth;
  dot.style.transform = `translateX(${x}px)`;
  framesOutput.textContent = String(++frames);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

let worker = null;
function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker("worker.js"); // classic worker; module workers: new Worker(url, { type: "module" })
  } catch (error) {
    result.textContent = "Could not start the worker. Open the page through a local server, not file://.";
    log(`worker error: ${error.message}`);
    return null;
  }
  worker.addEventListener("message", (event) => {
    const data = event.data;
    if (data.type === "primes-result") {
      result.textContent = `Worker: ${data.count} primes below ${data.limit} in ${data.ms} ms. The page stayed responsive.`;
      log(`worker: done in ${data.ms} ms`);
    }
    if (data.type === "buffer-received") {
      log(`worker: received a buffer of ${data.byteLength} bytes`);
    }
  });
  worker.addEventListener("error", (event) => {
    result.textContent = "The worker failed to load. Open the page through a local server, not file://.";
    log(`worker error: ${event.message || "script could not be loaded"}`);
    event.preventDefault();
  });
  return worker;
}

document.getElementById("run-main").addEventListener("click", async () => {
  const limit = Number(limitInput.value);
  result.textContent = "Running on the main thread...";
  await new Promise((resolve) => setTimeout(resolve, 50)); // let the message paint first
  const start = performance.now();
  const count = countPrimes(limit); // blocks: no frames, no typing, no clicks until it returns
  const ms = Math.round(performance.now() - start);
  result.textContent = `Main thread: ${count} primes below ${limit} in ${ms} ms. The page was frozen meanwhile.`;
  log(`main thread: one long task of ${ms} ms`);
});

document.getElementById("run-worker").addEventListener("click", () => {
  const w = getWorker();
  if (!w) return;
  result.textContent = "Running in the worker...";
  w.postMessage({ type: "count-primes", limit: Number(limitInput.value) });
});

document.getElementById("transfer").addEventListener("click", () => {
  const w = getWorker();
  if (!w) return;
  const buffer = new ArrayBuffer(32 * 1024 * 1024);
  log(`page: before transfer, byteLength = ${buffer.byteLength}`);
  w.postMessage({ type: "buffer", buffer }, [buffer]); // second argument: transfer list
  log(`page: after transfer, byteLength = ${buffer.byteLength} (detached)`);
});
