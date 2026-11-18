# CSS Transitions

> CSS · Topic 18 · Demo: [index.html](index.html)

A transition makes a property change smoothly from its old value to its new value over a set time, instead of jumping instantly. It is the simplest way to add motion in CSS: hover effects, focus styles, menus that slide open and buttons that change colour all use it. This note covers the transition properties and timing functions, what can and can't be transitioned (including `display` and `height: auto`), transitions on `::before`/`::after`, performance and the JavaScript events.

## How a Transition Works

A transition is not an animation you "play". It only runs when **all** of these are true:

1. A property's value **changes**, for example because of `:hover`, `:focus`, `:checked`, a class added with JavaScript, or a media query that starts matching.
2. That property is listed in `transition-property` (or `all` is used).
3. The duration is greater than `0s`.
4. The property can be interpolated: the browser can calculate the in-between values (colours, lengths, numbers, transforms, and so on).

```css
.button {
  background-color: steelblue;
  transition: background-color 0.3s ease;   /* describes HOW changes should happen */
}

.button:hover {
  background-color: navy;                    /* the change that triggers it */
}
```

Hover the button and the colour fades over 0.3s; move the mouse away and it fades back.

## The Transition Properties

The demo shows the longhands (commented out) and the shorthand:

```css
.box {
  /* transition-property: transform;
  transition-delay: 1s;
  transition-duration: 3s;
  transition-timing-function: ease-in-out; */
  transition: transform 3s 1s ease-in-out;
}
```

| Property | What it controls | Default |
|---|---|---|
| `transition-property` | Which property (or properties) to animate. `all` = every property that changes. | `all` |
| `transition-duration` | How long the change takes (`s` or `ms`). | `0s` (so nothing animates) |
| `transition-timing-function` | The speed curve: how fast it moves at each moment. | `ease` |
| `transition-delay` | How long to wait before starting. | `0s` |
| `transition-behavior` | `allow-discrete` lets properties like `display` take part (see below). | `normal` |

Because the default duration is `0s`, a transition does nothing until you set a duration.

### The shorthand

```css
transition: <property> <duration> <timing-function> <delay>;
```

- The order is flexible **except for the two times**: the first time value is always the **duration**, the second is always the **delay**.
- `transition: transform 3s 1s ease-in-out` therefore means: animate `transform`, take 3s, wait 1s first, use `ease-in-out`.
- Several transitions are separated with **commas**:

```css
.card {
  transition:
    transform 0.3s ease-out,
    box-shadow 0.3s ease-out,
    background-color 0.2s linear 0.1s;
}
```

Times use `s` or `ms`: `0.3s` = `300ms`. Always write the unit, including for zero (`0s`).

## What the Demo Does (and What It Is Missing)

```css
.container {
  width: 60vw;
  height: 60vh;
}

.box {
  width: 50%;
  height: 50%;
  transform: translateX(50%) translateY(50%);
  transition: transform 3s 1s ease-in-out;
}
```

- The box is half the container's width and height. `translateX(50%) translateY(50%)` moves it by half of **its own** size on each axis, which places it (roughly) in the middle of the container.
- The `transition` is set up correctly, but **nothing in the demo ever changes `transform`**, so you never see any motion. A transition only runs when the value changes.

Add a trigger to see it work:

```css
.container:hover .box {
  transform: translateX(0) translateY(0);
}
```

Now, when you hover the container: nothing happens for 1s (the delay), then the box slides to the top-left corner over 3s, slow at the start and end (`ease-in-out`). When the mouse leaves, it waits 1s and slides back, because the `transition` lives on `.box`, so it applies in both directions.

### Where to put the `transition` declaration

The browser uses the transition settings of the state it is changing **to**.

| `transition` written on | Hover in | Hover out |
|---|---|---|
| The base rule (`.box`) | Animated | Animated |
| Only the `:hover` rule | Animated | Jumps back instantly |
| Both, with different values | Uses the `:hover` values | Uses the base values |

