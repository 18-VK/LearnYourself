# Interactive Elements and Web Components

> HTML · Topic 12 · Demo: [index.html](index.html) · Open index.html in a browser; use each widget with the mouse, then again with Tab, Enter and Esc.

HTML now ships interactive building blocks that used to need a JavaScript library: a disclosure widget (`<details>`), dialogs (`<dialog>`), popovers (the `popover` attribute) and a way to switch a whole region off (`inert`). The browser handles keyboard support, focus, Esc, stacking and accessibility semantics for you, which removes whole classes of bugs. When no native element fits, **Web Components** let you define your own HTML elements with encapsulated markup and styles that work in any framework or none. This note covers the top layer that dialogs and popovers rely on, each element's behaviour and gotchas, the Web Components standards (custom elements, Shadow DOM, slots, `::part`, declarative shadow DOM, form-associated elements), and when to choose them over framework components. Browser support is stated as of late 2026.

## Support at a Glance

| Feature | Support (late 2026) |
|---|---|
| `<details>` / `<summary>` | All browsers, for many years |
| `<details name="...">` exclusive accordion | All major browsers since 2024 (Firefox 130 was last) |
| `::details-content` pseudo-element | All major browsers since 2025 (Chrome 131, Safari 18.4, Firefox 143) |
| `<dialog>`, `showModal()`, `::backdrop` | All major browsers since 2022 |
| `dialog.requestClose()` | All major browsers since 2025 (Chrome 134, Firefox 139, Safari 18.4) |
| `closedby` attribute on `<dialog>` | Chrome 134+, Firefox 141+; **not in stable Safari yet** (it is in the Safari 27.3 beta) |
| Invoker commands (`commandfor` / `command`) | All major browsers since December 2025 (Chrome 135, Firefox 144, Safari 26.2) |
| Popover API (`popover`, `popovertarget`) | All major browsers since 2024 (Firefox 125 was last) |
| `popover="hint"` | Chrome 151+ and Firefox 153+ (earlier versions shipped an older, partial version); **not in stable Safari yet** |
| CSS anchor positioning | Chrome 125, Safari 26 (September 2025), Firefox 147 (January 2026): in every current engine, but new |
| `inert` attribute | All major browsers since 2023 |
| Custom elements, Shadow DOM, slots, `::part` | All major browsers since 2018–2020 |
| Customized built-ins (`<button is="...">`) | Chrome and Firefox only; **Safari has declined to implement them** |
| Declarative shadow DOM | All major browsers since 2024 (Firefox 123 was last) |
| Form-associated custom elements (`ElementInternals`) | All major browsers since 2023 (Safari 16.4 was last) |
| Scoped custom element registries | Safari 26, Chrome 146, Firefox 159 (October 2026): only just everywhere |

## The Top Layer

The **top layer** is a rendering layer that sits above the whole document. An element placed there:

- is drawn above every stacking context, whatever its own or its ancestors' `z-index` (there is no `z-index` to set);
- escapes ancestors that would clip or capture it: `overflow: hidden`, `transform`, `filter`, `contain`;
- is positioned against the viewport;
- gets a `::backdrop` pseudo-element drawn just below it, covering the viewport.

Only the browser can put elements there: a `<dialog>` opened with `showModal()`, an open popover, and an element in fullscreen (`requestFullscreen()`). Among top-layer elements, the most recently added is on top, so a popover opened from inside a modal dialog appears above the dialog. DevTools marks these elements with a `top-layer` badge in the Elements panel.

