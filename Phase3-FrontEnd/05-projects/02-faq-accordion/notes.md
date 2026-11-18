# Accessible FAQ Accordion

> Project · Topic 2

An FAQ accordion is a list of questions where each answer opens and closes when you click its question. It appears on almost every landing page (the [Netflix clone](../01-netflix-clone/notes.md) in this repo has one), and it is a common interview task because it tests HTML semantics, keyboard access, ARIA state and CSS animation together. These notes show two accessible ways to build it: native `<details>`/`<summary>` with no JavaScript, and a `<button>` with `aria-expanded` controlled by JavaScript.

Video tutorial saved in the original notes: <https://youtu.be/IcyXS9aL4bs>

## What an Accordion Must Do

| Requirement | Why |
|---|---|
| Each question is a real **button** (or `<summary>`) | It can be reached with Tab and activated with Enter/Space, and screen readers announce it as interactive |
| The open/closed **state is announced** | Screen readers say "expanded" or "collapsed"; sighted users see an icon change |
| Closed answers are **really hidden** | Hidden links inside a closed answer must not be tabbable or read out |
| A **visible focus** style | Keyboard users need to see which question is focused |
| Works **without a mouse** | Many users navigate only with the keyboard |

## Approach 1: `<details>` and `<summary>` (No JavaScript)

The browser has a built-in disclosure widget. `<summary>` is the clickable question; everything else inside `<details>` is the answer. The element itself (the `toggle` event, the `open` attribute, exclusive groups and how it compares with `<dialog>` and popovers) is covered in [Interactive elements and web components](../../01-html/12-interactive-elements-and-web-components/notes.md); this section focuses on using it as an FAQ.

```html
<section class="faq">
  <h2>Frequently Asked Questions</h2>

  <details name="faq">
    <summary>What is Netflix?</summary>
    <p>Netflix is a streaming service that offers TV shows, movies and documentaries.</p>
  </details>

  <details name="faq">
    <summary>How much does Netflix cost?</summary>
    <p>Plans start from a monthly fee. No extra costs, no contracts.</p>
  </details>

  <details name="faq" open>
    <summary>How do I cancel?</summary>
    <p>You can cancel online in two clicks, at any time.</p>
  </details>
</section>
```

What you get for free:

- `<summary>` behaves like a button: focusable, works with Enter and Space, announced as expanded/collapsed.
- The `open` attribute is added and removed automatically; add it in the HTML to start an item open.
- A `toggle` event fires on `<details>` whenever it opens or closes, if you want to track it.
- `name="faq"` on several `<details>` makes them an **exclusive accordion**: opening one closes the others. This is supported in current Chrome, Edge, Safari and Firefox; older browsers just ignore it and allow several open items.

### Styling it

```css
.faq details {
  border-bottom: 1px solid #444;
}

.faq summary {
  list-style: none;                 /* remove the default triangle marker */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  font-size: 1.25rem;
  cursor: pointer;
  background: #2d2d2d;
  color: #fff;
}
.faq summary::-webkit-details-marker {
  display: none;                    /* remove the marker in Safari */
}

.faq summary::after {               /* our own + icon */
  content: "+";
  font-size: 2rem;
  line-height: 1;
  transition: transform 0.2s ease;
}
.faq details[open] summary::after {
  transform: rotate(45deg);         /* + turns into x when open */
}

.faq summary:focus-visible {
  outline: 3px solid #e50914;
  outline-offset: 2px;
}

.faq details p {
  padding: 1rem 1.25rem;
  background: #2d2d2d;
  color: #ddd;
}
```

`details[open]` is how you style the open state, because the browser toggles that attribute for you.

### Limits of `<details>`

- **No smooth height animation by default.** The answer appears instantly. Recent Chromium-based browsers can animate it with `interpolate-size: allow-keywords` and the `::details-content` pseudo-element; treat that as a progressive enhancement. [Transitions](../../02-css/18-transitions/notes.md) explains the `height: auto` problem and its fixes.
- **Headings inside `<summary>`:** `<summary>` acts as a button, and some screen readers flatten its content, so a heading placed inside may not appear in heading navigation. If users need to jump between questions by heading, use Approach 2.
- **Do not put links or buttons inside `<summary>`;** a control nested inside another control is confusing and unreliable.

## Approach 2: Button + `aria-expanded` (JavaScript)

This follows the WAI-ARIA accordion pattern: each question is a `<button>` inside a heading, and the button tells assistive technology whether its panel is open.