Normally put it on the base rule. Put different values on `:hover` only when you want different speeds in each direction, for example a quick hover-in and a slower fade-out.

## Timing Functions

| Value | Speed curve | Good for |
|---|---|---|
| `ease` (default) | Speeds up quickly at the start, then slows down gradually towards the end | General UI |
| `linear` | Constant speed | Spinners, progress bars, colour changes |
| `ease-in` | Starts slow, ends fast | Elements leaving the screen |
| `ease-out` | Starts fast, ends slow | Elements entering the screen, hover feedback |
| `ease-in-out` | Slow start, fast middle, slow end | Elements moving from one spot to another |
| `cubic-bezier(x1, y1, x2, y2)` | Custom curve; `y` values outside 0–1 make it overshoot | Bouncy, branded motion |
| `steps(n, jump-end)` | Jumps in `n` equal steps, no smooth in-betweens | Sprite sheets, typewriter effects, ticking clocks |
| `linear(...)` | A custom curve made of many points | Spring and bounce effects (modern browsers since 2023) |

```css
.pop {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);  /* overshoots a little, then settles */
}
```

Browser DevTools have a visual curve editor: click the small curve icon next to a timing function in the Styles panel.

## Duration and Delay in Practice

- Small UI changes (hover, focus, button press): about 100–300ms. Anything slower feels sluggish.
- Larger movements (a panel sliding in): about 300–500ms.
- The demo's 3s duration and 1s delay are only there to make the effect easy to see while learning.
- A **negative** delay starts the transition part-way through: `transition-delay: -0.5s` on a 1s transition begins at the halfway point.
- Use a delay to stagger several elements (0ms, 50ms, 100ms...) or to avoid menus opening when the mouse just passes over them.

## What Can (and Cannot) Be Transitioned

| Can be transitioned | Cannot be transitioned (by default) |
|---|---|
| `opacity`, `transform`, `filter` | `display` (it just switches at the start or end) |
| `color`, `background-color`, `border-color` | Changes between a length and `auto` (`height: 0` to `height: auto`), unless `interpolate-size` is enabled |
| `width`, `height`, `margin`, `padding`, `top`, `left` | `font-family`, `position`, `float` (they switch instantly) |
| `box-shadow`, `border-radius`, `outline-offset` | `content` on pseudo-elements |
| `visibility` (it flips at the right moment, see below) | |

### Fading out and then hiding

`display: none` can't fade. Two common approaches:

```css
/* 1. opacity + visibility (works everywhere) */
.menu {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
}
.menu.open {
  opacity: 1;
  visibility: visible;
}
```

`visibility` is special: it switches to `visible` immediately when appearing and stays `visible` until the end when disappearing, so the fade is visible both ways. Unlike `opacity: 0` alone, `visibility: hidden` also removes the element from the Tab order and from screen readers.

```css
/* 2. Modern: transition display itself (Chromium and Safari; Firefox doesn't transition display yet) */
.toast {
  display: none;
  opacity: 0;
  transition: opacity 0.3s, display 0.3s allow-discrete;
}
.toast.show {
  display: block;
  opacity: 1;
}
@starting-style {
  .toast.show { opacity: 0; }   /* where the fade-in starts from */
}
```

> **Note:** In a browser that can't transition `display` (Firefox at the time of writing), the toast still appears and disappears correctly, just without the fade. That makes this technique safe as progressive enhancement; check MDN's compatibility table for `transition-behavior` before relying on the animation itself.

### Animating to `height: auto`

A classic problem (every accordion, "show more" panel and expanding card hits it): `height: 0` to `height: auto` does not animate. `auto` is a keyword, not a length, so historically the browser had no numbers to interpolate between and simply switched. There are four techniques, from oldest to newest.

**1. `max-height` to a "big enough" value** (works everywhere, but imprecise):

