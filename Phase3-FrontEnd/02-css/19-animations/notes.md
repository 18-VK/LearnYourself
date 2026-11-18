# CSS Animations and @keyframes

> CSS · Topic 19 · Demo: [index.html](index.html)

CSS animations let an element move through a series of styles over time, defined as keyframes. Unlike transitions, they don't need a trigger: they can start on page load, run several steps, repeat forever, reverse, pause, and keep their final state. Loaders, pulsing badges, entrance effects and attention cues are all built this way. This note covers `@keyframes` and the `animation-*` properties, animations on pseudo-elements, control from JavaScript, the two newer motion APIs (scroll-driven animations and View Transitions), performance, and reduced motion.

## The Two Parts of an Animation

1. An `@keyframes` rule that describes **what** changes and **when** (as a percentage of the animation's time).
2. `animation-*` properties on the element that say **which** keyframes to use, **how long**, **how often** and **how**.

```css
@keyframes slide {          /* 1. define the keyframes and give them a name */
  from { transform: translateX(0); }
  to   { transform: translateX(300px); }
}

.box {
  animation-name: slide;    /* 2. attach them to an element */
  animation-duration: 2s;
}
```

## `@keyframes`

The demo defines two keyframe sets:

```css
@keyframes Demo {
  from {
    background-color: chocolate;
  }
  to {
    transform: translateX(500px);
    background-color: green;
  }
}

@keyframes harry2 {
  0%   { transform: rotate(100deg); }
  20%  { transform: rotate(200deg); }
  50%  { transform: rotate(220deg); }
  80%  { transform: rotate(300deg); }
  100% { transform: rotate(310deg); }
}
```

Rules for keyframes:

- `from` is the same as `0%`, and `to` is the same as `100%`. Use percentages when you need steps in between.
- Percentages are points in time: in a 3s animation, `20%` is at 0.6s and `50%` at 1.5s.
- Several keyframes can share one block: `0%, 100% { opacity: 1; } 50% { opacity: 0; }`.
- A property doesn't have to appear in every keyframe. In `Demo`, `transform` only appears in `to`, so the browser animates from the element's normal value (`none`) to `translateX(500px)`. If `0%` or `100%` is missing completely, the element's own styles are used for that end.
- Keyframe names are **case-sensitive** custom names: `Demo` and `demo` are different animations. Don't use CSS keywords (such as `none`, `infinite`, `ease`) as names.
- `!important` inside a keyframe is ignored.
- You can set `animation-timing-function` inside a keyframe to change the easing for the segment that starts at that keyframe.

## The Animation Properties

The demo lists most of the longhands (commented out):

```css
.box {
  /* animation-name: Demo;
  animation-duration: 4s;
  animation-delay: 1s;
  animation-timing-function: ease-in-out;
  animation-direction: reverse;
  animation-iteration-count: infinite; */
}
```

| Property | Values | Default | What it does |
|---|---|---|---|
| `animation-name` | keyframes name, or `none` | `none` | Which `@keyframes` to run. |
| `animation-duration` | time (`s`, `ms`) | `0s` | Length of one cycle. `0s` means you see nothing. |
| `animation-timing-function` | `ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier()`, `steps()`, `linear()` | `ease` | Speed curve, applied **between each pair of keyframes**, not once over the whole animation. |
| `animation-delay` | time; negative allowed | `0s` | Wait before starting. A negative delay starts part-way through. |
| `animation-iteration-count` | number (can be fractional, like `2.5`), `infinite` | `1` | How many cycles. |
| `animation-direction` | `normal`, `reverse`, `alternate`, `alternate-reverse` | `normal` | Play forwards, backwards, or back and forth. |
| `animation-fill-mode` | `none`, `forwards`, `backwards`, `both` | `none` | Which styles apply before the start and after the end. |
| `animation-play-state` | `running`, `paused` | `running` | Pause and resume. |

### The `animation` shorthand

The demo's comment gives the usual order:

```css
/* animation: name duration timing-function delay iteration-count direction fill-mode; */
animation: slide 2s ease-in-out 0.5s infinite alternate both;
```

- The order is mostly flexible, but the **first time is the duration and the second is the delay**, just like `transition`.
- Several animations are separated with **commas**, as in the demo:

```css
animation: Demo 5s ease-in-out 3s 1,
           harry2 3s ease-in-out 3s 1;
```

## What the Demo Actually Does

Both animations are on the same `.box`, both wait 3s, and both run once. `Demo` animates `background-color` and `transform`; `harry2` animates only `transform`. Here is the timeline:

| Time | What you see | Why |
|---|---|---|
| 0s to 3s | Navy box, no movement | Both are in their delay. With the default `fill-mode: none`, the element shows its normal styles during the delay. |
| at 3s | Instantly turns chocolate and jumps to a 100deg rotation | Both animations start; their first keyframes apply immediately. |
| 3s to 6s | Rotates from 100deg to 310deg in place while the colour shifts towards green; it does **not** slide | Both animations set `transform`. When two animations change the same property, the one **later in the list** wins, so `harry2`'s rotation overrides `Demo`'s `translateX`. |
| at 6s | Snaps back upright and jumps part-way along the slide | `harry2` has finished (3s delay + 3s duration). `Demo`'s `transform` is no longer overridden, and `Demo` is already 3 of its 5 seconds in. |
| 6s to 8s | Slides the rest of the way to 500px and finishes turning green | Only `Demo` is running now. |
| at 8s | Snaps back to navy at its starting position | `Demo` has finished and there is no `forwards` fill mode. |

Things to try in the demo:

- Add `forwards` to the `Demo` animation (`Demo 5s ease-in-out 3s 1 forwards`) so the box stays green at 500px.
- Swap the order of the two animations: now `Demo` wins on `transform` and the box slides without rotating.
- Use `animation-composition: add` (supported in modern browsers since 2023) so the second animation's transform is **added** to the first one's instead of replacing it: the box then slides and rotates at the same time.

> **Note:** The demo writes `<Style>` and `<Div>` in capitals. HTML tag names are case-insensitive, so it works, but the convention is lowercase. Keyframe names, on the other hand, **are** case-sensitive.

## Direction, Iterations and Fill Mode in Detail

### `animation-direction`

| Value | Cycle 1 | Cycle 2 | Cycle 3 |
|---|---|---|---|
| `normal` | 0% to 100% | 0% to 100% | 0% to 100% |
| `reverse` | 100% to 0% | 100% to 0% | 100% to 0% |
| `alternate` | 0% to 100% | 100% to 0% | 0% to 100% |
| `alternate-reverse` | 100% to 0% | 0% to 100% | 100% to 0% |

`reverse` also reverses the timing function (`ease-in` behaves like `ease-out`). `alternate` combined with `infinite` gives a smooth back-and-forth with no jump at the end of each cycle:

```css
@keyframes pulse {
  from { transform: scale(1); }
  to   { transform: scale(1.1); }
}

.badge {
  animation: pulse 0.8s ease-in-out infinite alternate;
}
```

### `animation-fill-mode`

| Value | During the delay | After the animation ends |
|---|---|---|
| `none` | Normal element styles | Back to normal element styles (snaps back) |
| `forwards` | Normal element styles | Keeps the **last keyframe played** |
| `backwards` | Applies the **first keyframe** | Back to normal element styles |
| `both` | Applies the first keyframe | Keeps the last keyframe |

"First" and "last" depend on the direction: with `reverse`, the first keyframe played is `100%`. `forwards` has no visible effect with `infinite`, because the animation never ends.

Typical use: an entrance animation with a delay needs `both`, otherwise the element is visible in its final position during the delay, then jumps to the start and animates in.

```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.card {
  animation: fade-in-up 0.5s ease-out 0.2s both;
}
```

### `animation-play-state`

```css
.spinner:hover {
  animation-play-state: paused;   /* freezes at the current frame; set back to running to continue */
}
```

## Useful Patterns

A loading spinner:

```css
@keyframes spin {
  to { transform: rotate(360deg); }   /* "from" is taken from the element (no rotation) */
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ddd;
  border-top-color: steelblue;
  border-radius: 50%;
  animation: spin 1s linear infinite;   /* linear: constant speed, no stop at each turn */
}
```

Frame-by-frame motion with `steps()` (for example a blinking text cursor):

```css
@keyframes blink {
  50% { opacity: 0; }
}

.cursor {
  animation: blink 1s steps(1) infinite;   /* jumps between visible and hidden, no fading */
}
```

Staggering a list with delays:

```css
.item { animation: fade-in-up 0.4s ease-out both; }
.item:nth-child(2) { animation-delay: 0.1s; }
.item:nth-child(3) { animation-delay: 0.2s; }
```

## Animations on `::before` and `::after`

`@keyframes` animations work on pseudo-elements too. They are ideal for decorative layers (rings, shimmers, glows) because they need no extra HTML and can move independently of the element's content.

A "ping" ring around a notification badge:

```css
.badge {
  position: relative;
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: crimson;
}

.badge::before {
  content: "";
  position: absolute;
  inset: 0;                          /* same size and position as the badge */
  border-radius: 50%;
  background-color: crimson;
  animation: ping 1.5s ease-out infinite;
}

@keyframes ping {
  from { transform: scale(1);   opacity: 0.8; }
  to   { transform: scale(2.5); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .badge::before { animation: none; }
}
```

The badge itself stays still and readable; only the decorative copy behind it grows and fades.

Things to know:

- The pseudo-element rules from [CSS Transitions](../18-transitions/notes.md#transitions-on-before-and-after) apply: it needs `content`, it is inline until you change `display` or `position`, and the parent usually needs `position: relative`.
- Animate `transform` and `opacity` on pseudo-elements for the same performance reasons as on normal elements.
- JavaScript can't select a pseudo-element directly (`querySelector('::after')` doesn't work). To change it, toggle a class on the parent or change a CSS custom property that the pseudo-element uses. You can read its styles with `getComputedStyle(element, '::after')`.
- Replaced elements such as `<img>` and most `<input>` types don't reliably support `::before`/`::after`. Wrap them in another element if you need a decorative layer.

## Transition vs Animation

| | Transition | Animation |
|---|---|---|
| Starts | Only when a property value changes | By itself as soon as the rule applies (for example on page load) |
| Steps | Start and end only | Any number of keyframes |
| Repeat | No | `animation-iteration-count` (including `infinite`) |
| Direction | Reverses automatically when the trigger is removed | `animation-direction` |
| Keep final state | The end state *is* the new style | Needs `animation-fill-mode: forwards` |
| Pause | No | `animation-play-state: paused` |
| Best for | Hover, focus, open/close toggles | Loaders, attention effects, entrance effects, multi-step motion |

## Controlling Animations from JavaScript

```js
const box = document.querySelector('.box');

box.addEventListener('animationstart', (e) => console.log('started', e.animationName));
box.addEventListener('animationiteration', (e) => console.log('next cycle', e.animationName));
box.addEventListener('animationend', (e) => console.log('ended', e.animationName));
```

- With several animations on one element (like the demo), the events fire once for each, so check `e.animationName`. They also bubble from child elements.
- `animationiteration` doesn't fire when the last cycle ends; `animationend` fires instead. Infinite animations never fire `animationend`.

Restarting a CSS animation: removing and re-adding the class in the same step does nothing, because the browser never sees the change. Force a style recalculation in between:

```js
box.classList.remove('shake');
void box.offsetWidth;          // reading layout forces the browser to apply the removal
box.classList.add('shake');
```

For animations that need fine control from JavaScript (seeking, reversing, promises when finished), the Web Animations API (`element.animate(keyframes, options)`) uses the same concepts as CSS animations:

```js
const anim = box.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(300px)' }],
  { duration: 500, easing: 'ease-out', fill: 'forwards' }   // duration in ms, not s
);

anim.pause();
anim.currentTime = 250;     // jump to the middle
anim.reverse();
await anim.finished;        // a promise instead of an animationend listener
```

## Scroll-Driven Animations

Normally an animation's progress is driven by **time**. A scroll-driven animation is driven by **scroll position** instead: the same `@keyframes`, but 0% is "scrolled to the top" and 100% is "scrolled to the bottom" (or "element entering" to "element leaving"). Reading progress bars, reveal-on-scroll and parallax used to need a `scroll` listener; now they are a few lines of CSS that can run off the main thread.

There are two timelines, set with `animation-timeline`:

| Timeline | Progress follows | Typical use |
|---|---|---|
| `scroll()` | How far a scroll container has been scrolled | Reading progress bar, shrinking header |
| `view()` | How far an element has moved through the visible part of its scroll container | Reveal on scroll, parallax images |

A reading progress bar:

```css
@keyframes grow-progress {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.progress {
  position: fixed;
  inset: 0 0 auto 0;                 /* top, full width */
  height: 4px;
  background-color: steelblue;
  transform-origin: left;
  animation: grow-progress linear;   /* no duration: progress comes from scrolling */
  animation-timeline: scroll(root block);   /* the page's vertical scroll */
}
```

Cards that fade in as they enter the viewport:

```css
@keyframes reveal {
  from { opacity: 0; translate: 0 2rem; }
  to   { opacity: 1; translate: 0 0; }
}

@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .card {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 100%;   /* only while the card is entering */
    }
  }
}
```

Points that matter in practice:

- Write `animation-timeline` **after** the `animation` shorthand. The shorthand resets `animation-timeline` to its default (the document's time), so a later shorthand silently turns it back into a time-based animation.
- `linear` is the usual timing function: the motion should track the scroll exactly, and easing on top of scrolling feels laggy.
- `animation-range` limits the part of the timeline that drives the animation (`entry`, `exit`, `cover`, `contain`, with percentages).
- When the animated properties are `transform` and `opacity`, the browser can run the whole thing on the compositor, which a JavaScript `scroll` handler can't do.

> **Note:** Support status: Chromium-based browsers since 2023 and Safari since version 26 (2025). Firefox has had it only behind a flag at the time of writing. Treat it as progressive enhancement: wrap it in `@supports (animation-timeline: view())` so unsupported browsers show the content in its final state, and use `IntersectionObserver` when the effect is essential.

## View Transitions

The View Transitions API animates between two **states of the page**: a list view and a detail view, a filtered and an unfiltered grid, even two different pages. The browser takes a screenshot of the old state, lets you update the DOM, takes a snapshot of the new state, and animates between them. By default that is a cross-fade of the whole page; elements that you give a `view-transition-name` are animated separately, moving and resizing from their old box to their new one (FLIP done by the browser, see [CSS Transforms](../17-transforms/notes.md)).

### Same-document (single-page apps)

```js
function showDetail(item) {
  if (!document.startViewTransition) {   // feature check: just update without animation
    renderDetail(item);
    return;
  }
  document.startViewTransition(() => renderDetail(item));   // the callback changes the DOM
}
```

```css
.card.is-selected .thumb,
.detail .hero-image {
  view-transition-name: product-image;   /* the same name in the old and new state = morph */
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 250ms;             /* tune the default page cross-fade */
}
```

During the transition the browser builds a tree of pseudo-elements that you style with normal CSS animations:

```text
::view-transition
└─ ::view-transition-group(product-image)       ← animates position and size
   └─ ::view-transition-image-pair(product-image)
      ├─ ::view-transition-old(product-image)    ← snapshot of the old state (fades out)
      └─ ::view-transition-new(product-image)    ← live view of the new state (fades in)
```

- `view-transition-name` must be **unique** on the page when the snapshot is taken. Two elements with the same name abort the transition. In a list, give the name only to the clicked item (as above), or set it from JavaScript just before starting.
- `startViewTransition()` returns an object with `ready`, `finished` and `updateCallbackDone` promises and a `skipTransition()` method.
- While the transition runs, the snapshots sit on top of the page, so clicks don't reach the real elements. Keep transitions short (about 200–400ms).

### Cross-document (multi-page sites)

For normal page navigations between pages of the **same origin**, both pages opt in with CSS and no JavaScript:

```css
@view-transition {
  navigation: auto;
}
```

Elements that have the same `view-transition-name` on the old and the new page morph between them, for example a product thumbnail on the listing page into the large image on the product page.

> **Note:** Support status: same-document transitions shipped in Chromium in 2023, Safari 18 in 2024 and Firefox in 2025, so they now work in all major browsers. Cross-document transitions (`@view-transition`) work in Chromium (2024) and Safari (18.2), but not in Firefox at the time of writing. Both degrade gracefully: without support, the DOM update or navigation simply happens instantly.

View transition animations are ordinary CSS animations, so they ignore the user's reduced-motion setting unless you handle it, for example by wrapping the custom `::view-transition-*` animations in `@media (prefers-reduced-motion: no-preference)` or skipping the transition in JavaScript.

## Performance

- Animate `transform` and `opacity` whenever possible. They can usually run on the compositor (often the GPU) without layout or paint, so they stay smooth even when the main thread is busy.
- Avoid animating `width`, `height`, `top`, `left`, `margin` or `padding`. They recalculate layout on every frame. Use `translate()` and `scale()` instead.
- `background-color`, `box-shadow` and `filter` cause repaints each frame. Fine for small elements, costly over large areas.
- `infinite` animations keep using CPU/GPU and battery. Stop them when they are not needed (for example remove the spinner when loading finishes).
- `will-change: transform` can help the browser prepare, but apply it only to elements that really animate.

## Accessibility

Respect the user's operating-system "reduce motion" setting:

```css
@media (prefers-reduced-motion: reduce) {
  .box,
  .spinner {
    animation: none;
  }
}
```

Or replace large motion with a gentle fade instead of removing feedback entirely. For a loading spinner, keep some sign of progress, such as a slower animation or a static "Loading..." text.

There are two ways to structure it:

| Approach | How | Trade-off |
|---|---|---|
| Opt out | Write motion normally, remove or soften it inside `@media (prefers-reduced-motion: reduce)` | Easy to add to existing code, but every new animation must remember its override |
| Opt in | Write motion only inside `@media (prefers-reduced-motion: no-preference)` | Safe by default: forgetting the query means no motion, not unwanted motion |

Many codebases also add a global safety net:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

`0.01ms` rather than `0s` keeps `animationend` and `transitionend` firing, so JavaScript that waits for them doesn't hang. The net is blunt: it also removes motion that helps understanding (a gentle fade that shows where a panel came from), so use it as a backstop and still design reduced versions of important effects.

JavaScript-driven motion (the Web Animations API, animation libraries, smooth `scrollIntoView()`, carousels, View Transitions) does **not** read the media query automatically. Check it yourself and react to changes:

```js
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
console.log(reduceMotion.matches);   // → true when the OS setting is on
reduceMotion.addEventListener('change', (e) => setAnimationsEnabled(!e.matches));
```

Also:

- WCAG 2.2.2 (Pause, Stop, Hide): anything that moves automatically for more than five seconds alongside other content needs a way for the user to pause, stop or hide it.
- WCAG 2.3.1 (Three Flashes): never make content flash more than three times per second; it can trigger seizures.
- WCAG 2.3.3 (Animation from Interactions, AAA): motion triggered by an interaction (parallax on scroll, zoom on click) should be possible to turn off, which is exactly what honouring `prefers-reduced-motion` gives you.
- Don't put essential information only in an animation, and don't delay important content behind a long entrance effect.

## Common Mistakes

- Forgetting `animation-duration`. The default is `0s`, so nothing visible happens.
- A typo or wrong capitalisation in the keyframe name (`Demo` vs `demo`). The animation silently doesn't run.
- Two animations changing the same property (like `transform` in the demo) and expecting both to show. The later one in the list wins unless you use `animation-composition`.
- The element snapping back at the end because `animation-fill-mode: forwards` is missing.
- An entrance animation with a delay but without `backwards`/`both`, so the element flashes in its final state before starting.
- Setting `animation-timing-function` and expecting it to apply across the whole animation. It applies to each keyframe segment, so `ease-in-out` with five keyframes slows down at every keyframe.
- Animating layout properties (`left`, `width`, `margin`) instead of `transform`.
- No `prefers-reduced-motion` handling for large or endless motion, or assuming JavaScript and View Transition animations respect it automatically.
- Writing the `animation` shorthand after `animation-timeline`, which resets the timeline and turns a scroll-driven animation back into a time-based one.
- Giving the same `view-transition-name` to several elements at once (for example every card in a list), which makes the view transition fail.

## Key Takeaways

- An animation = an `@keyframes` rule (what changes, and when) + `animation-*` properties (how).
- `from`/`to` equal `0%`/`100%`; percentages are points in the animation's time.
- Shorthand: `animation: name duration timing-function delay iteration-count direction fill-mode`; the first time is the duration, the second the delay.
- When two animations change the same property, the last one in the list wins.
- `fill-mode`: `forwards` keeps the end state, `backwards` applies the start state during the delay, `both` does both.
- `alternate` + `infinite` gives a smooth back-and-forth; `play-state: paused` freezes it.
- Animate `transform` and `opacity`; respect `prefers-reduced-motion` and the WCAG motion rules, in CSS and in JavaScript.
- Scroll-driven animations (`animation-timeline: scroll()` / `view()`) tie keyframes to scroll position; View Transitions animate between two DOM states or two pages. Both are progressive enhancements with uneven support.

## Interview Questions

### Junior (0–1 year)

**Q1. What is a CSS animation, and how is it different from a transition?**
A CSS animation runs an element through a set of styles defined in an `@keyframes` rule. Unlike a transition, it doesn't need a trigger (it can start on page load), it can have many intermediate steps, and it can repeat, alternate, pause and keep its final state. A transition only animates between two values when a property changes, for example on hover.

**Q2. What is `@keyframes`, and what do `from` and `to` mean?**
`@keyframes name { ... }` defines the steps of an animation as percentages of its duration, for example `0%`, `50%`, `100%`. `from` is an alias for `0%` and `to` for `100%`. The element uses the keyframes when `animation-name` matches the name; names are case-sensitive.

**Q3. Explain `animation: spin 2s linear 1s infinite alternate;`.**
It runs the `spin` keyframes, each cycle takes 2s (the first time), it waits 1s before starting (the second time), moves at constant speed (`linear`), repeats forever (`infinite`), and every second cycle plays backwards (`alternate`), so it goes back and forth.

**Q4. What does `animation-fill-mode: forwards` do?**
After the animation ends, the element keeps the styles of the last keyframe that played, instead of snapping back to its normal styles. Without it (the default `none`), the animated styles are removed when the animation finishes. `backwards` applies the first keyframe during the delay, and `both` combines the two.

**Q5. How do you make an animation run forever, and how do you pause it on hover?**
Set `animation-iteration-count: infinite` (or put `infinite` in the shorthand). To pause, add `.el:hover { animation-play-state: paused; }`. The animation freezes at its current frame and continues from there when the hover ends.

**Q6. What is the difference between `animation-direction: reverse` and `alternate`?**
`reverse` plays every cycle backwards, from 100% to 0% (and it also reverses the timing function). `alternate` plays the first cycle forwards and the next backwards, switching each time, which gives a smooth back-and-forth with no jump between cycles. `alternate` only makes a visible difference with more than one iteration.

### Mid-level (2–4 years)

**Q7. Two animations on one element both change `transform`. What happens?**

```css
.box {
  animation: slide 5s 3s, spin 3s 3s;
}
```

While both are running, the animation **later in the list** wins for that property, so `spin`'s rotation replaces `slide`'s translation. When `spin` ends, `slide` takes over again from wherever it is in its own timeline, so the element jumps. To combine them, put both functions in one keyframes set, use the separate `translate`/`rotate` properties in each animation, or set `animation-composition: add`.

**Q8. An element with a delayed entrance animation appears in its final position, disappears, and then animates in. Why, and how do you fix it?**
During `animation-delay`, with the default `fill-mode: none`, the element shows its normal styles, which are usually the final visible state. When the animation starts, the first keyframe (for example `opacity: 0`) suddenly applies, so it flickers. Use `animation-fill-mode: backwards` or `both` so the first keyframe applies during the delay.

**Q9. Which properties should you animate for smooth 60fps animations, and why?**
`transform` and `opacity`. Browsers can usually animate them on the compositor, often on the GPU, without recalculating layout or repainting, so they stay smooth even when JavaScript is busy. Animating `width`, `height`, `top`, `left` or `margin` triggers layout every frame, which can make the animation stutter and slow the whole page. Movement should use `translate()` and growing should use `scale()`.

**Q10. How do you restart a CSS animation from JavaScript?**
Removing and re-adding the class in the same task does nothing, because the browser batches the style changes and never sees the animation removed. Remove the class, force a style/layout flush (for example `void el.offsetWidth`), then add it again. Alternatively, set `el.style.animation = 'none'`, flush, and clear it, or use the Web Animations API (`el.getAnimations()` and `animation.play()`).

**Q11. How do you run code after a CSS animation finishes, and what are the pitfalls?**
Listen for `animationend`. It fires once per animation, so with several animations on one element check `event.animationName`; it bubbles from children, so check `event.target`; and it never fires for `infinite` animations or when the animation is removed before finishing (that fires `animationcancel`). For more control, `el.getAnimations()` returns `Animation` objects with a `finished` promise.

**Q12. What is `prefers-reduced-motion`, and how do you support it across CSS and JavaScript?**
It is a media feature that reflects the operating-system setting "reduce motion", which people with vestibular disorders, migraines or motion sensitivity turn on because large movement can cause dizziness and nausea. In CSS, either write motion only inside `@media (prefers-reduced-motion: no-preference)` (opt in, safe by default) or remove and soften it inside `@media (prefers-reduced-motion: reduce)` (opt out). "Reduce" doesn't mean "no feedback": replace slides, zooms, parallax and spins with short fades, keep a static "Loading..." indicator, and turn off `scroll-behavior: smooth`. JavaScript motion (Web Animations API, libraries, smooth `scrollIntoView()`, carousels, View Transitions) ignores the media query, so check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and listen for its `change` event. Combine this with the WCAG rules: a way to pause anything that moves automatically for more than five seconds (2.2.2), and nothing that flashes more than three times per second (2.3.1).

**Q13. What are scroll-driven animations, and when would you use them instead of `IntersectionObserver`?**
A scroll-driven animation uses normal `@keyframes`, but `animation-timeline: scroll()` ties its progress to how far a container has been scrolled, and `animation-timeline: view()` to how far an element has travelled through the viewport. The animation scrubs back and forth with the scroll position and, for `transform` and `opacity`, can run on the compositor without any JavaScript. `IntersectionObserver` only tells you that an element crossed a threshold; you then add a class and a time-based animation plays. Use scroll-driven animations for effects that should track the scroll continuously (progress bars, parallax, reveals that scrub), and `IntersectionObserver` for one-off triggers (lazy loading, "animate once when visible", analytics) or where you need it to work in every browser, since Firefox has scroll-driven animations only behind a flag at the time of writing.

### Senior (5+ years)

**Q14. CSS animations, the Web Animations API, or a JavaScript library such as GSAP or Motion: how do you choose in a large application?**
Use **CSS** (`@keyframes`, transitions) for declarative, state-driven motion: hover, focus, loaders, entrances. It costs no JavaScript, and `transform`/`opacity` animations run on the compositor. Use the **Web Animations API** when code needs control: pausing, seeking, reversing, chaining with the `finished` promise, or computing keyframes at run time (FLIP). It has the same performance characteristics as CSS and ships in every browser. Reach for a **library** when you need what the platform doesn't give cheaply: spring physics, gesture-driven motion, layout animations across component trees, exit animations on unmount, or long choreographed timelines. Recommendation: default to CSS, use WAAPI for imperative cases, and allow one library for the whole app (not one per team), loaded only on routes that need it, since animation libraries add noticeable bundle size.

**Q15. Product asks for animated page transitions in your app. How would you implement them with the View Transitions API, and what are the risks?**
For a single-page app, wrap the router's DOM update in `document.startViewTransition()` (many routers have an opt-in for this), and for a multi-page site add `@view-transition { navigation: auto; }` to every same-origin page. Mark the few elements that should morph (a product image, the page title) with `view-transition-name`, generating names from IDs and assigning them only to the clicked item so they stay unique. Risks: the page is not interactive while the transition runs, so keep it short (around 250ms); a slow DOM update delays the whole transition, because the browser waits for the callback before animating; snapshots of large pages cost memory; duplicate names abort the transition; and the animations ignore reduced motion unless you handle it. Recommendation: ship it as progressive enhancement behind feature detection, keep the morphing elements to a handful, respect `prefers-reduced-motion`, and measure INP before and after.

**Q16. The page's CPU usage stays high and laptop fans spin even when nothing seems to happen. The Performance panel shows paint work on every frame from a skeleton loader and a spinner. How do you diagnose and fix it?**
Look for animations of properties that can't be composited: a skeleton "shimmer" that animates `background-position` and a spinner that animates `border-color` or `box-shadow` both repaint every frame. Confirm it with DevTools Rendering > Paint flashing and the Performance panel (Paint and Composite events on every frame, plus the Animations panel). Fixes: animate a `transform: translateX()` on a pseudo-element that carries the gradient instead of `background-position`, rotate the spinner with `transform`, remove loaders as soon as content arrives, and pause off-screen infinite animations (`animation-play-state: paused` toggled by `IntersectionObserver`, or `content-visibility: auto` on long lists). Recommendation: add "infinite animations must be compositor-only and stoppable" to the component checklist, and check new loaders with paint flashing before they ship.

**Q17. A designer hands you complex motion specs for a component library: staggered entrances, a modal that scales from the clicked button, a list that reorders. How do you turn this into something maintainable for many teams?**
Separate **motion primitives** from components. Define tokens (durations, easings, stagger step), a small set of named keyframes (`fade-in`, `slide-up`, `scale-in`) and utilities like a stagger index variable (`animation-delay: calc(var(--i) * 40ms)`). Components compose these instead of defining their own. Pick one mechanism per class of problem: CSS for entrances, FLIP or View Transitions for "from the clicked element" and reorders, `@starting-style` for elements that appear. Build reduced-motion variants into the primitives so every component inherits them, and document each motion with a live example and a "why" (motion should explain where something came from, not decorate). Recommendation: treat motion as part of the design-system API, with tokens, primitives and lint rules, and review it like any other API change.

## References

- [MDN: animation](https://developer.mozilla.org/en-US/docs/Web/CSS/animation)
- [MDN: @keyframes](https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes)
- [MDN: Using CSS animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations/Using_CSS_animations)
- [MDN: animation-fill-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-fill-mode)
- [MDN: animation-composition](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-composition)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN: Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [MDN: CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations)
- [MDN: animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline)
- [MDN: View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [MDN: @view-transition](https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition)
- [Chrome for Developers: Scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations)
- [Chrome for Developers: Smooth transitions with the View Transition API](https://developer.chrome.com/docs/web-platform/view-transitions)
- [LogRocket: CSS ::before and ::after custom animations and transitions](https://blog.logrocket.com/css-before-after-custom-animations-transitions/)
- [web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
- [web.dev: Learn CSS - Animations](https://web.dev/learn/css/animations)