```html
<div class="accordion">
  <h3>
    <button type="button" class="accordion-trigger" id="faq-1-btn"
            aria-expanded="false" aria-controls="faq-1">
      What is Netflix?
      <span class="accordion-icon" aria-hidden="true"></span>
    </button>
  </h3>
  <div class="accordion-panel" id="faq-1" role="region" aria-labelledby="faq-1-btn" hidden>
    <p>Netflix is a streaming service that offers TV shows, movies and documentaries.</p>
  </div>

  <h3>
    <button type="button" class="accordion-trigger" id="faq-2-btn"
            aria-expanded="false" aria-controls="faq-2">
      How much does Netflix cost?
      <span class="accordion-icon" aria-hidden="true"></span>
    </button>
  </h3>
  <div class="accordion-panel" id="faq-2" role="region" aria-labelledby="faq-2-btn" hidden>
    <p>Plans start from a monthly fee. No extra costs, no contracts.</p>
  </div>
</div>
```

| Attribute | On | Purpose |
|---|---|---|
| `aria-expanded="true/false"` | Button | Announces "expanded" / "collapsed"; **must** be updated on every toggle |
| `aria-controls="faq-1"` | Button | Points to the panel the button controls (the panel's `id`) |
| `hidden` | Panel | Hides the panel visually **and** from screen readers and the Tab order |
| `role="region"` + `aria-labelledby` | Panel | Makes each open panel a labelled landmark; recommended only for a small number of panels (about six or fewer), otherwise it adds noise |
| `aria-hidden="true"` | Icon | The icon is decoration; the state comes from `aria-expanded` |

```js
const accordion = document.querySelector(".accordion");
const allowMultiple = false; // true = several answers can be open at once

function setOpen(trigger, open) {
  trigger.setAttribute("aria-expanded", String(open));
  const panel = document.getElementById(trigger.getAttribute("aria-controls"));
  panel.hidden = !open;
}

// Event delegation: one listener on the container handles every button
accordion.addEventListener("click", (event) => {
  const trigger = event.target.closest(".accordion-trigger");
  if (!trigger) return; // the click was not on a question

  const isOpen = trigger.getAttribute("aria-expanded") === "true";

  if (!allowMultiple) {
    accordion
      .querySelectorAll('.accordion-trigger[aria-expanded="true"]')
      .forEach((other) => {
        if (other !== trigger) setOpen(other, false);
      });
  }

  setOpen(trigger, !isOpen);
});
```

How it works:

1. One click listener sits on `.accordion` (**event delegation**). `event.target.closest(".accordion-trigger")` finds the button even if the click landed on the icon `<span>` inside it.
2. The current state is read from `aria-expanded`, so the ARIA attribute is the **single source of truth**.
3. In single-open mode, every other open button is closed first.
4. `setOpen` updates both the button's `aria-expanded` and the panel's `hidden`.

Because the triggers are real `<button>` elements, Enter and Space already work and Tab moves between questions. The full WAI-ARIA pattern also *optionally* lets Up/Down arrows move between headers and Home/End jump to the first/last one.

### Styling from the ARIA state

```css
.accordion-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1rem 1.25rem;
  font: inherit;
  text-align: left;
  border: 0;
  background: #2d2d2d;
  color: #fff;
  cursor: pointer;
}
.accordion-icon::after {
  content: "+";
  display: inline-block;
  font-size: 2rem;
  transition: transform 0.2s ease;
}
.accordion-trigger[aria-expanded="true"] .accordion-icon::after {
  transform: rotate(45deg);
}
.accordion-trigger:focus-visible {
  outline: 3px solid #e50914;
  outline-offset: 2px;
}
```

Styling with `[aria-expanded="true"]` instead of a separate `.active` class means the visuals can never get out of sync with what screen readers are told.

### Animating the height (grid `0fr` → `1fr` trick)

You cannot transition `height: auto`, and `hidden` (which is `display: none`) cannot be animated. A popular trick animates a grid row from `0fr` to `1fr` instead. When you animate, toggle a class rather than `hidden`, and use `visibility` to keep the closed content out of the Tab order and away from screen readers:

```css
.accordion-panel {
  display: grid;
  grid-template-rows: 0fr;          /* collapsed: the row has no height */
  visibility: hidden;
  transition: grid-template-rows 0.3s ease, visibility 0.3s;
}
.accordion-panel > .inner {
  overflow: hidden;                 /* needed so the content can shrink to 0 */
}
.accordion-panel.is-open {
  grid-template-rows: 1fr;          /* expanded: the row takes the content's height */
  visibility: visible;
}

@media (prefers-reduced-motion: reduce) {
  .accordion-panel { transition: none; }
}
```

The panel's content goes inside `<div class="inner">`, and `setOpen` toggles `panel.classList.toggle("is-open", open)` instead of setting `hidden`. `visibility` switches to `visible` immediately when opening and stays visible until the closing animation ends, so the content is never hidden while still on screen.

## Which Approach to Choose

| | `<details>` / `<summary>` | Button + `aria-expanded` |
|---|---|---|
| JavaScript needed | No | Yes |
| Keyboard and screen-reader support | Built in | Built in via `<button>`, but you must update `aria-expanded` |
| Only one open at a time | `name` attribute (modern browsers) | A few lines of JS, works everywhere |
| Height animation | Hard (newest CSS only) | Easy (grid trick) |
| Questions as navigable headings | Unreliable | Yes (`<h3><button>`) |
| Best for | Simple FAQs, content sites, quick wins | Design-heavy pages, React/framework components |

## Common Mistakes

- **Clickable `<div>`s as questions.** A `<div>` is not focusable and does not respond to Enter/Space. If you must, you would need `tabindex="0"`, `role="button"` and key handlers; just use `<button>`.
- **Not updating `aria-expanded`.** The panel opens visually, but screen readers still say "collapsed".
- **A CSS `display` value overriding `hidden`.** `hidden` works through the browser's default `display: none`. If your CSS sets `.accordion-panel { display: flex; }`, that rule wins and the "hidden" panel stays visible. Add `[hidden] { display: none !important; }` or put `display` only on the open state (see [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md)).
- **Hiding answers with only `opacity: 0` or `height: 0`.** The links inside stay tabbable and readable. Add `visibility: hidden` or `hidden`.
- **`aria-controls` pointing to a missing or duplicate `id`.** Every panel needs a unique `id`.
- **Removing the focus outline** (`outline: none`) without a replacement.
- **Removing the `<summary>` marker** without adding another open/closed indicator.
- **Trying to animate `display: none` or `height: auto`** with a plain transition.
- **One click handler per button** created in a loop when one delegated listener on the container would do.

## Key Takeaways

- An accordion item = a **button-like control** + a **panel**; the control must expose its state.
- `<details>`/`<summary>` gives a keyboard- and screen-reader-friendly accordion with zero JavaScript; `details[open]` styles the open state and `name="..."` makes it exclusive.
- With JavaScript, use `<h3><button aria-expanded aria-controls>` and toggle the panel's `hidden`; update `aria-expanded` every time.
- Use event delegation (`closest()`) for one listener that handles every question.
- Style from `[aria-expanded="true"]` so visuals and accessibility state stay in sync.
- Animate height with the grid `0fr` → `1fr` trick plus `visibility`, and respect `prefers-reduced-motion`.

## Interview Questions

### Junior (0–1 year)

**Q1. How would you build an FAQ accordion without JavaScript?**
Wrap each question and answer in `<details>`, with the question in `<summary>`. The browser handles clicks, keyboard access and the expanded/collapsed state, and adds the `open` attribute while an item is open. Style the open state with `details[open]`, and add the same `name` attribute to all items if only one should be open at a time.

**Q2. What is `aria-expanded` and where do you put it?**
`aria-expanded` is an ARIA state attribute that tells assistive technology whether the content a control shows or hides is currently open (`"true"`) or closed (`"false"`). It goes on the **control**, the button, not on the panel. It must be updated by JavaScript every time the panel opens or closes.

**Q3. Why use a `<button>` for the question instead of a `<div>` with a click handler?**
A `<button>` is focusable, works with Enter and Space, and is announced as a button by screen readers, all for free. A `<div>` has none of this, so keyboard and screen-reader users cannot use it unless you add `tabindex`, `role="button"` and keyboard handlers by hand. Also set `type="button"` so it never submits a surrounding form.

**Q4. How do you allow only one FAQ item to be open at a time?**
With `<details>`, give all items the same `name` attribute; the browser closes the others when one opens (supported in current browsers). With the JavaScript approach, close every other open trigger (set `aria-expanded="false"` and hide its panel) before opening the clicked one.

### Mid-level (2–4 years)

**Q5. Why use event delegation for an accordion, and how does `closest()` help?**
One listener on the container handles all questions, including ones added later (for example FAQs loaded from an API), and it uses less memory than one listener per button. Because a click can land on a child element such as the icon `<span>`, `event.target.closest(".accordion-trigger")` walks up from the clicked element to find the button, and returns `null` when the click was outside any question.

**Q6. When would you choose the JavaScript approach over `<details>`?**
When questions must be real headings for screen-reader navigation, when you need a smooth height animation, single-open behaviour in older browsers, analytics on each toggle, or when state is controlled by a framework. In React, for example, the open item usually lives in state and `aria-expanded` is rendered from it. For a simple content FAQ, `<details>` is less code and harder to get wrong.

**Q7. How would you build this accordion as a React component?**
Keep the open item's index (or a `Set` of open indexes) in `useState`. Render each item as `<h3><button aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(i)}>` followed by `<div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>`. Generate stable unique IDs with `useId()` so several accordions on one page do not clash, and use a stable `key`, such as the FAQ's ID, when mapping over the data.

**Q8. A user searches the page with Ctrl+F for a word that is inside a closed answer, and the browser finds nothing. How do you fix it?**
Content hidden with `hidden` (that is, `display: none`) is skipped by find-in-page. Two fixes make collapsed answers searchable:

- With `<details>`, Chromium-based browsers search inside closed items and open the matching one automatically, with no code.
- With the JavaScript accordion, use `hidden="until-found"` on the panel instead of plain `hidden`. The browser can then find the text, removes the attribute itself and fires a `beforematch` event on the panel; listen for it and set the button's `aria-expanded="true"` so the state stays in sync.

`until-found` started in Chromium and other engines have been adding it; where it is not supported it behaves like plain `hidden`, so it is a safe progressive enhancement. It does not work with the `visibility`-based animation, because the panel must use the `hidden` attribute.

### Senior (5+ years)

**Q9. You are designing the `Accordion` component for a design system used by many product teams. What API would you expose?**
Use compound components (`Accordion`, `Accordion.Item`, `Accordion.Trigger`, `Accordion.Panel`) so teams compose markup instead of passing deeply nested config objects. Support both modes: uncontrolled (`defaultValue`) for the common case and controlled (`value` + `onValueChange`) when a page must open an item from outside, for example from a URL hash. Expose `type="single" | "multiple"` and `collapsible`, and a `headingLevel` prop, because the right heading level depends on where the accordion sits on the page and a hard-coded `<h3>` breaks the outline.

Keep the accessibility contract inside the component: generated IDs, `aria-expanded`, `aria-controls`, `hidden="until-found"` and keyboard handling are not props, so no team can get them wrong. Recommendation: a small, opinionated API with the ARIA wiring locked in, plus an escape hatch (`asChild` or a render prop) for custom trigger markup, documented with one do/don't example per prop.

**Q10. Marketing asks whether hiding FAQ answers in an accordion hurts SEO, and whether to load each answer from an API when it is opened. What do you advise?**
Collapsed content that is in the HTML is crawled and indexed; with mobile-first indexing Google does not discount content just because it starts collapsed. Content that is fetched only after a click is not in the page the crawler renders, so it is effectively invisible to search and also slower for users. Server-render every answer into the HTML and hide it with `<details>` or `hidden`.

`FAQPage` structured data is still valid markup, but since 2023 Google shows FAQ rich results only for a small set of authoritative government and health sites, so do not promise rich snippets. Recommendation: answers in the initial HTML, no click-to-fetch, structured data only if it costs nothing to maintain.

**Q11. How would you make sure accordions stay accessible across dozens of pages built by different teams?**
Automate what can be automated and make the rest cheap to check. axe-core in CI (or a Playwright test with `@axe-core/playwright`) catches missing names, broken `aria-controls` references and contrast problems, but automated tools find only part of real accessibility issues; they cannot tell whether `aria-expanded` changes at the right time. Add a component-level test that clicks and presses Enter/Space on a trigger and asserts the `aria-expanded` value and the panel's visibility, and an accessibility-tree snapshot test for the shipped component.

For manual testing, keep a short matrix: keyboard only, NVDA with Firefox or Chrome, VoiceOver with Safari on macOS and iOS, and TalkBack on Android. Recommendation: one shared, tested component (so teams cannot build their own), automated checks in CI as the floor, and a manual screen-reader pass for each release of the design-system component rather than for each page.

**Q12. You want to replace a custom JavaScript accordion used on 40 pages with native `<details name>`. How do you plan the migration?**
First list what the custom version does that `<details>` does not: heading semantics for the questions, analytics events, deep links that open an item from `#hash`, height animation. Then decide for each one: `toggle` events replace click analytics; a few lines on page load read `location.hash` and set `open` on the matching item; `::details-content` with `interpolate-size` gives animation in Chromium and degrades to an instant open elsewhere; the heading loss is the one real trade-off, so keep the JavaScript version where users navigate FAQs by heading.

Roll it out behind the shared component's API so pages change one import, not their markup; ship it to a few pages first, compare analytics and accessibility test results, then migrate the rest. Recommendation: migrate when the gain (less JavaScript, no state bugs) outweighs the heading-navigation loss for that content, and keep both implementations behind the same component API until the old one has no users.

> **Note:** Related questions answered elsewhere: [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md#interview-questions) (a `hidden` element that is still visible) · [Transitions](../../02-css/18-transitions/notes.md#interview-questions) (animating an accordion to `height: auto`).

## References

- [Video tutorial (from the original notes)](https://youtu.be/IcyXS9aL4bs)
- [MDN: details element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)
- [MDN: summary element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/summary)
- [MDN: aria-expanded](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-expanded)
- [MDN: hidden attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden) (including `until-found`)
- [MDN: beforematch event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforematch_event)
- [WAI-ARIA Authoring Practices: Accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- [MDN: Element.closest()](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
