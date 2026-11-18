// Layout thrashing demo: interleaved DOM reads and writes vs batched ones.
const COUNT = 1000;
const grid = document.getElementById('grid');
const ruler = document.getElementById('ruler');
const output = document.getElementById('output');

for (let i = 0; i < COUNT; i++) {
  const box = document.createElement('div');
  box.className = 'box';
  grid.append(box);
}
const boxes = [...grid.children];

function randomWidth(base) {
  return `${(base / 8) * (0.5 + Math.random())}px`;
}

function report(label, ms) {
  const line = `${label}: ${ms.toFixed(1)} ms`;
  console.log(line);
  output.textContent = `${line}\n${output.textContent}`;
}

// ❌ read → write → read → write: every read forces a synchronous layout,
// because the write just before it made layout dirty.
document.getElementById('thrash').addEventListener('click', () => {
  const t0 = performance.now();
  for (const box of boxes) {
    const width = ruler.offsetWidth;     // read: forces style + layout
    box.style.width = randomWidth(width); // write: invalidates layout again
  }
  report('Interleaved', performance.now() - t0);
});

// ✅ read once, then only write: no forced layout inside the loop.
// The browser lays the page out once, at the next frame (not included in the printed time).
document.getElementById('batched').addEventListener('click', () => {
  const t0 = performance.now();
  const width = ruler.offsetWidth;       // one read
  for (const box of boxes) {
    box.style.width = randomWidth(width); // writes only
  }
  report('Batched', performance.now() - t0);
});

document.getElementById('reset').addEventListener('click', () => {
  for (const box of boxes) box.style.width = '';
  output.textContent = '';
});
