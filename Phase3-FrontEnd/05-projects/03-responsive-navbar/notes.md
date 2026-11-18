# Responsive Navbar with a Hamburger Menu

> Project · Topic 3

A responsive navbar shows its links in a row on wide screens and collapses them behind a "hamburger" button (three lines) on small screens. It combines semantic HTML, media queries and a small amount of JavaScript, and it is one of the most common front-end tasks and interview exercises. The hard part is not the layout but making the toggle accessible.

Video tutorial saved in the original notes: <https://youtu.be/U8smiWQ8Seg>

## The HTML Structure

```html
<header class="site-header">
  <a href="/" class="logo">Brand</a>

  <button class="nav-toggle" type="button"
          aria-label="Menu" aria-expanded="false" aria-controls="primary-nav">
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
  </button>

  <nav id="primary-nav" class="nav" aria-label="Main">
    <ul class="nav-list">
      <li><a href="#home" aria-current="page">Home</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#pricing">Pricing</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
  </nav>
</header>
```

| Element / attribute | Why |
|---|---|
| `<header>`, `<nav>` | Landmarks: screen-reader users can jump straight to the navigation |
| `<ul>` of links | Screen readers announce "list, 4 items", so users know how many links there are |
| `<button type="button">` | Focusable, works with Enter/Space, announced as a button |
| `aria-label="Menu"` | The button contains only decorative bars, so it needs a text name |
| `aria-expanded="false"` | Tells screen readers whether the menu is open; updated by JavaScript |
| `aria-controls="primary-nav"` | Links the button to the menu it controls (must match the `<nav>`'s `id`) |
| `aria-label="Main"` on `<nav>` | Distinguishes it from other `<nav>` elements (for example a footer nav) |
| `aria-current="page"` | Marks the link for the current page |

Make sure the page has the viewport meta tag, or phones will render it as a zoomed-out desktop page and your media queries will never match:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## Mobile-First CSS and Media Queries

Write the **small-screen** layout first, then add a `min-width` media query for larger screens.

```css
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;            /* lets the open menu drop to its own line */
  padding: 1rem 1.5rem;
}

/* Mobile: the menu is hidden until the button opens it */
.nav {
  display: none;
  width: 100%;
}
.nav-toggle[aria-expanded="true"] + .nav {
  display: block;             /* open state comes straight from the ARIA attribute */
}
.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.nav-list a {
  display: block;
  padding: 0.75rem 0;         /* large touch targets */
}

/* Desktop: show the links in a row, hide the button */
@media (min-width: 768px) {
  .nav-toggle { display: none; }
  .nav {
    display: block;
    width: auto;
  }
  .nav-list {
    display: flex;
    gap: 2rem;
  }
}
```

- A media query applies its rules only when the condition is true. `(min-width: 768px)` means "viewport 768px wide or wider"; `(max-width: 767px)` means "767px or narrower".
- **Mobile-first** (`min-width`) keeps the base CSS simple and makes phones download no desktop overrides. **Desktop-first** (`max-width`) is the opposite and is what most projects in this repo use.
- `.nav-toggle[aria-expanded="true"] + .nav` uses the **adjacent sibling** combinator (`+`): the `<nav>` must come right after the button in the HTML. Because the style is driven by `aria-expanded`, the visual state and the state screen readers hear can never drift apart.
- Choose breakpoints where **your content** breaks (links start to wrap), not for specific phone models.

## Approach 1: JavaScript Toggle (Recommended)

```js
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById(toggle.getAttribute("aria-controls"));

function setMenu(open) {
  toggle.setAttribute("aria-expanded", String(open));
}

// 1. Open/close on click
toggle.addEventListener("click", () => {
  const isOpen = toggle.getAttribute("aria-expanded") === "true";
  setMenu(!isOpen);
});

// 2. Close with Escape and give focus back to the button
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    toggle.focus();
  }
});

// 3. Close after a link is chosen (useful on one-page sites)
nav.addEventListener("click", (e) => {
  if (e.target.closest("a")) setMenu(false);
});

// 4. Reset when the screen becomes desktop-sized (same breakpoint as the CSS)
const desktop = window.matchMedia("(min-width: 768px)");
desktop.addEventListener("change", (e) => {
  if (e.matches) setMenu(false);
});
```

1. The click handler flips `aria-expanded`; the CSS rule above shows or hides the menu from that attribute.
2. Escape is the expected way to close any pop-up content; returning focus prevents keyboard users from being "lost" on the page.
3. On single-page sites, clicking an in-page link would otherwise leave the menu covering the content.
4. `matchMedia` runs a callback when a media query starts or stops matching, so JavaScript and CSS use the **same** breakpoint.

### Animating the hamburger into an X

```css
.nav-toggle {
  background: none;
  border: 0;
  padding: 0.5rem;
  cursor: pointer;
  color: inherit;
}
.nav-toggle .bar {
  display: block;
  width: 24px;
  height: 3px;
  margin: 5px 0;
  background: currentColor;
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.nav-toggle[aria-expanded="true"] .bar:nth-child(1) {
  transform: translateY(8px) rotate(45deg);
}
.nav-toggle[aria-expanded="true"] .bar:nth-child(2) {
  opacity: 0;
}
.nav-toggle[aria-expanded="true"] .bar:nth-child(3) {
  transform: translateY(-8px) rotate(-45deg);
}
.nav-toggle:focus-visible {
  outline: 3px solid #3e54a3;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .nav-toggle .bar { transition: none; }
}
```

Why `8px`? Each bar is 3px tall, and adjacent vertical margins collapse to 5px, so the centres of neighbouring bars are 3 + 5 = 8px apart. Moving the top bar down 8px and the bottom bar up 8px stacks them on the middle bar before they rotate.

### Sliding the menu instead of popping it

`display: none` cannot be animated. To slide the menu in, keep it rendered and transition `transform` plus `visibility`:

```css
@media (max-width: 767.98px) {
  .nav {
    display: block;
    position: fixed;
    inset: 4rem 0 auto 0;          /* below a 4rem-tall header */
    background: #fff;
    transform: translateY(-110%);
    visibility: hidden;            /* closed links are not tabbable or read out */
    transition: transform 0.3s ease, visibility 0.3s;
  }
  .nav-toggle[aria-expanded="true"] + .nav {
    transform: translateY(0);
    visibility: visible;
  }
}
```

## Approach 2: CSS-Only Toggles

### The checkbox hack

A hidden checkbox holds the open/closed state, and its `<label>` acts as the hamburger:

```html
<input type="checkbox" id="nav-check" class="nav-check">
<label for="nav-check" class="nav-toggle">
  <span class="visually-hidden">Menu</span>
  <span class="bar"></span><span class="bar"></span><span class="bar"></span>
</label>
<nav class="nav">...</nav>
```

```css
.nav-check {
  position: absolute;
  opacity: 0;                  /* invisible but still focusable */
}
.nav-check:checked ~ .nav {    /* ~ = any later sibling */
  display: block;
}
.nav-check:focus-visible + .nav-toggle {
  outline: 3px solid #3e54a3;  /* show focus on the visible label */
}
.visually-hidden {             /* text for screen readers only */
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

It works without JavaScript, but screen readers announce "Menu, checkbox, not checked" instead of "Menu, button, collapsed", it does not close on Escape or after a link is clicked, and the `<input>` must come before the elements it controls in the HTML.

### Other no-JavaScript options

- **`<details>`/`<summary>`:** a native disclosure widget with correct keyboard and screen-reader behaviour. Wrap the mobile menu in `<details>` and style `details[open]`.
- **Popover API:** `<button popovertarget="primary-nav">Menu</button>` with `<nav id="primary-nav" popover>` opens the menu on top of the page and closes it on Escape or on a click outside, with no JavaScript. It is supported in all current major browsers.

### CSS-only vs JavaScript

| | Checkbox hack | `<details>` / popover | JavaScript + `aria-expanded` |
|---|---|---|---|
| JavaScript | None | None | A few lines |
| Announced as | Checkbox | Button (expanded/collapsed) | Button (expanded/collapsed) |
| Escape to close | No | Popover: yes; details: no | Yes (you add it) |
| Close after link click | No | No (popover: only by clicking outside) | Yes (you add it) |
| Full control of animation and focus | Limited | Limited | Full |

## Accessibility Checklist

- The toggle is a real `<button>` with an accessible name (`aria-label` or visually hidden text).
- `aria-expanded` is updated on every open and close; `aria-controls` points to the menu's `id`.
- Hidden links are really hidden (`display: none` or `visibility: hidden`), not just moved off screen or made transparent.
- Every link and the button have a visible `:focus-visible` style.
- Escape closes the menu and returns focus to the button.
- Touch targets are big enough: at least 24×24 CSS pixels (WCAG 2.2 AA); 44×44 is the commonly recommended size.
- Animations respect `prefers-reduced-motion`.
- The current page is marked with `aria-current="page"`.

## Common Mistakes

- **A `<div>` or `<i>` as the hamburger.** It cannot be focused or used with the keyboard. Use `<button>`.
- **Toggling a class but never updating `aria-expanded`.** The menu opens visually; screen readers hear nothing.
- **Trying to transition `display`.** Use `transform`/`opacity` together with `visibility`.
- **Overlapping breakpoints.** `max-width: 768px` and `min-width: 768px` both match at exactly 768px, so both rule sets apply. Use 767.98px for the `max-width` side, or the range syntax `@media (width < 768px)` and `@media (width >= 768px)`, which modern browsers support.
- **CSS and JavaScript breakpoints that disagree.** Use `matchMedia` with the same query as the CSS.
- **Menu left open (or `overflow: hidden` left on `<body>`) after resizing to desktop.** Reset the state in a `matchMedia` change handler.
- **A fixed or sticky header covering section headings** after clicking a nav link. Add `scroll-margin-top` to the targets (or `scroll-padding-top` on `html`) equal to the header height; see [Headings, links and bookmarks](../../01-html/02-headings-links-bookmarks/notes.md).
- **A full-screen mobile menu with `height: 100vh`.** On phones it can be taller than the visible area; use `100dvh`.
- **Missing viewport meta tag.** Media queries never match on phones without it.

## Key Takeaways

- Structure: `<header>` → logo + `<button aria-expanded aria-controls>` + `<nav>` → `<ul>` of links.
- Mobile-first: hide the menu and show the button by default; show the row of links and hide the button in a `min-width` media query.
- Drive the open state from `aria-expanded` (`.nav-toggle[aria-expanded="true"] + .nav`) so visuals and accessibility always match.
- JavaScript adds what CSS cannot: correct button semantics, Escape to close, closing after a link click, and a reset at the desktop breakpoint via `matchMedia`.
- CSS-only options (checkbox hack, `<details>`, popover) work without JavaScript but have trade-offs in semantics and control.
- Animate with `transform`/`opacity` + `visibility`, not `display`, and respect `prefers-reduced-motion`.

## Interview Questions

### Junior (0–1 year)

**Q1. How do you make a navbar responsive?**
Use Flexbox to lay the links out in a row on wide screens. Below a breakpoint, hide the link list and show a hamburger button that toggles it, using a media query to switch between the two layouts. Add the viewport meta tag so phones report their real width to the media queries.

**Q2. Why should the hamburger be a `<button>`, and which ARIA attributes does it need?**
A `<button>` is focusable, works with Enter and Space, and is announced as a button, all without extra code. It needs an accessible name (`aria-label="Menu"`, because the bars are not text), `aria-expanded` to announce whether the menu is open, and optionally `aria-controls` pointing to the menu's `id`.

**Q3. What is the "checkbox hack"?**
A CSS-only technique that stores state in a visually hidden checkbox. Its `<label>` is styled as the hamburger, and a selector like `.nav-check:checked ~ .nav { display: block; }` shows the menu when the box is checked. It needs no JavaScript, but it is announced as a checkbox rather than a menu button and cannot close on Escape.

### Mid-level (2–4 years)

**Q4. The menu opens and closes correctly, but screen-reader users say nothing happens. What is wrong, and how do you fix it?**
Most likely only a CSS class is toggled, so `aria-expanded` stays `"false"` (or is missing), and the button may also have no accessible name. Set `aria-expanded` on every toggle, give the button a label, and make sure closed links are hidden with `display: none` or `visibility: hidden`. Styling from `[aria-expanded="true"]` makes it impossible to forget the attribute.

**Q5. At exactly 768px wide, the layout looks broken: both the hamburger and the full menu appear. Why?**
The CSS uses `max-width: 768px` for mobile and `min-width: 768px` for desktop. Both conditions are true at exactly 768px, so both rule sets apply. Make the ranges exclusive: `max-width: 767.98px`, or the media-query range syntax `(width < 768px)` and `(width >= 768px)`.

**Q6. How would you animate a mobile menu that is currently shown and hidden with `display`?**
`display` is not animatable, so keep the menu rendered and animate `transform` (slide) or `opacity` (fade), which are also cheap for the browser to animate. Pair them with `visibility: hidden` in the closed state, so the links are not focusable or announced while invisible; `visibility` switches at the right moment when included in the transition. Turn the animation off for `prefers-reduced-motion: reduce`.

**Q7. How do you keep JavaScript behaviour in sync with CSS breakpoints?**
Use `window.matchMedia("(min-width: 768px)")` with the same query the CSS uses, read `.matches` for the current state, and listen for its `change` event to react when the breakpoint is crossed. This is more reliable and cheaper than checking `window.innerWidth` in a `resize` handler. To avoid duplicating the number, store the breakpoint in one place, such as a shared constant or a build-time variable.

**Q8. How would you build this navbar in React?**
Keep `const [open, setOpen] = useState(false)` and render `<button aria-expanded={open} aria-controls="primary-nav" onClick={() => setOpen(o => !o)}>`, then style or render the `<nav>` from `open`. In a `useEffect`, add the Escape `keydown` and `matchMedia` listeners and remove them in the cleanup function. Close the menu when the route changes (for example by watching the router's location) so it does not stay open on the next page.

### Senior (5+ years)

**Q9. The site navigation grows dropdown submenus. A teammate proposes `role="menubar"` and `role="menu"` because "it is a menu". What do you say?**
Don't. The ARIA `menu`/`menubar` roles describe **application** menus, like a desktop app's File/Edit menu. They change what screen-reader users expect: arrow keys move between items, Tab leaves the whole widget, and some screen readers switch into an application mode. You then owe a full roving-focus keyboard implementation, and site visitors who expect a list of links get something that behaves like software instead.

Website navigation is a set of **disclosures**: each top-level item with children is a `<button aria-expanded>` that shows a nested `<ul>` of ordinary links, and Tab moves through everything. Recommendation: use the WAI-ARIA disclosure navigation pattern, add Escape-to-close and close-on-focus-leaving, and reserve `menu` roles for real application menus (a context menu in an editor, for example).

**Q10. On phones the open menu covers the whole screen, but keyboard and screen-reader users can still reach the page behind it, and the page scrolls underneath. How do you fix it?**
A full-screen menu behaves like a modal, so it needs modal behaviour: the content behind it must be unreachable (focus and the accessibility tree), background scrolling must stop, Escape must close it and focus must return to the button. Options:

| Option | Gives you | Cost |
|---|---|---|
| `<dialog>` + `showModal()` | Top layer, background made inert, Escape closes, focus moves in | Page scroll is not locked (add it yourself); style `::backdrop`. Current browsers return focus to the opener on close, but test older ones |
| `inert` on `<main>` and `<footer>` while open | Background unreachable, no focus-trap script | Remember to remove it; scroll lock is separate |
| Hand-written focus trap | Works everywhere | Most code, easiest to get wrong |

For scroll locking, set `overflow: hidden` on `<html>` while open (and remove it on close and at the desktop breakpoint), and use `overscroll-behavior: contain` on the menu so scroll does not chain to the page. Recommendation: build the full-screen variant on `<dialog>.showModal()`; keep the push-down variant (the menu just expands under the header) as a plain disclosure with no trap, because it does not cover the page.

**Q11. In German and French the desktop links no longer fit in one row at 1024px, and the logo wraps. How would you design the navigation so it survives translations and new links?**
Fixed viewport breakpoints assume a known content width, which translations (often 30% longer than English) and marketing's new links break. Options, from simplest:

- Choose the breakpoint from the **longest** locale and test every locale in visual regression tests.
- Make the switch depend on the space the nav actually has: a container query on the header (`container-type: inline-size`), so the same component works in a full-width header and a narrow sidebar.
- A "priority+" pattern: show as many links as fit and move the rest into a "More" disclosure, measured with a `ResizeObserver`. It adapts to any content but costs JavaScript and needs care to avoid layout shift on load.

Recommendation: a container-query breakpoint tuned to the longest locale, enforced by visual tests across locales; reach for priority+ only when the link list is long and changes often.

**Q12. The navbar is server-rendered, but on slow phones the hamburger does nothing for several seconds until JavaScript loads. How do you fix this?**
The button looks interactive before its click handler exists (the hydration gap). Pick a baseline that works without JavaScript: render the nav with a CSS-only mechanism (the popover API with `popovertarget`, or `<details>`), or show the links by default and let a `js` class on `<html>`, set by a tiny inline script, switch on the collapsed layout. Then enhance with the JavaScript behaviour once it loads.

Also reserve the header's height in CSS so the late-loading menu or a web font swap does not cause layout shift (CLS). Recommendation: popover or `<details>` as the no-JS baseline with JavaScript as an enhancement, and measure interaction readiness on a throttled mid-range phone, not on a developer laptop.

> **Note:** Related questions answered elsewhere: [Headings, links and bookmarks](../../01-html/02-headings-links-bookmarks/notes.md#interview-questions) (a fixed header hides the anchor target); [HTML Document Basics](../../01-html/01-document-and-boilerplate/notes.md#interview-questions) (the viewport meta tag); [CSS Media Queries and Container Queries](../../02-css/15-media-and-container-queries/notes.md#interview-questions) (mobile-first vs desktop-first).

## References

- [Video tutorial (from the original notes)](https://youtu.be/U8smiWQ8Seg)
- [MDN: nav element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav)
- [MDN: aria-expanded](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-expanded)
- [MDN: @media](https://developer.mozilla.org/en-US/docs/Web/CSS/@media)
- [MDN: Window.matchMedia()](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
- [MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- [MDN: inert attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert)
- [WAI-ARIA Authoring Practices: Disclosure navigation menu example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
- [MDN: scroll-margin-top](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin-top)
- [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag)