```css
.panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.panel.open {
  max-height: 500px;   /* must be larger than the tallest content */
}
```

The transition runs over the full 0 to 500px range. If the content is only 100px tall, it appears in the first fifth of the time and the closing animation seems to wait before moving. If the content ever grows past 500px, it is cut off.

**2. The `grid-template-rows` trick** (all modern browsers; the best default today):

```css
.accordion-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}
.accordion-body.open {
  grid-template-rows: 1fr;
}
.accordion-body > .inner {
  overflow: hidden;   /* lets the row shrink below the content height */
  min-height: 0;      /* belt and braces: allow the grid item to shrink to 0 */
}
```

`fr` values are numbers, so `0fr` to `1fr` can be interpolated, and a `1fr` row in an auto-height grid is exactly as tall as its content. The timing follows the real height.

**3. Measure in JavaScript** (works everywhere, most control):

```js
panel.style.height = `${panel.scrollHeight}px`;   // animate from 0 to the measured height
panel.addEventListener('transitionend', () => {
  panel.style.height = 'auto';                     // let it follow content changes afterwards
}, { once: true });
```

Closing is the reverse: set the current pixel height, force a reflow, then set `0`. It costs a layout read per toggle and more code, so prefer the CSS options unless you need the exact pixel value.

**4. `interpolate-size` and `calc-size()`** (the real fix, not yet universal):

```css
:root {
  interpolate-size: allow-keywords;   /* opt in once: transitions to and from auto, min-content, fit-content... */
}

.panel {
  height: 0;
  overflow: clip;
  transition: height 0.3s ease;
}
.panel.open {
  height: auto;                       /* now animates */
}

/* or per declaration, without the global opt-in */
.panel.open {
  height: calc-size(auto, size);
}
```

`interpolate-size` is opt-in because turning it on everywhere could change the behaviour of existing sites. `calc-size()` also lets you do maths on the intrinsic size (`calc-size(auto, size + 2rem)`). Combined with the `::details-content` pseudo-element, it can even animate a native `<details>` element:

```css
details::details-content {
  height: 0;
  overflow: clip;
  transition: height 0.3s ease, content-visibility 0.3s allow-discrete;
}
details[open]::details-content {
  height: auto;
}
```

> **Note:** `interpolate-size`, `calc-size()` and `::details-content` shipped in Chromium-based browsers (Chrome and Edge) in 2024. Firefox and Safari support was still missing or incomplete at the time of writing, so check Can I use. They are safe as **progressive enhancement**: where they are not supported, the panel still opens and closes, it just doesn't animate.

Which one to use:

| Technique | Accurate timing | Browser support | Notes |
|---|---|---|---|
| `max-height` | No | All | Quick hacks only; content can be clipped |
| `grid-template-rows` | Yes | All modern | Needs a wrapper element; the default choice |
| JavaScript measuring | Yes | All | More code, one layout read per toggle |
| `interpolate-size` / `calc-size()` | Yes | Chromium so far | Cleanest code; use as an enhancement |

Whatever the technique, a collapsed panel at height 0 still contains focusable links and text that screen readers read. Transition `visibility` alongside the height (as in "Fading out and then hiding" above) so closed content is really hidden. The FAQ accordion project shows the grid technique together with the ARIA attributes and `visibility`: see [FAQ accordion](../../05-projects/02-faq-accordion/notes.md).

## Transitions on `::before` and `::after`

Pseudo-elements are the usual place for decorative hover effects (underlines, overlays, tooltips) because they need no extra HTML. They can be transitioned like normal elements, but a few rules trip people up:

- A pseudo-element only exists if it has a `content` property, even an empty one: `content: "";`.
- Pseudo-elements are **inline** by default, so `width`, `height` and `transform` don't work until you set `display: block`/`inline-block` or `position: absolute`.
- If you position it absolutely, give the parent `position: relative` so it is positioned relative to the parent.
- To react to hover on the parent, the pseudo-element comes **last** in the selector: `.link:hover::after`, not `.link::after:hover`.
- The `content` property itself **cannot be transitioned**: new text just appears. To make content "fade in" on hover, keep the content there all the time and transition `opacity` or `transform` instead.