This is why dialogs and popovers end the "my dropdown is clipped" and "`z-index: 9999` doesn't work" bugs; the stacking rules they bypass are in [Position and z-index](../../02-css/11-position-and-z-index/notes.md#stacking-context).

## `<details>` and `<summary>`

The `<details>` element is a disclosure widget: additional details that the user opens and closes on demand, such as an FAQ entry, "show more" or a spoiler. It is **closed** by default; when opened it expands to show its content. Any content can go inside `<details>`.

```html
<details>
  <summary>Epcot Center</summary>
  <p>Epcot is a theme park at Walt Disney World Resort featuring exciting attractions, international pavilions, award-winning fireworks and seasonal special events.</p>
</details>
```

- `<summary>` must be the **first child**; it is the always-visible, clickable heading. Without it, the browser shows the word "Details".
- The boolean **`open`** attribute shows it expanded on page load (`<details open>`). The browser adds and removes the attribute as the user toggles it, so `details[open]` styles the open state.
- It works with the keyboard (Tab to the summary, Enter or Space to toggle) and is announced as expanded or collapsed by screen readers, with no JavaScript.
- JavaScript can read or set `details.open` and listen for the **`toggle`** event, which fires after the state changes and can't be cancelled.
- Several `<details>` with the same **`name`** form an **exclusive accordion**: opening one closes the others (all major browsers since 2024; older ones just allow several open).
- The triangle can be restyled with `summary::marker` or removed with `summary { list-style: none; }` (plus `summary::-webkit-details-marker { display: none; }` for older Safari).
- **`::details-content`** selects the expandable part, so you can style or animate it without an extra wrapper. Animating its height still needs `interpolate-size: allow-keywords` or `calc-size()`, which only Chromium supports; see [Transitions](../../02-css/18-transitions/notes.md#animating-to-height-auto). Treat the animation as an enhancement.
- **Find in page** opens a closed `<details>` when the match is inside it (Chrome, current Firefox; Safari 26.2+ with scrolling bugs). For your own collapsible sections, `hidden="until-found"` gives the same behaviour, with the same browser support, and fires a `beforematch` event.

What it is **not** for: menus, dropdowns and tooltips that should close when the user clicks elsewhere (use a popover), tabs (one panel always visible, arrow-key navigation), and anything that must not render its content until opened.

**`<details>` or a custom JavaScript disclosure?** Use `<details>` by default for show/hide content: it is accessible, works before or without JavaScript, survives find-in-page, and the `name` attribute makes it an accordion. Reach for a `<button aria-expanded aria-controls>` built in JavaScript when the questions must be real headings for screen-reader heading navigation (content inside `<summary>` is flattened into a button), when the open state lives in framework state, or when you need behaviour `<details>` lacks. Both approaches, with styling and the height animation, are built in [FAQ accordion](../../05-projects/02-faq-accordion/notes.md).

## `<dialog>`

A `<dialog>` is hidden until you open it. The method you use decides what kind of dialog it is.

| | `dialog.show()` | `dialog.showModal()` |
|---|---|---|
| Rendered in | The page, absolutely positioned and subject to normal stacking | The **top layer** |
| `::backdrop` | No | Yes (default: a light dim) |
| Rest of the page | Still interactive | **Inert**: can't be clicked, focused or read by screen readers |
| Esc closes it | No (unless `closedby` says so) | Yes |
| Matches `:modal` | No | Yes |
| Use for | Non-blocking panels (chat, inspector) | Confirmations and tasks that must be finished or cancelled |

Never open a dialog by adding the `open` attribute yourself: you get a non-modal dialog without top layer or focus handling, and removing the attribute later doesn't fire `close`.

```html
<button type="button" id="delete-btn">Delete file…</button>

<dialog id="confirm" aria-labelledby="confirm-title">
  <form method="dialog">
    <h2 id="confirm-title">Delete "report.pdf"?</h2>
    <p>This cannot be undone.</p>
    <button value="cancel" autofocus>Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
```

```js
const dialog = document.getElementById("confirm");
document.getElementById("delete-btn").addEventListener("click", () => {
  dialog.returnValue = "";   // reset: closing with Esc does not set a new value
  dialog.showModal();
});
dialog.addEventListener("close", () => {
  console.log(dialog.returnValue);   // → "delete", "cancel", or "" after Esc
  if (dialog.returnValue === "delete") deleteFile();
});
```

- **`<form method="dialog">`**: submitting it closes the dialog instead of sending a request, and `dialog.returnValue` becomes the `value` of the button that submitted it. A single button in a normal form can do the same with `formmethod="dialog"`.
- Constraint validation still runs on a `method="dialog"` submit, so a Cancel button in a form with `required` fields needs `formnovalidate`, or it won't close.
- `dialog.close("delete")` closes it from script and sets `returnValue`.

### Closing: Esc, `requestClose()` and `closedby`

| Way to close | Fires `cancel` first? | Notes |
|---|---|---|
| `dialog.close(value)` | No | Immediate |
| `dialog.requestClose(value)` | Yes | Behaves like Esc: listen for `cancel` and call `preventDefault()` to stop it ("You have unsaved changes") |
| Esc key, Android back gesture (a "close request") | Yes | Modal dialogs by default; non-modal only with `closedby` |
| Submitting a `<form method="dialog">` | No | Sets `returnValue` from the submit button |
| Click outside (light dismiss) | Yes | Only with `closedby="any"` |

The **`closedby`** attribute declares which user actions may close the dialog: `any` (Esc, close requests and clicks outside), `closerequest` (Esc and close requests only; the default for modal dialogs) or `none` (only your code; the default for non-modal ones). Safari doesn't support it yet, so for "click the backdrop to close" keep a fallback:

```js
if (!("closedBy" in HTMLDialogElement.prototype)) {
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();   // backdrop clicks are dispatched to the <dialog> itself
  });
}
```

Clicks on the dialog's own padding also have `e.target === dialog`, so give the dialog `padding: 0` and put the content in an inner wrapper that fills it. Also, don't rely on `preventDefault()` in `cancel` to trap users: browsers that implement the close-watcher anti-abuse rules (Chromium first) let a second Esc through if the user hasn't interacted with the page in between.

### Focus behaviour

- **On open**, focus moves into the dialog: to the descendant with `autofocus` if there is one, otherwise to the first focusable element (browsers have differed here, so set `autofocus` explicitly). Put it on the least destructive action for a confirmation, on the first field for a form.
- **While modal**, everything outside is inert, so Tab cycles through the dialog's controls and the browser's own UI. That is expected; no focus-trap script is needed.
- **On close**, current browsers return focus to the element that had it before the dialog opened. If that element was removed (the deleted row), move focus somewhere sensible yourself.
- **Semantics**: the implicit role is `dialog`, and a modal one is exposed as modal. Give it a name with `aria-labelledby` pointing at its heading. For urgent confirmations, `role="alertdialog"` tells screen readers to read the message immediately.

The accessibility reasons behind these rules are in [Web accessibility](../11-accessibility/notes.md).

### Opening without JavaScript: invoker commands

Since December 2025 every major browser supports **invoker commands**, which wire a button to a dialog or popover declaratively:

```html
<button type="button" commandfor="confirm" command="show-modal">Delete file…</button>
<!-- inside the dialog -->
<button type="button" commandfor="confirm" command="close">Cancel</button>
```

Built-in commands: `show-modal`, `close`, `request-close`, `show-popover`, `hide-popover`, `toggle-popover`. A command starting with `--` (`command="--refresh"`) is a custom command: the target receives a `command` event whose `command` property is `"--refresh"`. Older browsers ignore these attributes, so the button does nothing there; keep a script fallback if you support them.

### Styling and animating

```css
dialog::backdrop { background: rgb(0 0 0 / 0.5); }

/* ✅ lock page scrolling only while a *modal* dialog is open */
html:has(dialog:modal) { overflow: hidden; }

/* ❌ dialog { display: grid; } overrides the browser's dialog:not([open]) { display: none } */
/* ✅ only style display for the open state */
dialog[open] { display: grid; gap: 1rem; }
```

Entry and exit animations use `@starting-style` and `transition-behavior: allow-discrete` (explained in [Transitions](../../02-css/18-transitions/notes.md)). For top-layer elements you also transition the `overlay` property, so the element stays in the top layer until the exit animation ends. Support is uneven: entry fades work everywhere, but transitioning `display` works only in Chromium and Safari 18+, and `overlay` only in Chromium. Elsewhere the dialog simply disappears at once, which is a fine fallback.

## The Popover API

The `popover` attribute turns any element into a popover: hidden by default, shown in the top layer, with optional light dismiss (closing on a click outside or Esc).

| `popover` value | Light dismiss | When it opens | Use for |
|---|---|---|---|
| `auto` (or just `popover`) | Yes | Closes other `auto` popovers that aren't its ancestors | Menus, pickers, "more actions" panels, teaching bubbles |
| `manual` | No: only your code or a button closes it | Closes nothing | Toasts, persistent panels, several open at once |
| `hint` | Yes | Closes other `hint` popovers but leaves `auto` ones open | Tooltips and previews shown on hover or focus |

```html
<button type="button" popovertarget="account-menu">Account</button>
<div id="account-menu" popover>
  <a href="/profile">Profile</a>
  <a href="/settings">Settings</a>
  <button type="button" popovertarget="account-menu" popovertargetaction="hide">Close</button>
</div>
```

`popovertarget` works on `<button>` (and `<input type="button">`); `popovertargetaction` is `toggle` (default), `show` or `hide`. From JavaScript:

```js
const menu = document.getElementById("account-menu");
menu.showPopover();     // also hidePopover(); togglePopover() returns true if now open
menu.addEventListener("beforetoggle", (e) => console.log(e.oldState, "→", e.newState));   // → closed → open
menu.addEventListener("toggle", (e) => { if (e.newState === "open") loadRecentItems(); });
```

`beforetoggle` can be cancelled when opening. CSS selects an open popover with `:popover-open`.

### What a popover does and doesn't do

- **Not modal.** The page stays interactive, nothing becomes inert, and focus isn't trapped.
- **Focus.** Opening doesn't move focus (unless an element inside has `autofocus`), but the next Tab from the invoking button goes into the popover, as if it followed the button in the DOM. When an open popover is light-dismissed while focus is inside it, focus returns to the invoker.
- **Semantics.** The browser exposes `aria-expanded` on the invoking button and links it to the popover. The popover itself has **no role**: a list of links needs none, a real application menu gets `role="menu"` plus arrow-key handling, and `<dialog popover>` gives you a non-modal, light-dismissable dialog.
- **Hover tooltips.** `hint` still needs JavaScript to open on hover and focus. The declarative `interestfor` attribute (interest invokers) is Chromium-only so far. Tooltips must meet WCAG 1.4.13 (Content on Hover or Focus): dismissable with Esc, hoverable without vanishing, and persistent until dismissed.

### Popover or dialog?

| | `<dialog>` + `showModal()` | `<dialog>` + `show()` | `[popover]` |
|---|---|---|---|
| Top layer | Yes | No | Yes |
| Rest of page | Inert | Interactive | Interactive |
| Light dismiss | Opt-in with `closedby="any"` | Opt-in with `closedby` | Built in (`auto`, `hint`) |
| Esc closes | Yes | Opt-in | Yes (`auto`, `hint`) |
| Role | `dialog` | `dialog` | None unless you add one |
| Typical use | Confirm, sign-in, blocking forms | Side panels, chat | Menus, dropdowns, tooltips, toasts |

Rule of thumb: if the user must deal with it before doing anything else, it is a modal dialog; if clicking elsewhere should simply close it, it is a popover.

### Placing a popover next to its button: anchor positioning

By default an open popover is centred in the viewport. **CSS anchor positioning** tethers it to another element:

```css
#account-btn {
  anchor-name: --account;
}

@supports (anchor-name: --a) {
  #account-menu {
    position-anchor: --account;
    inset: auto;                       /* undo the default centring */
    margin: 0.25rem 0 0;
    top: anchor(bottom);
    left: anchor(left);
    position-try-fallbacks: flip-block; /* open upwards when there is no room below */
  }
}
```

A popover opened through `popovertarget`, `commandfor` or `showPopover({ source: button })` is also **implicitly anchored** to that button in current browsers, so `position-anchor` can be left out. `position-area: bottom span-right` is a shorter way to say "below, aligned to the left edge". Anchor positioning reached the last engine (Firefox 147) in January 2026, so keep the `@supports` guard and, if you support older browsers, a JavaScript fallback such as Floating UI.

## `inert`

The boolean `inert` attribute switches off a whole subtree while leaving it visible: its elements can't be focused or clicked, text can't be selected, find-in-page skips it (Chromium and Firefox), and it is removed from the accessibility tree. A modal `<dialog>` uses the same mechanism on the rest of the page.

| | Visible | Focusable / clickable | Exposed to screen readers |
|---|---|---|---|
| `hidden` / `display: none` | No | No | No |
| `aria-hidden="true"` | Yes | **Yes** (a common bug) | No |
| `inert` | Yes | No | No |
| `disabled` (form controls only) | Yes, greyed | No | Yes, as unavailable |

```js
// off-canvas menu: closed links must not be tabbable, even while they slide out
nav.inert = !open;
main.inert = open;          // optional: make the page behind a full-screen menu unreachable
```

Typical uses: the page behind a custom modal or drawer (the robust replacement for a JavaScript focus trap), closed off-canvas menus, carousel slides that are off screen, and a form section that is waiting for data. Browsers don't style inert content, so add a visual cue where users need one (`[inert] { opacity: 0.6; }`). Never put `inert` on an ancestor of the thing that must stay usable: everything inside an inert element is inert.

## Web Components

Web Components are a set of platform standards for defining your own elements:

- **Custom elements**: a JavaScript class registered under a tag name.
- **Shadow DOM**: an encapsulated DOM tree and style scope attached to an element.
- **`<template>` and `<slot>`**: inert markup to clone, and placeholders that show the element's children inside its shadow tree.

They load like any other script (usually as ES modules) and work in plain HTML or inside React, Vue, Angular or Svelte, because to a framework they are just elements.

### Custom elements and their lifecycle

```js
class UserGreeting extends HTMLElement {
  static observedAttributes = ["name"];          // attributes that trigger attributeChangedCallback

  constructor() {
    super();                                       // always first
    this.attachShadow({ mode: "open" });           // allowed here; reading attributes or adding children is not
  }
  connectedCallback() { this.render(); }           // inserted into a document
  disconnectedCallback() { /* remove window/document listeners, stop timers */ }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.render();
  }
  render() {
    this.shadowRoot.textContent = `Hello, ${this.getAttribute("name") ?? "guest"}!`;
  }
}
customElements.define("user-greeting", UserGreeting);
// <user-greeting name="Asha"></user-greeting>  → renders "Hello, Asha!"
```

| Callback | Runs when | Use it for |
|---|---|---|
| `constructor()` | The element is created or upgraded | `super()`, `attachShadow()`, internal state. Don't read attributes or children (they may not exist yet) and don't add attributes or children to the host |
| `connectedCallback()` | Each time it is inserted into a document | Rendering, listeners on `window`/`document`, fetching. Can run more than once, so make it idempotent |
| `disconnectedCallback()` | Each time it is removed | Undo everything `connectedCallback` set up |
| `attributeChangedCallback(name, old, new)` | An observed attribute is added, changed or removed, including initial values (before `connectedCallback`) | Syncing attributes to internal state |
| `adoptedCallback()` | Moved into another document (an iframe's) | Rare |
| `connectedMoveCallback()` | Moved with the state-preserving `moveBefore()` | Chrome 133+ and Firefox 144+ only; if defined, it runs instead of disconnect + connect |

- **Names** must be lowercase, contain a hyphen and start with a letter (`user-greeting`, not `usergreeting`), which guarantees they never clash with future HTML elements. Defining the same name twice throws.
- **Upgrades:** tags parsed before `define()` runs are plain `HTMLElement`s until the definition arrives. Hide or size them with `user-greeting:not(:defined) { ... }` to avoid a flash, and wait with `await customElements.whenDefined("user-greeting")`.
- **Attributes vs properties:** attributes are strings in HTML; properties can hold any JavaScript value. Reflect simple state (`open`, `disabled`, `variant`) to attributes so CSS can select it, and accept rich data (arrays, objects) as properties.
- **Custom states:** `this.attachInternals().states.add("checked")` lets page CSS write `my-toggle:state(checked)` without exposing a fake attribute (all major browsers since 2024).

### Autonomous vs customized built-in elements

| | Autonomous | Customized built-in |
|---|---|---|
| Definition | `class extends HTMLElement`, `define("fancy-button", C)` | `class extends HTMLButtonElement`, `define("fancy-button", C, { extends: "button" })` |
| Markup | `<fancy-button>` | `<button is="fancy-button">` |
| Built-in semantics and behaviour | None: you add role, focus, keyboard and form behaviour | Inherited: it **is** a button |
| Support | All browsers | Chrome and Firefox; Safari has declined to implement it, so a polyfill is needed |

Customized built-ins would be ideal for accessibility, but because Safari won't ship them, the portable pattern is an **autonomous element that renders a native control inside** (a real `<button>` or `<input>` in its shadow tree), plus `ElementInternals` for roles and form participation.

### Shadow DOM

`attachShadow()` gives an element its own DOM tree (the **shadow tree**) whose contents are rendered instead of the element's children (unless slots bring them in).

- **Encapsulation:** page selectors don't match inside the shadow tree, styles inside don't leak out, IDs are scoped, and `document.querySelector()` doesn't find shadow content.
- **`mode: "open"` vs `"closed"`:** open exposes `element.shadowRoot`; closed returns `null`. Closed is **not** a security boundary (any script can patch `attachShadow`) and makes testing and tooling harder. Use open, as Lit and most libraries do.
- **`delegatesFocus: true`:** focusing or clicking the host focuses the first focusable element inside, and the host matches `:focus`.
- **Shared styles:** instead of a `<style>` per instance, create one `CSSStyleSheet`, call `replaceSync(css)`, and assign it to each root's `adoptedStyleSheets` (all major browsers since 2023).

| Crosses into the shadow tree | Does not cross |
|---|---|
| Inherited properties: `color`, `font`, `line-height` | Ordinary page selectors (`.card button`) |
| CSS custom properties (`--brand-colour`) | `id` references: `<label for>`, `aria-labelledby`, `aria-describedby` |
| `::part()` rules for parts the component exposes | The original event target (events are retargeted to the host) |
| Slotted light-DOM content, styled by the page | Custom events created without `composed: true` |

- **Events:** built-in UI events (`click`, `input`, `keydown`) are `composed`, so they cross the boundary, but listeners outside see `event.target` as the host; `event.composedPath()` shows the real path for open roots. A custom event needs `{ bubbles: true, composed: true }` to reach a listener on `document` (see [Events and delegation](../../03-javascript/24-events-and-delegation/notes.md)).
- **Accessibility caveat:** because ID references can't cross the boundary, a `<label for>` in the page can't label an `<input>` inside a component, and `aria-labelledby` can't point into or out of a shadow root. Keep the label and the control in the same tree, or make the host a form-associated element so `<label>` labels the host. The **Reference Target** proposal forwards ID references to an element inside the shadow root; it shipped in Chrome 152 and is behind flags in Firefox and Safari.

### Templates and slots

```html
<template id="info-card-template">
  <style>
    :host { display: block; border: 1px solid #ccc; border-radius: 8px; padding: 1rem; }
    :host([variant="warning"]) { border-color: #b3261e; }
    ::slotted(h2) { margin-top: 0; }
  </style>
  <slot name="title"><h2>Untitled</h2></slot>   <!-- fallback content if nothing is slotted -->
  <slot></slot>                                  <!-- default slot: every child without slot="..." -->
</template>
<info-card variant="warning">
  <h2 slot="title">Shipping delays</h2>
  <p>Orders placed this week may arrive two days late.</p>
</info-card>
```

```js
customElements.define("info-card", class extends HTMLElement {
  constructor() {
    super();
    const template = document.getElementById("info-card-template");
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
  }
});
```

- Slotted nodes **stay in the light DOM**: page CSS styles them, `document.querySelector()` finds them, and they are only *rendered* at the slot's position.
- `::slotted()` matches only the top-level slotted elements (not their descendants), and page styles beat `::slotted()` rules for the same property.
- `:host` styles the element itself from inside; `:host([variant="warning"])` reacts to the host's attributes. `:host-context()` is Chromium-only; avoid it.
- A `slotchange` event fires when the slotted content changes; `slot.assignedElements()` lists it.

### Styling hooks: custom properties and `::part`

A component chooses what the page may customise. Inside its shadow tree, the demo's `<like-counter>` renders `<button part="button">` styled with `color: var(--like-colour, crimson)` (a themeable value with a default). The page then writes:

```css
like-counter { --like-colour: #0b57d0; }           /* custom properties inherit through the boundary */
like-counter::part(button) { border-radius: 4px; } /* any property on the exposed element */
like-counter::part(button):hover { ... }           /* ✅ pseudo-classes allowed */
like-counter::part(button) span { ... }            /* ❌ can't select descendants of a part */
```

Custom properties are the **design-token** channel (colours, spacing, radii) and work for any depth of nesting; `::part()` exposes specific elements for structural overrides. Nested components forward their parts with `exportparts`. Expose few parts: every part is public API you must keep stable. Custom properties themselves are covered in [CSS variables](../../02-css/16-custom-properties/notes.md).

### Declarative shadow DOM

A shadow root can be written in HTML, so a server can render a component's shadow tree and the browser shows it **before any JavaScript loads**:

```html
<user-greeting name="Asha">
  <template shadowrootmode="open"><style>:host { font-weight: 600; }</style>Hello, Asha!</template>
</user-greeting>
```

The HTML parser turns the `<template shadowrootmode>` into a real shadow root (all major browsers since 2024). When the component's script loads later, it **hydrates** instead of re-rendering: in the constructor, `if (!this.shadowRoot) this.attachShadow({ mode: "open" });` builds a root only when the server didn't send one (`this.attachInternals().shadowRoot` also reaches a closed declarative root).

Only the HTML parser processes `shadowrootmode`. Setting `innerHTML` creates an ordinary `<template>` instead; use `element.setHTMLUnsafe()` or `Document.parseHTMLUnsafe()` to parse declarative shadow roots from a string.

### Form-associated custom elements

By default a custom element is invisible to forms. Opting in makes it behave like a native control:

```js
class RatingInput extends HTMLElement {
  static formAssociated = true;
  #internals = this.attachInternals();
  #value = 0;
  get value() { return this.#value; }
  set value(v) {
    this.#value = Number(v);
    this.#internals.setFormValue(String(this.#value));       // submitted under the element's name
    if (this.#value === 0) this.#internals.setValidity({ valueMissing: true }, "Choose a rating");
    else this.#internals.setValidity({});
  }
  get form() { return this.#internals.form; }
  formResetCallback() { this.value = 0; }                    // <form>.reset()
  formDisabledCallback(disabled) { /* a parent <fieldset disabled> changed */ }
}
customElements.define("rating-input", RatingInput);
```

With `formAssociated` the element gets: its value in `FormData` and submissions, constraint validation (`:invalid`, `reportValidity()`, blocking submit), the `disabled` attribute and `<fieldset disabled>`, `form.elements` membership, `<label>` association, and `formStateRestoreCallback` for back/forward navigation and autofill. `ElementInternals` also sets default ARIA semantics (`internals.role = "slider"`, `internals.ariaValueNow`) without sprinkling attributes on the host; page authors can still override them with real attributes.

### One registry per page, and scoped registries

`customElements` is a single global registry, so two micro-frontends that bundle different versions of `<ui-button>` collide: the second `define()` throws. **Scoped custom element registries** (`new CustomElementRegistry()`, attached to a shadow root) let each part of the page register its own definitions. They reached the last engine, Firefox 159, in October 2026, so check your browser matrix before relying on them; until then, prefix tag names per package or version.

### When to use Web Components instead of framework components

| Good fit | Poor fit |
|---|---|
| A design system used by teams on different frameworks (Adobe's Spectrum Web Components, Salesforce's Lightning Web Components, Microsoft's Fluent UI web components) | Application state, routing and data fetching: frameworks do this; components don't |
| Embeddable third-party widgets that must not be broken by the host page's CSS | Apps that depend heavily on SSR and streaming, where framework tooling is more mature than declarative shadow DOM tooling |
| Leaf UI components with a long life, insulated from framework churn | Components that need many ID-based ARIA links across shadow boundaries (until Reference Target is everywhere) |
| Progressively enhancing server-rendered HTML ("HTML web components" that wrap existing markup, often without Shadow DOM) | A single-framework app where the framework's own components are simpler to build and test |

Libraries remove most of the boilerplate: **Lit** (reactive properties and templates, about 5 KB) and **Stencil** (a compiler) are the common choices. Framework interop is good: Vue, Angular and Svelte have handled custom elements well for years, and **React 19** added full support (it sets properties when the element has them and listens to custom events), where React 18 and earlier passed everything as string attributes and needed wrappers.

## Common Mistakes

- **Opening a dialog by setting the `open` attribute** instead of calling `showModal()`: no top layer, no inert background, no Esc, and no `close` event when the attribute is removed.
- **`dialog { display: flex; }`**, which overrides the browser's hidden state so the closed dialog stays visible. Style `dialog[open]` instead.
- **Not resetting `returnValue`** before reopening a dialog, so closing with Esc reports the previous choice.
- **A Cancel button in a `method="dialog"` form with required fields** and no `formnovalidate`: validation blocks it from closing.
- **Assuming popovers are modal or trap focus.** They don't; use `showModal()` when the user must respond first.
- **Relying on `closedby`, `popover="hint"` or anchor positioning without a fallback** while Safari or older browsers in your support matrix lack them.
- **`aria-hidden="true"` where `inert` was needed**: the content is hidden from screen readers but still focusable and clickable.
- **Reading attributes or adding children in a custom element's constructor**; do it in `connectedCallback` or `attributeChangedCallback`.
- **Forgetting cleanup in `disconnectedCallback`**: listeners on `window` or `document` keep the removed element alive.
- **Custom events that never reach the page** because they lack `composed: true` (and `bubbles: true`), and `<label for>` or `aria-labelledby` pointing across a shadow boundary.

## Key Takeaways

- Native interactive elements give you keyboard support, focus handling, Esc and semantics for free: use `<details>` for disclosure, `<dialog>` for dialogs, `popover` for things that close when you click elsewhere, `inert` to switch regions off.
- The top layer renders modal dialogs, popovers and fullscreen elements above everything, with no `z-index` and no clipping by ancestors.
- `showModal()` = top layer + backdrop + inert page + Esc + focus moved in and restored; `show()` = non-modal. `<form method="dialog">` closes it and sets `returnValue`.
- Popovers are non-modal: `auto` light-dismisses and closes other `auto` popovers, `manual` stays open, `hint` is for tooltips. Position them with CSS anchor positioning behind `@supports`.
- Newer pieces need checking against your browser matrix: `closedby` and `hint` are not in stable Safari yet; invoker commands and anchor positioning only became universal in late 2025 and January 2026.
- Custom elements have a lifecycle (`constructor`, `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`); keep the constructor light and clean up on disconnect. Use autonomous elements, because Safari won't ship customized built-ins.
- Shadow DOM encapsulates markup and styles; inherited properties, custom properties, `::part()` and slotted content are the deliberate ways in, while ID references and non-composed events don't cross.
- Declarative shadow DOM enables server rendering; `formAssociated` + `ElementInternals` makes custom controls real form controls. Choose Web Components for cross-framework design systems and widgets, frameworks for applications.

## Interview Questions

### Junior (0–1 year)

**Q1. What do `<details>` and `<summary>` do, and how do you make the content visible by default?**
They create a native disclosure widget: the `<summary>` text is always visible, and clicking it (or pressing Enter or Space when it is focused) shows or hides the rest of the `<details>` content, with no JavaScript. Screen readers announce it as expanded or collapsed. Adding the boolean `open` attribute (`<details open>`) shows it expanded initially, and the browser toggles that attribute as the user opens and closes it.

**Q2. What is the difference between `dialog.show()` and `dialog.showModal()`?**
`show()` opens a non-modal dialog in the normal page: the rest of the page stays usable, there is no backdrop, and Esc doesn't close it by default. `showModal()` opens it in the top layer above everything, adds a `::backdrop`, makes the rest of the page inert (not clickable, focusable or readable by screen readers), closes it on Esc and moves focus into it. Use `showModal()` for anything the user must answer before continuing.

**Q3. How do you make a menu that opens on a button click and closes when you click elsewhere, without JavaScript?**
Give the menu the `popover` attribute and an `id`, and point a button at it with `popovertarget`: `<button popovertarget="menu">Menu</button>` and `<div id="menu" popover>...</div>`. The default `auto` popover opens in the top layer and light-dismisses: a click outside or Esc closes it. Adding `popovertargetaction="hide"` to a button inside gives it a close button.

**Q4. What does the `inert` attribute do, and how is it different from `aria-hidden="true"`?**
`inert` makes an element and everything inside it non-interactive: it can't be focused, clicked or selected, and it is removed from the accessibility tree, while staying visible. `aria-hidden="true"` only removes content from the accessibility tree; it stays focusable and clickable, so keyboard users can land on elements that screen readers then announce as nothing. Use `inert` for content behind a modal or a closed off-canvas menu.

**Q5. What is a custom element, and what are the rules for its name?**
A custom element is an HTML element you define yourself by writing a class that extends `HTMLElement` and registering it with `customElements.define("user-greeting", UserGreeting)`. The name must be lowercase, start with a letter and contain a hyphen, which guarantees it can never clash with a future built-in HTML element. Once defined, `<user-greeting>` works in HTML like any other tag.

**Q6. What is the Shadow DOM, and why would you use it?**
It is a separate, encapsulated DOM tree attached to an element with `attachShadow()`. Styles inside it don't leak out, page selectors don't reach in, and IDs inside don't clash with the page. Components use it so their internal markup and CSS can't be broken by the page they are dropped into, and so they can't break the page either. Inherited properties like `color` and font, and CSS custom properties, still flow in, which is how components are themed.

### Mid-level (2–4 years)

**Q7. When would you build an FAQ accordion with `<details>`/`<summary>` instead of custom JavaScript, and when not?**
Almost always for simple show/hide content: `<details>` is keyboard-accessible, announced correctly, works before JavaScript loads, opens automatically for find-in-page, and a shared `name` attribute makes it exclusive in all current browsers. Choose a `<button aria-expanded aria-controls>` built in JavaScript when the questions must stay real headings for screen-reader heading navigation, when the open state is owned by framework state, or when you need behaviour `<details>` can't give (a cross-browser height animation, analytics hooks around a controlled state). Then you own `aria-expanded`, `hidden` and keyboard handling yourself.

**Q8. What is the top layer, and why does it fix "my modal is under the header" and "my dropdown is clipped" bugs?**
The top layer is a browser-managed layer rendered above the entire document. Modal dialogs, popovers and fullscreen elements are placed there, so they ignore every `z-index` and stacking context on the page and are not clipped or positioned by ancestors with `overflow: hidden`, `transform` or `filter`. The bugs come from a modal or dropdown being trapped inside a parent's stacking context or clipping box; moving it to the top layer removes the parent from the equation entirely, without portals or `z-index: 9999`. Among top-layer elements, the last one opened is on top.

**Q9. How do you get a result out of a confirmation dialog without writing click handlers for each button?**
Put the buttons in a `<form method="dialog">` and give each a `value`. Submitting the form closes the dialog and sets `dialog.returnValue` to the submitter's value; read it in the dialog's `close` event. Two gotchas: closing with Esc doesn't set `returnValue`, so reset it to `""` before each `showModal()` or you will read the previous answer; and constraint validation still runs, so a Cancel button in a form with required fields needs `formnovalidate`. Invoker commands (`commandfor` + `command="show-modal"`) can open it without script too.

**Q10. Popover or `<dialog>`: how do you decide, and can you combine them?**
Ask whether the user must deal with it before continuing. If yes (delete confirmation, session timeout, a blocking form), use `<dialog>` with `showModal()`: inert background, focus moved in, dialog role. If clicking elsewhere should simply close it (menus, pickers, tooltips, toasts), use a popover: top layer and light dismiss, but the page stays interactive and the popover has no role by default. They combine: `<dialog popover>` is a non-modal dialog with dialog semantics and light dismiss, useful for things like a share sheet. Use `manual` popovers for toasts so opening a menu doesn't close them.

**Q11. Walk through a custom element's lifecycle. Where do you set things up and clean them up, and why not in the constructor?**
The constructor runs when the element is created or upgraded; call `super()` first and do only internal setup such as `attachShadow()`, because attributes and children may not be parsed yet and the spec forbids adding attributes or children to the host there. `attributeChangedCallback` runs for each observed attribute, including initial values. `connectedCallback` runs every time it is inserted, so render there and add listeners on `window`, `document` or other long-lived objects, and make it idempotent since moving an element disconnects and reconnects it. `disconnectedCallback` must undo those listeners, timers and observers, or the detached element leaks. Chromium and Firefox add `connectedMoveCallback` for state-preserving `moveBefore()` moves.

**Q12. How can a page style the inside of a web component that uses Shadow DOM?**
Only through the doors the component opens. Inherited properties (`color`, `font-family`) flow in naturally. CSS custom properties cross the boundary, so the component reads `var(--like-colour, crimson)` and the page sets `--like-colour`; this is the theming channel. Elements marked `part="button"` can be styled with `like-counter::part(button)`, including pseudo-classes, but not their descendants. Slotted content stays in the light DOM, so normal page CSS styles it. Ordinary selectors such as `like-counter button` don't match anything inside the shadow tree.

**Q13. A web component dispatches `new CustomEvent("like-change")` from inside its shadow root, but a listener on `document` never fires. Why?**
Custom events are created with `bubbles: false` and `composed: false` by default, so the event neither bubbles nor crosses the shadow boundary. Dispatch it with `{ bubbles: true, composed: true, detail }`, or dispatch it from the host element (`this.dispatchEvent(...)`) with `bubbles: true`, which keeps it out of the shadow tree entirely. Remember retargeting too: outside listeners see `event.target` as the host element, not the internal button; `event.composedPath()` shows the full path for open roots.

### Senior (5+ years)

**Q14. Should your company's new design system be built as Web Components or as React components?**
Start from who consumes it. If several teams ship on different frameworks (React, Angular, server-rendered pages, a legacy jQuery app), or the components must outlive today's framework, Web Components (usually with Lit) give one implementation that works everywhere: React 19, Vue and Angular all handle custom elements well now. The costs are real: SSR needs declarative shadow DOM and framework-specific integration, ID-based ARIA across shadow boundaries is awkward until Reference Target ships everywhere, form controls need `ElementInternals`, and teams lose some framework ergonomics (typed props, composition patterns) unless you generate wrappers.

If the whole organisation is on one framework and server rendering matters, framework components are simpler to build, test and render on the server. A common middle path is to build leaf primitives (button, icon, form controls, tooltip) as Web Components and composite, data-aware patterns as framework components, with design tokens as CSS custom properties shared by both. Recommendation: Web Components when you have more than one framework to serve or a long horizon; otherwise framework components plus shared tokens, and revisit when the framework mix changes.

**Q15. A team wants to ship `<acme-select>` as a web component with a fully custom dropdown. What accessibility and form problems do you flag, and what would you recommend?**
A custom select is one of the hardest widgets to get right: it needs the combobox or listbox pattern with `aria-activedescendant` or a roving tabindex, type-ahead, Home/End, Esc, scrolling the active option into view, and announcements that work in NVDA, JAWS, VoiceOver and TalkBack. Shadow DOM adds problems: an external `<label for>` can't target the inner control, `aria-controls`/`aria-activedescendant` must stay inside one tree, and without `formAssociated` + `ElementInternals` the value isn't submitted, validated, reset or disabled with its fieldset. Mobile users also lose the native picker.

Recommendation: wrap a native `<select>` inside the component and style it, using the customisable select (`appearance: base-select`, Chrome 135+ and Safari 27; Firefox only behind a flag so far) as a progressive enhancement, so unsupported browsers still get a working native control. If a truly custom listbox is unavoidable, make it form-associated with `delegatesFocus`, keep every ARIA relationship inside the shadow root, follow the APG pattern exactly, and test the full screen-reader matrix before release.

**Q16. You inherit an app with three modal libraries, `z-index` values up to 99999, a hand-written focus trap and a body-scroll-lock package. How would you migrate to native `<dialog>` and popovers?**
Write the target first: one `Modal` component on `<dialog>` + `showModal()` (top layer, inert background, Esc, focus in and back), one `Popover`/`Menu` on the `popover` attribute with anchor positioning, and scroll lock as `html:has(dialog:modal) { overflow: hidden }`. Check the support matrix: `<dialog>` and popovers are safe; `closedby`, `hint`, invoker commands and anchor positioning need `@supports` or feature checks with small fallbacks (a backdrop-click handler, Floating UI).

Migrate behind the existing component APIs so call sites don't change, then move screens over gradually, starting with the most-used modal. Watch for behaviour changes that tests and users notice: focus now returns automatically (remove manual restore code that fights it), Esc fires `cancel`, nested modals stack by opening order instead of `z-index`, and third-party widgets that relied on being above everything may now sit below the top layer. Add end-to-end tests for open, Esc, focus return and background inertness, run a screen-reader pass on the main flows, then delete the old libraries and the `z-index` scale above about 10. Recommendation: one wrapper component per pattern, rolled out screen by screen with feature-detected fallbacks, and the old libraries removed only when usage reaches zero.

## References

- [MDN: `<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details)
- [MDN: `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)
- [MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- [MDN: Invoker Commands API](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
- [MDN: Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)
- [MDN: CSS anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning)
- [MDN: inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)
- [MDN: Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
- [MDN: Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)
- [MDN: Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [MDN: Using templates and slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots)
- [MDN: ElementInternals](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)
- [WHATWG HTML: Interactive elements](https://html.spec.whatwg.org/multipage/interactive-elements.html)
- [WHATWG HTML: Custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html)
- [web.dev: Declarative Shadow DOM](https://web.dev/articles/declarative-shadow-dom)
- [web.dev: More capable form controls](https://web.dev/articles/more-capable-form-controls)
- [W3C WAI-ARIA APG: Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Lit](https://lit.dev/)
