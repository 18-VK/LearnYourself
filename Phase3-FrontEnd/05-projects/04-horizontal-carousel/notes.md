# Infinite Card Carousel with Horizontal Scrolling

> Project · Topic 4 · Demo: [index.html](index.html) · [style.css](style.css) · [script.js](script.js)

A responsive, infinitely looping card slider built on a plain horizontally scrolling list. CSS Grid lays the cards out in one row and scroll snapping lines them up; JavaScript adds arrow buttons, mouse dragging, an endless loop and autoplay. The snippet is based on CodingNepal's "Infinite Card Slider JavaScript" tutorial (credited in `index.html`) and is a good way to learn the DOM measuring properties `offsetWidth`, `scrollWidth` and `scrollLeft`, plus `matches()` and `draggable`.

## What It Does

- Shows six profile cards in one horizontal row: **3 per view** on desktop, **2** below 900px, **1** below 600px.
- The left and right arrows scroll by one card.
- You can **drag** the row with the mouse.
- It loops **forever** in both directions.
- It **autoplays** every 2.5 seconds on screens 800px and wider, and pauses while the mouse is over it.

## Layout: CSS Grid as a Horizontal Track

```css
.wrapper .carousel {
  display: grid;
  grid-auto-flow: column;                       /* new items go into new COLUMNS, not rows */
  grid-auto-columns: calc((100% / 3) - 12px);   /* each card is about a third of the width */
  gap: 16px;
  overflow-x: auto;                             /* the row scrolls horizontally */
  scroll-snap-type: x mandatory;                /* always come to rest on a card edge */
  scroll-behavior: smooth;                      /* programmatic scrolls animate */
  scrollbar-width: none;                        /* hide the scrollbar (Firefox, newer Chrome) */
}
.carousel::-webkit-scrollbar { display: none; } /* hide it in Chrome, Edge, Safari */

.carousel .card {
  scroll-snap-align: start;                     /* the card's left edge is the snap point */
}

@media screen and (max-width: 900px) {
  .wrapper .carousel { grid-auto-columns: calc((100% / 2) - 9px); }  /* 2 per view */
}
@media screen and (max-width: 600px) {
  .wrapper .carousel { grid-auto-columns: 100%; }                    /* 1 per view */
}
```

- **`grid-auto-flow: column`** plus **`grid-auto-columns`** is the trick: there are no defined columns, so every `<li>` creates a new implicit column of that width, and the row grows wider than its container and scrolls.
- **Why `- 12px`?** Three cards share two 16px gaps (32px), which is about 10.7px per card. Subtracting 12px makes sure three cards plus gaps fit with a few pixels to spare. The exact formula is `calc((100% - 2 * 16px) / 3)`; for two per view, `calc((100% - 16px) / 2)`.
- **Scroll snapping** (`scroll-snap-type` on the container, `scroll-snap-align` on the items) makes the browser finish every scroll, by finger, wheel or code, exactly on a card edge.

Helper classes switch those features off when the script needs instant, free movement:

```css
.carousel.no-transition { scroll-behavior: auto; }   /* jump instantly (for the loop) */
.carousel.dragging {
  scroll-snap-type: none;                            /* follow the mouse freely */
  scroll-behavior: auto;
}
.carousel.dragging .card {
  cursor: grab;
  user-select: none;                                 /* don't select text while dragging */
}
```

Other CSS worth noting:

- The arrows are absolutely positioned on the `.wrapper` (`position: relative`) and centred with `top: 50%; transform: translateY(-50%)`. `:active` adds `scale(0.85)` for a press effect, **repeating** the `translateY` because a new `transform` replaces the old one entirely.
- `.carousel :where(.card, .img)` applies the same flex centring to both selectors. `:where()` has **zero specificity**, so these rules are easy to override.
- `object-fit: cover` on the round avatar images fills the circle without stretching.

## Measuring Elements: `offsetWidth`, `clientWidth`, `scrollWidth`