Animated underline:

```css
.link {
  position: relative;
  text-decoration: none;
}

.link::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 100%;
  height: 2px;
  background-color: currentColor;   /* same colour as the text */
  transform: scaleX(0);             /* hidden: zero width */
  transform-origin: left;           /* grows from the left edge */
  transition: transform 0.3s ease;
}

.link:hover::after,
.link:focus-visible::after {
  transform: scaleX(1);             /* full width */
}
```

Scaling a full-width line from `scaleX(0)` is cheaper than transitioning `width` from `0` to `100%`, and `transform-origin` decides where it grows from (`left`, `center` or `right`).

Tooltip text that fades in (the text is always there, only its opacity changes):

```html
<button class="tip" data-tip="Saved to your list">Save</button>
```

```css
.tip {
  position: relative;
}

.tip::after {
  content: attr(data-tip);          /* reads the text from the HTML attribute */
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  translate: -50% 4px;
  padding: 4px 8px;
  white-space: nowrap;
  background-color: #222;
  color: #fff;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;             /* the hidden tooltip shouldn't block clicks */
  transition: opacity 0.2s ease, translate 0.2s ease;
}

.tip:hover::after,
.tip:focus-visible::after {
  opacity: 1;
  translate: -50% 0;
}
```

> **Note:** Text generated with `content` can't be selected or copied, and screen readers handle it inconsistently. Use it for decoration or extra hints, not for information the user must have. A real tooltip also needs to be reachable by keyboard (`:focus-visible`) and announced, for example with `aria-describedby`.

Keyframe animations on pseudo-elements (rings, shimmers) are covered in [CSS Animations](../19-animations/notes.md).

## Avoid `transition: all`

`transition: all 0.3s` (or a bare `transition: 0.3s`) animates **every** property that changes, including ones you didn't expect: a width change from a media query, a colour set by JavaScript, layout properties on a parent. That causes surprising animations and extra work for the browser. List the properties you actually mean.

## Performance

| Cost | Properties | Why |
|---|---|---|
| Cheapest | `transform`, `opacity` | Usually handled by the compositor (often on the GPU): no layout, no paint |
| Medium | `color`, `background-color`, `box-shadow`, `filter` | Repaint on every frame, but no layout |
| Most expensive | `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size` | Recalculate layout on every frame, which can affect the whole page |

To move something, transition `transform: translate()` rather than `left` or `margin`. To grow something, prefer `transform: scale()` over `width` and `height` where it looks right.

## Accessibility

Respect the user's operating-system "reduce motion" setting. Either add motion only when the user has no preference:

```css
@media (prefers-reduced-motion: no-preference) {
  .box {
    transition: transform 0.3s ease-in-out;
  }
}
```

or switch large movements off for users who asked for less motion:

```css
@media (prefers-reduced-motion: reduce) {
  .box {
    transition: none;
  }
}
```

Small colour and opacity fades are usually fine to keep; big slides, zooms and spins are the problem. The full reduced-motion strategy is in [CSS Animations](../19-animations/notes.md#accessibility).

Also:

- Effects that appear on `:hover` should also appear on `:focus-visible`, so keyboard users get the same feedback.
- Don't make users wait: long delays before a menu or tooltip appears make the page feel broken.

## Listening for Transitions in JavaScript

```js
const box = document.querySelector('.box');

box.addEventListener('transitionend', (event) => {
  console.log(`${event.propertyName} finished after ${event.elapsedTime}s`);
});
```

- `transitionend` fires once **per property** that transitioned. A transition on `padding` fires four events (one for each side's longhand).
- It **bubbles**, so you also receive events from transitioning children. Check `event.target === box` if you only care about the element itself.
- If the transition is interrupted (for example the class is removed half way), `transitioncancel` fires instead of `transitionend`.
- `transitionrun` (when it is created, before any delay) and `transitionstart` (when the delay ends) also exist.

## Transition vs Animation

| | Transition | Animation (`@keyframes`) |
|---|---|---|
| Needs a trigger | Yes: a property value must change | No: can start on page load |
| States | Two: start and end | As many keyframes as you like (0%, 20%, 50%...) |
| Repeating | No (runs once per change) | `animation-iteration-count`, including `infinite` |
| Reversing | Automatic when the trigger goes away | Must be designed (`animation-direction`) |
| Control | Duration, delay, timing function | Also direction, fill mode, play state |
| Best for | Hover/focus feedback, toggles between two states | Loaders, attention effects, multi-step motion |

## Common Mistakes

- Defining a transition but never changing the property, as in the demo. Nothing will animate.
- Putting `transition` only on `:hover`, so the element snaps back when the mouse leaves.
- Mixing up duration and delay in the shorthand: the first time is always the duration.
- Forgetting the duration: the default is `0s`, so it changes instantly.
- Expecting `display: none` or `height: auto` to animate without the techniques above.
- Using `transition: all`, which animates things you didn't intend.
- A hover rule with a new `transform` that drops the original transform functions (for example the demo's `translateX(50%) translateY(50%)`), making the element jump.
- Transitioning layout properties (`width`, `left`) for movement instead of `transform`.
- Animating `max-height` to `9999px` "to be safe": the visible part of the animation becomes a tiny fraction of the duration, so it looks instant on open and delayed on close.
- Collapsing a panel to height 0 without `visibility: hidden`, so its links are still reachable with Tab.
- Forgetting `content: ""` on a pseudo-element, writing `::after:hover` instead of `:hover::after`, or trying to transition the `content` text itself.

## Key Takeaways

- A transition animates a property between its old and new value whenever that value changes.
- Shorthand: `transition: property duration timing-function delay`; the first time is the duration, the second the delay.
- The default duration is `0s` and the default timing function is `ease`.
- Put `transition` on the base state so it runs both ways.
- Separate several transitions with commas; avoid `transition: all`.
- `transform` and `opacity` are the cheapest properties to transition.
- `display` and `height: auto` need special techniques (`visibility`, `allow-discrete` + `@starting-style`, the grid-rows trick); `interpolate-size: allow-keywords` is the native fix where supported.
- Pseudo-elements transition like normal elements, but `content` itself can't: keep it present and transition `opacity`/`transform`.
- Respect `prefers-reduced-motion`, and mirror hover effects on `:focus-visible`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a CSS transition, and what is needed for one to run?**
A transition animates a property smoothly from its current value to a new value over time. It needs a property that actually changes (through `:hover`, a class change, and so on), a `transition-duration` greater than `0s`, and a property whose values the browser can interpolate, such as colour, length, opacity or transform.

**Q2. Explain `transition: transform 3s 1s ease-in-out;`.**
It transitions only the `transform` property. The first time value, `3s`, is the duration; the second, `1s`, is the delay before it starts. `ease-in-out` means it starts slowly, speeds up in the middle, and slows down at the end. It is shorthand for the four `transition-*` longhands.

**Q3. Why does nothing animate here?**

```css
.box {
  transform: translateX(50%);
  transition: transform 3s;
}
```

The transition is defined, but nothing ever changes `transform`, so there is nothing to animate. A transition only describes how a change happens; you also need the change, for example `.box:hover { transform: translateX(0); }` or a class toggled by JavaScript.

**Q4. What is the default timing function, and how do `ease-in`, `ease-out` and `linear` differ?**
The default is `ease`, which speeds up quickly at the start and slows down gradually towards the end. `ease-in` starts slow and ends fast, `ease-out` starts fast and ends slow, and `linear` moves at a constant speed. `ease-out` suits things entering the screen, `ease-in` suits things leaving, and `linear` suits continuous motion like a progress bar.

**Q5. Should `transition` go on the element's normal rule or on its `:hover` rule?**
Usually on the normal rule. The browser uses the transition settings of the state being changed **to**, so a transition on the base rule applies both when hovering in and when hovering out. If it is only on `:hover`, the hover-in is animated but the element jumps back instantly when the mouse leaves.

**Q6. How do you transition more than one property with different durations?**
Separate the transitions with commas in one declaration, for example `transition: opacity 0.2s ease, transform 0.4s ease-out;`. Each part has its own duration, timing function and delay. Avoid `transition: all`, because it animates every property that changes, including ones you didn't plan for.

### Mid-level (2–4 years)

**Q7. What is the difference between a transition and an animation?**
A transition needs a trigger (a value change) and has only a start and an end state; it runs once per change and automatically reverses when the trigger goes away. An animation is defined with `@keyframes`, can start by itself on page load, can have many intermediate steps, and can repeat, alternate direction, pause, or keep its final state with `animation-fill-mode`. Use transitions for simple state changes such as hover and toggles, and animations for loaders or multi-step effects.

**Q8. How would you animate an accordion panel from `height: 0` to its natural height?**
`height: auto` is a keyword, not a length, so by default there is nothing to interpolate and it switches instantly. The reliable cross-browser approach is a grid wrapper that transitions `grid-template-rows` from `0fr` to `1fr`, with `overflow: hidden` on the inner element: `fr` values are numbers, and a `1fr` row is exactly as tall as the content. Alternatives are transitioning `max-height` to a large value (simple, but the timing is uneven and tall content gets clipped) or measuring `scrollHeight` in JavaScript and animating an explicit pixel height. The native fix is `interpolate-size: allow-keywords` on `:root` (or `height: calc-size(auto, size)` per declaration), which makes `height: auto` animatable directly; it shipped in Chromium in 2024 but not yet everywhere, so use it as progressive enhancement. In every case, add `visibility: hidden` to the closed state so the hidden content leaves the Tab order.

**Q9. Which properties are cheapest to transition, and why?**
`transform` and `opacity`. Browsers can usually apply them in the compositing step, often on the GPU, without recalculating layout or repainting. Properties like `width`, `height`, `top`, `left` and `margin` trigger layout on every frame, and `background-color` or `box-shadow` trigger repaints, which can cause stutter on slower devices. So movement should be done with `translate()` and growth with `scale()`.

**Q10. How do you fade an element out and then remove it from the layout?**
`display: none` doesn't transition by default. The classic approach is to transition `opacity` together with `visibility`: `visibility` stays `visible` until the fade finishes, then hides the element and removes it from the Tab order. In modern browsers you can transition `display` itself with `transition-behavior: allow-discrete` (or `display 0.3s allow-discrete` in the shorthand), plus `@starting-style` for the fade-in. Another option is to listen for `transitionend` in JavaScript and then set `display: none` or remove the element.

**Q11. Your `transitionend` handler runs several times for one hover. Why?**
`transitionend` fires once for every property that finished transitioning, and shorthands count per longhand (a `padding` transition fires four events). It also bubbles, so transitions on child elements trigger the parent's handler. Filter with `event.propertyName` and `event.target === element`, or use `{ once: true }` if you only need the first event.

**Q12. You want a label to fade in next to a button on hover using `::after`. Changing `content` on hover makes it appear instantly. Why, and how do you fix it?**
`content` can't be animated; it switches immediately. Set the `content` on the pseudo-element all the time (for example `content: attr(data-label)`), hide it with `opacity: 0` (and possibly a small `transform` or `translate`), and transition `opacity`/`transform` to visible on `.button:hover::after` and `.button:focus-visible::after`. Note the order: `:hover::after`, not `::after:hover`. Add `pointer-events: none` so the hidden label doesn't block clicks, and don't put essential information only in generated content, because it can't be selected and screen readers announce it inconsistently.

### Senior (5+ years)

**Q13. Every team in your organisation picks its own durations and easings, and the product feels inconsistent. How do you standardise transitions across a design system?**
Define motion as design tokens, exactly like colours and spacing: a small set of durations (`--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 350ms`) and named easings (`--ease-out`, `--ease-in-out`, maybe one spring made with `linear()`), documented with when to use each (enter = ease-out, exit = ease-in and shorter). Components consume only the tokens. Because everything goes through variables, the reduced-motion policy lives in one place: inside `@media (prefers-reduced-motion: reduce)`, set the movement durations to near zero or swap slides for fades. Enforce it with Stylelint (disallow raw `ms`/`s` values and `transition: all` in component code, for example with `declaration-property-value-disallowed-list`) and review motion in the component library's stories. Recommendation: tokens plus a lint rule; guidelines alone drift within a quarter.

**Q14. A hover dropdown menu closes when users move the mouse diagonally from the trigger to the menu, and flickers on fast mouse movement. How do you fix it with CSS?**
The menu closes as soon as the pointer leaves the hover target, and any gap between the trigger and the menu counts as "leaving". Put `:hover` on a wrapper that contains both the trigger and the menu (`.nav-item:hover .menu`), remove the gap (or bridge it with a transparent `::before` on the menu), and add a short `transition-delay` to the **closing** state only (a delay on the base rule, `0s` on the hover rule) so a brief exit doesn't close it. Use `visibility` with the opacity transition so the closed menu can't be clicked or tabbed into, and make it open on `:focus-within` too for keyboard users. Recommendation: for anything beyond a simple nav, use a click-to-open disclosure (or the Popover API) instead of hover; hover menus are hard to make work on touch screens and for keyboard users.

**Q15. In a React app, list items should fade in when added and fade out when removed. CSS transitions do neither by default. How do you implement this robustly?**
A transition needs a value change on an element that already exists, so an element inserted with its final styles doesn't animate, and an element removed from the DOM disappears before any exit transition can run. For **entry**, use `@starting-style` to declare the "before" styles (supported in all major browsers since 2024); the older fallback is adding the visible class one frame after insertion. For **exit**, the component must stay mounted until the transition finishes: set an "exiting" state, wait for `transitionend` (checking `event.target` and `propertyName`), then unmount. Always add a timeout fallback, because `transitionend` never fires if the duration is 0 (reduced motion), the element is hidden, or the transition is interrupted. Libraries such as Motion's `AnimatePresence` or `react-transition-group` implement exactly this, and the View Transitions API can animate whole state changes. Recommendation: `@starting-style` for entry, a library (or a small hook with a timeout fallback) for exit; don't hand-roll a different version in every component.

> **Note:** Related questions answered elsewhere: [CSS Animations](../19-animations/notes.md#interview-questions) (reduced motion).

## References

- [MDN: transition](https://developer.mozilla.org/en-US/docs/Web/CSS/transition)
- [MDN: Using CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions)
- [MDN: transition-timing-function](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-timing-function)
- [MDN: transition-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior)
- [MDN: @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)
- [MDN: transitionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN: interpolate-size](https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size)
- [MDN: calc-size()](https://developer.mozilla.org/en-US/docs/Web/CSS/calc-size)
- [MDN: ::after](https://developer.mozilla.org/en-US/docs/Web/CSS/::after)
- [Chrome for Developers: Animate to height: auto](https://developer.chrome.com/docs/css-ui/animate-to-height-auto)
- [Stack Overflow: CSS transition after a pseudo-element: how to transition content that shows on hover](https://stackoverflow.com/questions/19579340/css-transition-after-a-pseudo-element-how-to-transition-content-that-shows-o)
- [web.dev: Learn CSS - Transitions](https://web.dev/learn/css/transitions)