The original notes saved [this Stack Overflow answer](https://stackoverflow.com/questions/21064101/understanding-offsetwidth-clientwidth-scrollwidth-and-height-respectively) explaining these properties. The script uses **`offsetWidth`** to measure a card and the visible width of the carousel.

| Property | What it measures | Used in the script for |
|---|---|---|
| `offsetWidth` | The element's full layout width: content + padding + border (+ a vertical scrollbar if there is one) | Width of one card; visible width of the carousel |
| `clientWidth` | The inner visible area: content + padding, **without** border and scrollbar | (Not used; the safer choice for "visible area") |
| `scrollWidth` | The width of **all** the content, including the part scrolled out of view | Total length of the card track |

The matching `offsetHeight`, `clientHeight` and `scrollHeight` work the same way vertically. All of them are rounded to whole pixels; use `element.getBoundingClientRect().width` when you need fractions.

```js
const carousel = document.querySelector(".carousel");
console.log(carousel.offsetWidth);  // e.g. 1100: what you see
console.log(carousel.scrollWidth);  // e.g. 4436: every card, visible or not
// The furthest you can scroll:
console.log(carousel.scrollWidth - carousel.clientWidth);
```

> **Note:** `firstCardWidth` (a card's `offsetWidth`) does not include the 16px gap, so one arrow click scrolls a little less than one full card step. Scroll snapping hides this by finishing the scroll on the nearest card edge.

## `scrollLeft`

Reference saved in the original notes: [W3Schools: scrollLeft](https://www.w3schools.com/jsref/prop_element_scrollleft.asp).

`element.scrollLeft` is how many pixels the content is scrolled from the left. You can **read** it (where are we?) and **write** it (scroll there). It ranges from `0` to `scrollWidth - clientWidth`.

```js
carousel.scrollLeft;          // read the current position, e.g. 0
carousel.scrollLeft += 300;   // scroll 300px to the right
carousel.scrollLeft = 0;      // back to the start

// The method form lets you choose smooth or instant per call:
carousel.scrollBy({ left: 300, behavior: "smooth" });
```

Because the carousel has `scroll-behavior: smooth`, writing `scrollLeft` animates. That is why the script adds the `no-transition` class when it needs an **instant** jump.

> **Note:** On high-DPI screens and with zoom, `scrollLeft` can be fractional (e.g. `1234.5`), which is why the script compares `Math.ceil(carousel.scrollLeft)` with the end position.

## How the Script Works, Step by Step

### 1. Measure

```js
const firstCardWidth = carousel.querySelector(".card").offsetWidth;
const carouselChildrens = [...carousel.children];
let cardPerView = Math.round(carousel.offsetWidth / firstCardWidth); // 3, 2 or 1
```

`carousel.children` is a **live** `HTMLCollection`. Spreading it into an array (`[...]`) takes a snapshot, so the clones added next are not looped over again.

### 2. Clone cards at both ends (the infinite-loop illusion)

```js
// Copies of the LAST few cards go to the beginning
carouselChildrens.slice(-cardPerView).reverse().forEach(card => {
  carousel.insertAdjacentHTML("afterbegin", card.outerHTML);
});
// Copies of the FIRST few cards go to the end
carouselChildrens.slice(0, cardPerView).forEach(card => {
  carousel.insertAdjacentHTML("beforeend", card.outerHTML);
});
```

With six cards and three per view, the track becomes:

```text
[4 5 6]  1 2 3 4 5 6  [1 2 3]
 clones    real cards   clones
```

`.reverse()` is needed because each `"afterbegin"` insert goes in front of the previous one; inserting 6, then 5, then 4 leaves them in the order 4 5 6.

| `insertAdjacentHTML` position | Where the HTML goes |
|---|---|
| `"beforebegin"` | Before the element itself (as a previous sibling) |
| `"afterbegin"` | Inside the element, before its first child |
| `"beforeend"` | Inside the element, after its last child |
| `"afterend"` | After the element itself (as a next sibling) |

### 3. Start on the real first card

```js
carousel.classList.add("no-transition");
carousel.scrollLeft = carousel.offsetWidth; // skip one "view" = the prepended clones
carousel.classList.remove("no-transition");
```

### 4. Arrow buttons

```js
arrowBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    carousel.scrollLeft += btn.id == "left" ? -firstCardWidth : firstCardWidth;
  });
});
```

### 5. Drag with the mouse

```js
const dragStart = (e) => {
  isDragging = true;
  carousel.classList.add("dragging");
  startX = e.pageX;                       // where the mouse went down
  startScrollLeft = carousel.scrollLeft;  // where the carousel was
};
const dragging = (e) => {
  if (!isDragging) return;
  // move the content opposite to the mouse: drag left → scroll right
  carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
};
const dragStop = () => {
  isDragging = false;
  carousel.classList.remove("dragging");
};

carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("mousemove", dragging);
document.addEventListener("mouseup", dragStop); // on document: releasing anywhere stops the drag
```

### 6. Jump back when an end is reached

```js
const infiniteScroll = () => {
  if (carousel.scrollLeft === 0) {
    // showing the clones 4 5 6 → jump to the real 4 5 6
    carousel.classList.add("no-transition");
    carousel.scrollLeft = carousel.scrollWidth - (2 * carousel.offsetWidth);
    carousel.classList.remove("no-transition");
  } else if (Math.ceil(carousel.scrollLeft) === carousel.scrollWidth - carousel.offsetWidth) {
    // showing the clones 1 2 3 → jump to the real 1 2 3
    carousel.classList.add("no-transition");
    carousel.scrollLeft = carousel.offsetWidth;
    carousel.classList.remove("no-transition");
  }
  clearTimeout(timeoutId);
  if (!wrapper.matches(":hover")) autoPlay();
};
carousel.addEventListener("scroll", infiniteScroll);
```

The clones look identical to the real cards, so the instant jump is invisible: that is the whole "infinite" trick.

### 7. Autoplay

```js
const autoPlay = () => {
  if (window.innerWidth < 800 || !isAutoPlay) return;
  timeoutId = setTimeout(() => carousel.scrollLeft += firstCardWidth, 2500);
};
autoPlay();
wrapper.addEventListener("mouseenter", () => clearTimeout(timeoutId));
wrapper.addEventListener("mouseleave", autoPlay);
```

Each autoplay step scrolls the carousel, which fires `scroll`, which (in `infiniteScroll`) clears the timer and starts a new one. So it is a **chain of `setTimeout`s**, not a `setInterval`, and the 2.5-second countdown restarts after the last scroll event. Moving the mouse onto the wrapper cancels the pending step.

## `draggable`

The images have `draggable="false"`:

```html
<img src="images/img-1.jpg" alt="img" draggable="false">
```

Images and links are draggable by default (HTML drag and drop): pressing on one and moving the mouse picks up a "ghost" copy of the image. That would hijack the carousel's own mouse drag, so it is turned off. `draggable` is an **enumerated** attribute: write `draggable="true"` or `draggable="false"`, not just `draggable`.

## `matches()`

The `matches()` method returns `true` if an element matches the given CSS selector(s), and `false` if it does not.

```js
const leftArrow = document.querySelector("#left");
console.log(leftArrow.matches("i.fa-solid"));    // → true
console.log(leftArrow.matches(".card"));         // → false
console.log(leftArrow.matches(".card, #left"));  // → true (any selector in the list)

// In the script: is the mouse over the carousel right now?
if (!wrapper.matches(":hover")) autoPlay();
```

A related method, `closest(selector)`, checks the element **and its ancestors** and returns the first match (or `null`). It is the usual tool for event delegation.

## Common Mistakes

The snippet works, but it has limits worth knowing before you use it in a real project:

- **Mouse-only dragging.** `mousedown`/`mousemove` do not fire for touch drags. Native touch scrolling still works because the list has `overflow-x: auto`, but for one code path for mouse, pen and touch, use pointer events (below).
- **Arrows are `<i>` icons, not buttons.** They cannot be reached with Tab, do nothing with Enter, and have no accessible name. Use `<button type="button" aria-label="Previous">` with the icon inside, marked `aria-hidden="true"`.
- **Cloned cards are read twice by screen readers.** Mark clones with `aria-hidden="true"` (and `inert`, so their contents cannot be focused).
- **Sizes are measured once.** `firstCardWidth` and `cardPerView` are not recalculated when the window is resized or rotated; recompute them in a `resize` handler or a `ResizeObserver`.
- **Autoplay without a pause button.** Content that moves automatically for more than five seconds needs a way to pause it (WCAG 2.2.2); pausing on hover does not help keyboard or touch users. Also skip autoplay when the user prefers reduced motion: `matchMedia("(prefers-reduced-motion: reduce)").matches`.
- **`alt="img"`** describes nothing. The person's name is already in the `<h2>`, so `alt=""` (decorative) is appropriate here.
- **Loose equality:** `btn.id == "left"` works but `===` is the safer habit.
- **`console.log` inside the `scroll` handler** runs dozens of times per second; remove it from production code.

Pointer-event version of the drag code:

```js
carousel.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") return;   // let touch screens use native scrolling
  isDragging = true;
  startX = e.pageX;
  startScrollLeft = carousel.scrollLeft;
  carousel.setPointerCapture(e.pointerId); // keep receiving moves even outside the carousel
  carousel.classList.add("dragging");
});
carousel.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
});
carousel.addEventListener("pointerup", () => {
  isDragging = false;
  carousel.classList.remove("dragging");
});
```

## Key Takeaways

- `grid-auto-flow: column` + `grid-auto-columns` turns a list into a horizontal track; `overflow-x: auto` makes it scroll.
- `scroll-snap-type` on the container and `scroll-snap-align` on the items make every scroll end on a card edge.
- `offsetWidth` = full box width, `clientWidth` = visible inner area, `scrollWidth` = all content; max scroll = `scrollWidth - clientWidth`.
- `scrollLeft` is readable and writable; with `scroll-behavior: smooth`, writing it animates, so toggle a class to jump instantly.
- The infinite loop is an illusion: clone cards at both ends and silently jump from the clones to the identical real cards.
- `draggable="false"` stops native image dragging from fighting a custom drag; `element.matches(selector)` tests an element against a CSS selector.
- Make carousels accessible: real buttons with labels, hidden clones, a pause control and respect for reduced motion.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between `offsetWidth`, `clientWidth` and `scrollWidth`?**
`offsetWidth` is the element's whole box: content, padding, border and any scrollbar. `clientWidth` is the visible inner area: content and padding only. `scrollWidth` is the full width of the content, including the part that overflows and is scrolled out of view. If `scrollWidth > clientWidth`, the element has horizontal overflow.

**Q2. How do you scroll an element horizontally with JavaScript?**
Set `element.scrollLeft` (for example `el.scrollLeft += 300`), or call `el.scrollBy({ left: 300, behavior: "smooth" })` or `el.scrollTo({ left: 0 })`. The methods let you choose smooth or instant scrolling per call; setting `scrollLeft` follows the element's CSS `scroll-behavior`.

**Q3. What does `element.matches()` do, and how is it different from `closest()`?**
`matches(selector)` returns `true` or `false` depending on whether that element itself matches the CSS selector, for example `el.matches(":hover")`. `closest(selector)` checks the element and then each ancestor, returning the first element that matches, or `null`. `closest` is the usual tool for event delegation; `matches` is a yes/no test.

**Q4. Why are the images marked `draggable="false"`?**
Images are draggable by default, so pressing and moving the mouse on one starts the browser's native drag-and-drop with a ghost image. That cancels the carousel's own `mousemove` dragging. Setting `draggable="false"` turns the native behaviour off.

**Q5. What is CSS scroll snapping?**
It lets a scroll container stop at defined positions. Put `scroll-snap-type: x mandatory` on the container and `scroll-snap-align: start` (or `center`) on the children, and the browser always finishes a scroll aligned to a child. It works for touch, wheel, keyboard and programmatic scrolling, with no JavaScript.

### Mid-level (2–4 years)

**Q6. How does this carousel create an "infinite" loop?**
It clones the last `cardPerView` cards to the front and the first `cardPerView` cards to the end. When a `scroll` handler sees that the view has reached the clones at either end, it jumps instantly (smooth scrolling temporarily disabled with a class) to the matching real cards. Because the clones look identical, the user never sees the jump.

**Q7. Why does the script spread `carousel.children` into an array before inserting clones?**
`children` is a live `HTMLCollection`: it updates the moment elements are added. Iterating over it while inserting clones would see the new clones too, giving wrong slices or even an endless loop. `[...carousel.children]` makes a static snapshot of the original six cards.

**Q8. List the changes you would make to ship this carousel in an accessible product.**
Use `<button type="button" aria-label="Previous slide/Next slide">` for the arrows, and put `aria-hidden="true"` and `inert` on the cloned cards. Add a visible pause/play control, and do not autoplay when `prefers-reduced-motion: reduce` is set. Give the region a label (`<section aria-label="Team members">`), keep visible focus styles, and make sure every card is reachable with the keyboard, for example by letting Tab focus the cards or by moving with the arrow buttons.

**Q9. The `scroll` handler runs very often. What performance issues can that cause, and how do you reduce them?**
`scroll` fires many times per second. Reading layout properties such as `scrollWidth` and `offsetWidth` there, especially mixed with writes like `scrollLeft = ...`, can force repeated layout calculations. Cache values that do not change, keep the handler small, pass `{ passive: true }` when you never call `preventDefault`, and batch work with `requestAnimationFrame` or a throttle. Where supported, the `scrollend` event lets you react only once scrolling has finished.

**Q10. Why does autoplay use `setTimeout` re-armed in the scroll handler instead of `setInterval`?**
Each autoplay step triggers scroll events, and the handler clears the pending timer and starts a new one. That restarts the 2.5-second countdown after every scroll, including manual drags and arrow clicks, so the carousel never moves right after the user did. With `setInterval`, steps would fire on a fixed beat regardless of user input and could overlap a running smooth scroll.

**Q11. The cards are sized with `calc((100% / 3) - 12px)`. Is that exact? How would you make it exact and maintainable?**
It is an approximation: three cards share two 16px gaps, so each card should lose about 10.67px, not 12px. A few pixels are left over, which is harmless but brittle if the gap changes. Store the values in custom properties and compute exactly: `--gap: 16px; --per-view: 3; grid-auto-columns: calc((100% - (var(--per-view) - 1) * var(--gap)) / var(--per-view));`, then change only `--per-view` in the media queries.

### Senior (5+ years)

**Q12. Product wants an autoplaying hero carousel with five promotions on the home page. How do you respond?**
Push back with data and offer alternatives. Engagement with carousel slides typically drops sharply after the first slide, so slides 2–5 get little attention; autoplay moves content while people are reading, hurts users with cognitive or vestibular disabilities, and adds JavaScript and images to the most important page. If five teams each want "their" slot, a carousel is often a way to avoid choosing a priority.

If a carousel still ships, make it safe: no autoplay by default (or autoplay that stops on any interaction and on focus), a visible pause button (WCAG 2.2.2), no autoplay with `prefers-reduced-motion: reduce`, only the first slide's image loaded eagerly, and analytics per slide so the next discussion uses real numbers. Recommendation: one strong hero plus a static grid of the other promotions; a carousel only for browsable sets of similar items (products, team cards), as in this demo.

**Q13. Would you build carousels on native scrolling with scroll snap, as this demo does, or on a JavaScript library that moves a track with `transform`?**

| | Native scroll + scroll snap | `transform`-based track (JS library) |
|---|---|---|
| Touch, trackpad, inertia | Native, feels right on every device | Re-implemented in JavaScript |
| Keyboard and screen readers | Content is in normal flow and scrollable | Depends on the library |
| Main-thread cost | Scrolling runs off the main thread | Every drag frame runs your code |
| Exact control (loop, effects, sync) | Limited; looping needs tricks like these clones | Full |

Chromium now also has CSS-only carousel primitives (`::scroll-button()` for previous/next buttons and `::scroll-marker` for dots, shipped in Chrome 135 in 2025). They are not cross-browser yet, so treat them as an enhancement on top of a working scroll-snap baseline. Recommendation: native scroll snap with a thin JavaScript layer for buttons and state, and a library only when the design needs effects scrolling cannot do; avoid infinite looping unless it is a hard requirement, because it is the source of most of this demo's complexity.

**Q14. After a release, users report that the carousel sometimes jumps to the wrong card after rotating a phone, and the "infinite" jump is visible on some laptops. How do you debug and fix it?**
Reproduce first: the device toolbar's rotate button for orientation, and browser zoom at 110% or 125% for fractional scrolling. Then check the assumptions the script makes:

- `firstCardWidth` and `cardPerView` are measured once. After rotation they are wrong, so every step and every loop jump uses stale numbers. Recalculate in a `ResizeObserver` on the carousel and re-align to the current card.
- `scrollLeft` can be fractional at non-100% zoom, so the exact `===` end check can miss and the loop jumps late. Compare with a tolerance (`Math.abs(a - b) < 1`).
- The loop check runs on every `scroll` event, in the middle of a smooth scroll. Do it once the movement has stopped with the `scrollend` event (with a debounced `scroll` fallback where it is not supported), and jump with `scrollTo({ left, behavior: "instant" })` instead of toggling a class.

Recommendation: fix the measurement and timing, then add a Playwright test that rotates the viewport and zooms, and asserts the visible card's index, so the regression cannot return silently.

**Q15. Design the public API of a reusable `Carousel` component for a design system.**
Keep layout in CSS and behaviour in a small API: `slidesPerView` as a responsive value that maps to a custom property (not JavaScript measurement), `loop` defaulting to `false`, `autoplay` defaulting to `false` and requiring a pause control when on, a required `label` for the region, and `onSlideChange` for analytics. Render each slide as a group with `aria-roledescription="slide"` and an accessible name such as "3 of 6", and the container as a region with `aria-roledescription="carousel"`. Use `aria-live="polite"` on the slide container when the user moves slides and `aria-live="off"` while autoplaying, so screen readers are not interrupted.

Recommendation: make the accessible behaviour the default and hard to turn off, keep the number of props small, and let teams pass ordinary children rather than a data array, so cards stay normal, testable components.

## References

- [Stack Overflow: Understanding offsetWidth, clientWidth, scrollWidth and Height, respectively](https://stackoverflow.com/questions/21064101/understanding-offsetwidth-clientwidth-scrollwidth-and-height-respectively)
- [W3Schools: HTML DOM Element scrollLeft](https://www.w3schools.com/jsref/prop_element_scrollleft.asp)
- [MDN: HTMLElement.offsetWidth](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth)
- [MDN: Element.clientWidth](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth)
- [MDN: Element.scrollWidth](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth)
- [MDN: Element.scrollLeft](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft)
- [MDN: Element.matches()](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches)
- [MDN: Element.insertAdjacentHTML()](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML)
- [MDN: draggable attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/draggable)
- [MDN: scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type)
- [MDN: scrollend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event)
- [WAI-ARIA Authoring Practices: Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
