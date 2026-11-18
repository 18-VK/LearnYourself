# Web Accessibility (a11y)

> HTML · Topic 11 · Demo: [index.html](index.html) · Open index.html in a browser, press Tab from the address bar, then submit the empty form.

Accessibility ("a11y": 11 letters between the *a* and the *y*) means people can perceive, understand, navigate and operate a site whatever their abilities and whatever device they use: a keyboard instead of a mouse, a screen reader instead of a screen, 400% zoom, voice control, a switch device. It exists because the web is the default channel for shopping, banking, jobs and government, and because it is now a legal requirement in many markets. This note gives the mental model (the accessibility tree), the WCAG 2.2 structure that contracts refer to, the techniques interviews probe (accessible names, keyboard and focus management, live regions, forms, contrast, target size), how to test, and how to keep a team from regressing. Topics already covered in other notes are linked rather than repeated.

## Why It Matters

- **Users.** The WHO estimates about 1.3 billion people, roughly 1 in 6, live with a significant disability. Add temporary and situational limits (a broken wrist, glare on a phone, a baby on one arm, a slow connection) and ageing eyesight, and accessible design is simply better design for everyone.
- **The state of the web.** WebAIM's yearly scan of the top million home pages keeps finding automatically detectable WCAG failures on around 95% of them. The same few issues dominate: low-contrast text, missing `alt` text, unlabelled form fields, empty links and buttons, and a missing `lang` attribute.
- **Engineering side effects.** Accessible markup is also what tests use: Testing Library's `getByRole("button", { name: "Save" })` and Playwright's `getByRole` query the accessibility tree. If a test can't find your control by role and name, a screen reader can't either.
- **Law and contracts.**

| Region | Law or policy | What it means for front-end work |
|---|---|---|
| EU (private sector) | European Accessibility Act, Directive (EU) 2019/882, applies from **28 June 2025** | Covers many products and services sold to EU consumers, including e-commerce, consumer banking, e-books, passenger transport services and electronic communications, plus devices such as computers and phones. Micro-enterprises providing services are exempt. Conformity is shown against the harmonised standard EN 301 549, whose web requirements are the WCAG Level A and AA criteria. Member states enforce it and set the penalties. |
| EU (public sector) | Web Accessibility Directive (EU) 2016/2102 | Public-sector sites and apps must conform and publish an accessibility statement. |
| US | Americans with Disabilities Act (ADA) Title III | The law has no technical web standard for private businesses, but courts treat inaccessible sites as discrimination, and WCAG AA is the yardstick in settlements. Several thousand web-accessibility lawsuits are filed every year. |
| US (government) | Section 508; a 2024 Department of Justice rule under ADA Title II | Federal ICT follows WCAG 2.0 AA; the 2024 rule names WCAG 2.1 AA for state and local government web content and apps. |
| UK | Equality Act 2010; Public Sector Bodies Accessibility Regulations 2018 | Public-sector sites are monitored against WCAG 2.2 AA and need an accessibility statement. |
| India | Rights of Persons with Disabilities Act 2016 | Requires accessible information and communication technology; government sites follow national web guidelines based on WCAG. |

> **Note:** This table is orientation, not legal advice. In practice the requirement you meet in a contract or tender is "WCAG 2.1 AA" or "WCAG 2.2 AA", often with an **Accessibility Conformance Report (ACR)** filled in on the VPAT template, stating for each criterion whether the product supports, partially supports or does not support it.

## WCAG 2.2 in One Page

The Web Content Accessibility Guidelines are published by the W3C. WCAG 2.2 became a W3C Recommendation in October 2023. The structure is: **4 principles → 13 guidelines → testable success criteria**, each at level A, AA or AAA.

| Principle (POUR) | Question it asks | Typical success criteria |
|---|---|---|
| **Perceivable** | Can users take the content in? | 1.1.1 Non-text Content (alt text), 1.3.1 Info and Relationships (real headings, lists, labels), 1.4.3 Contrast, 1.4.10 Reflow |
| **Operable** | Can users work the UI? | 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.3 Focus Order, 2.4.7 Focus Visible, 2.5.8 Target Size |
| **Understandable** | Can users understand content and behaviour? | 3.1.1 Language of Page, 3.2.2 On Input (no surprise context changes), 3.3.1 Error Identification |
| **Robust** | Does it work with assistive technology? | 4.1.2 Name, Role, Value, 4.1.3 Status Messages |

- **Level A** is the minimum; failing it blocks some users completely (no keyboard access, no alt text).
- **Level AA** = every A criterion **plus** every AA criterion. "Conforms to WCAG 2.2 AA" is what laws, procurement and contracts mean by "accessible".
- **Level AAA** is aspirational. W3C itself does not recommend AAA as a blanket policy, because some content cannot meet every AAA criterion. Teams adopt individual AAA criteria where cheap (for example 2.5.5's 44px targets).
- Conformance is claimed for **whole pages and complete processes**: a checkout is not accessible if one step is not.
- WCAG 2.2 builds on 2.1, which builds on 2.0, so meeting 2.2 AA also meets 2.1 AA (2.2 only removed 4.1.1 Parsing, which modern browsers made obsolete).
- WCAG 3 is still a working draft with a different scoring model. Do not use it for conformance claims yet.

What 2.2 added (the questions interviewers like):

| Criterion | Level | In practice |
|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | A sticky header, cookie banner or chat widget must not completely cover the focused element |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Not even partly covered |
| 2.4.13 Focus Appearance | AAA | Focus indicator of a minimum size and contrast |
| 2.5.7 Dragging Movements | AA | Anything done by dragging (sortable lists, sliders, maps) also works with single clicks or taps |
| 2.5.8 Target Size (Minimum) | AA | Pointer targets at least 24×24 CSS px, or spaced so they don't crowd each other |
| 3.2.6 Consistent Help | A | Help links or contact details appear in the same place across pages |
| 3.3.7 Redundant Entry | A | Don't make users re-type information they already gave in the same process |
| 3.3.8 Accessible Authentication (Minimum) | AA | No memory or puzzle tests to log in unless there is an alternative; allow paste and password managers |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Stricter version of 3.3.8 |

## Semantic HTML First, ARIA Second

The browser turns the DOM into an **accessibility tree**, which assistive technology reads through the operating system's accessibility API. Each node exposes a **role** (button, link, heading), a **name** ("Save"), **states** (expanded, checked, disabled) and sometimes a **value** and a **description**. You can inspect it in the Accessibility pane of Chrome, Edge or Firefox DevTools.

Native elements fill in that tree **and** bring the behaviour:

| Element | Role exposed | What you get for free |
|---|---|---|
| `<button>` | button | Focusable, Enter and Space activate it, `disabled` works, submits forms by default |
| `<a href>` | link | Focusable, Enter follows it, appears in the screen reader's links list, middle-click and "open in new tab" |
| `<input type="checkbox">` + `<label>` | checkbox | Space toggles, checked state announced, clicking the label toggles it |
| `<h1>`–`<h6>` | heading (level 1–6) | Screen-reader users jump between headings, the most common way they skim a page |
| `<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>` | landmarks | Jump-to-region navigation (see [Semantic HTML](../06-semantic-html/notes.md)) |
| `<dialog>` with `showModal()` | dialog | Focus moved in, background inert, Esc closes (see [Interactive elements](../12-interactive-elements-and-web-components/notes.md)) |

**ARIA** (Accessible Rich Internet Applications) is a set of attributes that change **only** the accessibility tree: role, name, state and relationships. It adds no focusability, no keyboard handling and no styling. The W3C's *Using ARIA* document gives five rules:

1. **If a native HTML element or attribute already has the semantics and behaviour you need, use it** instead of re-purposing another element and adding ARIA. (This is the famous "first rule of ARIA".)
2. Don't change native semantics unless you really have to (`<h2 role="tab">` breaks the heading).
3. All interactive ARIA controls must be usable with the keyboard.
4. Don't use `role="presentation"` or `aria-hidden="true"` on a focusable element.
5. All interactive elements must have an accessible name.

```html
<!-- ❌ looks like a button, is announced as text, unreachable with Tab -->
<div class="btn" onclick="save()">Save</div>

<!-- ❌ announced as a button, but still no Tab stop and no Enter/Space -->
<div class="btn" role="button" onclick="save()">Save</div>

<!-- ✅ everything for free -->
<button type="button" class="btn">Save</button>
```

"No ARIA is better than bad ARIA": WebAIM's scans consistently find **more** errors on pages that use ARIA than on pages that don't, because ARIA is often added as decoration (`role="menu"` on a site's navigation, which tells screen readers to expect application-style arrow-key menus that aren't there).

## Roles, States and Properties

| Kind | Examples | Changes over time? |
|---|---|---|
| **Roles**: what it is | `button`, `tab`, `tablist`, `tabpanel`, `dialog`, `alert`, `status`, `combobox`, `listbox`, `switch`, `region`, `navigation` | No (set once) |
| **States**: its current condition | `aria-expanded`, `aria-pressed`, `aria-checked`, `aria-selected`, `aria-current`, `aria-disabled`, `aria-invalid`, `aria-busy`, `aria-hidden` | Yes, your JS must update them |
| **Properties**: names and relationships | `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-haspopup`, `aria-live`, `aria-required`, `aria-modal` | Rarely |

Ones worth knowing precisely:

- `aria-expanded` goes on the **control** that opens something (menu button, accordion header), not on the panel. Examples: [FAQ accordion](../../05-projects/02-faq-accordion/notes.md) and [Responsive navbar](../../05-projects/03-responsive-navbar/notes.md).
- `aria-pressed` makes a toggle button ("Bold", "Mute"); don't also change its label, or users hear "Unmute, pressed".
- `aria-current="page"` marks the current link in a nav or breadcrumb.
- `disabled` vs `aria-disabled="true"`: `disabled` removes the button from the Tab order and blocks clicks, so screen-reader users may never discover it. `aria-disabled` keeps it focusable and announced as "dimmed"/"unavailable", and your click handler must ignore it. Use `aria-disabled` when users need to find the control and learn why it is unavailable.
- `aria-hidden="true"` removes an element **and its children** from the accessibility tree but leaves it visible and clickable. Use it for decorative icons, never on something focusable. To hide something from everyone use `hidden`; to make a region unusable use `inert`.

## Accessible Names

Every interactive element needs a name, and the browser computes it in a fixed order (the W3C *Accessible Name and Description Computation*), simplified:

1. **`aria-labelledby`**: text of the referenced element(s); wins over everything, can join several IDs and can point at hidden elements.
2. **`aria-label`**: a string you provide.
3. **Native labelling**: `<label for>` (or a wrapping `<label>`) for form controls, `alt` for images, `<caption>` for tables, `<legend>` for fieldsets, `<figcaption>` for figures, `<title>` for SVG.
4. **Content**: for roles that take their name from content (buttons, links, headings, cells), the text inside.
5. **`title`** (and for inputs, `placeholder`) as a last resort. Neither is reliable: `title` never shows to keyboard or touch users, and `placeholder` disappears while typing.

```html
<!-- name "Delete invoice 42" from content + visually hidden text -->
<button type="button">
  <svg aria-hidden="true" focusable="false"><use href="#icon-trash"></use></svg>
  <span class="visually-hidden">Delete invoice 42</span>
</button>

<!-- name "Close" from aria-label (fine for icon-only buttons) -->
<button type="button" aria-label="Close"><svg aria-hidden="true">...</svg></button>

<!-- name "Shipping address" from another element -->
<h2 id="ship-h">Shipping address</h2>
<section aria-labelledby="ship-h">...</section>
```

The `.visually-hidden` class is in [Display and visibility](../../02-css/06-display-and-visibility/notes.md#hiding-from-some-users-but-not-others).

Rules that catch people out:

- **Prefer visible text.** It is translated by browser translators, it helps voice-control users and sighted users alike, and it can't drift out of sync with the UI. Some automatic translators skip `aria-label`.
- **Label in Name (2.5.3):** if a control has visible text, its accessible name must contain that text, ideally at the start. A button that shows "Buy" but has `aria-label="Purchase item"` can't be activated by a voice-control user saying "click Buy".
- **`aria-label` on a plain `<div>` or `<span>` is not supported**: naming is prohibited for the generic role and screen readers often ignore it. Give the element a proper role or use visible text.
- The **description** (`aria-describedby`) is read after the name and role, usually after a pause: use it for hints and error messages, not for the label.

## Landmarks, Headings and Page Basics

Landmarks let screen-reader users jump straight to a region; [Semantic HTML](../06-semantic-html/notes.md) maps each element to its landmark role. Points that matter for accessibility:

- Exactly one visible `<main>`. All content should sit inside some landmark.
- Several `<nav>` elements need distinct labels: `<nav aria-label="Primary">`, `<nav aria-label="Breadcrumb">`. Don't put the word "navigation" in the label; the role is announced anyway.
- `<search>` (all major browsers since 2023) wraps a search form and exposes the `search` landmark without `role="search"`.
- A `<section>` becomes a `region` landmark only when it has a name (`aria-labelledby`); use that sparingly.
- **Headings:** one `<h1>` describing the page, then `<h2>`/`<h3>` in order without skipping levels. Choose the level by structure and the size with CSS. The "document outline algorithm" (an `<h1>` in every `<section>` adjusting its level automatically) was never implemented and was removed from the HTML spec in 2022.
- `<html lang="en">` (3.1.1) lets screen readers pick the right voice and pronunciation; mark passages in other languages with `lang` too. A unique, descriptive `<title>` per page (2.4.2) is the first thing announced.
- A **skip link** (2.4.1 Bypass Blocks) is the first focusable element and jumps over repeated header and navigation:

```html
<a class="skip-link" href="#main">Skip to main content</a>
...
<main id="main">...</main>
```

```css
.skip-link {
  position: absolute;
  left: 1rem;
  top: -10rem;              /* off screen until focused */
}
.skip-link:focus {
  top: 1rem;                /* slides into view for keyboard users */
}
```

## Keyboard Access

Everything that works with a mouse must work with a keyboard (2.1.1), in an order that makes sense (2.4.3), without traps (2.1.2).

| Key | Expected behaviour |
|---|---|
| Tab / Shift+Tab | Move between interactive elements (links, buttons, fields, widgets) |
| Enter | Activate links and buttons, submit forms |
| Space | Activate buttons, toggle checkboxes, scroll the page otherwise |
| Arrow keys | Move **inside** a composite widget: radio group, tabs, menu, listbox, toolbar, slider, grid |
| Esc | Close dialogs, popovers, menus, tooltips |
| Home / End | First / last item in a widget |

`tabindex` controls focusability:

| Value | Effect | Use |
|---|---|---|
| (none) on native controls | Focusable in DOM order | The default; prefer it |
| `tabindex="0"` | Adds a non-interactive element to the Tab order, in DOM order | Custom widgets built from `<div>`, scrollable regions that must be scrollable by keyboard |
| `tabindex="-1"` | Focusable by script (`el.focus()`), skipped by Tab | Focus targets (headings after route change, error summaries), inactive items in a roving group |
| `tabindex="1"` or more | Jumps ahead of everything else, in numeric order | Avoid: it breaks the natural order for the whole page |

Tab order follows the **DOM**, not the screen. CSS that reorders visually (`order`, `flex-direction: row-reverse`, grid placement) makes focus jump around unpredictably. Fix the source order. The new CSS `reading-flow` property lets focus follow the visual order of a flex or grid container, but only Chromium (Chrome 137+) supports it so far.

### Roving tabindex

In a composite widget, the whole widget is **one Tab stop** and arrow keys move inside it. Only the active item has `tabindex="0"`; the rest have `-1`.

```html
<div role="toolbar" aria-label="Text formatting">
  <button type="button" tabindex="0" aria-pressed="false">Bold</button>
  <button type="button" tabindex="-1" aria-pressed="false">Italic</button>
  <button type="button" tabindex="-1" aria-pressed="false">Underline</button>
</div>
```

```js
const toolbar = document.querySelector('[role="toolbar"]');
const items = [...toolbar.querySelectorAll("button")];

toolbar.addEventListener("keydown", (e) => {
  const current = items.indexOf(document.activeElement);
  const target = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: items.length - 1 }[e.key];
  if (current === -1 || target === undefined) return;
  e.preventDefault();
  const next = (target + items.length) % items.length;   // wrap around
  items[current].tabIndex = -1;
  items[next].tabIndex = 0;                               // Tab returns here next time
  items[next].focus();
});
```

The alternative is `aria-activedescendant`: DOM focus stays on the container (or a combobox input) and the attribute points at the "virtually focused" option's `id`. It suits comboboxes, where typing must stay in the input. The exact keys each widget expects are in the WAI-ARIA Authoring Practices Guide (APG).

## Focus Management

Move focus only when the user's context changes; otherwise leave it alone.

| Situation | Where focus should go |
|---|---|
| A modal opens | Into the dialog (the first field, or the least destructive button) |
| The modal closes | Back to the control that opened it |
| An item in a list is deleted | The next item, or the list's heading if it is now empty |
| A single-page app changes route | The new page's `<h1>` (or main container), and `document.title` is updated |
| A form is submitted with errors | The error summary, or the first invalid field |
| Content loads below (infinite scroll, "load more") | Stay put; announce the change with a live region instead |

```js
// SPA route change: what a full page load would have given you for free
async function onRouteChange(route) {
  await render(route);                          // new content is in the DOM
  document.title = `${route.title} · Shop`;
  const heading = document.querySelector("main h1");
  heading.tabIndex = -1;                        // focusable by script, not by Tab
  heading.focus();
}
```

**Modals.** A modal must keep focus inside itself, close on Esc, and return focus when closed. Native `<dialog>` opened with `showModal()` does all of this (see [Interactive elements](../12-interactive-elements-and-web-components/notes.md)). For a custom modal, the old approach was a JavaScript **focus trap** that catches Tab on the last element and wraps it to the first. The robust modern approach is the **`inert`** attribute on everything outside the modal: inert content can't be focused, clicked or reached by a screen reader's virtual cursor, which a keydown-based trap can't prevent. Structure the DOM so the modal is a sibling of the app root (`<div id="app" inert>` + `<div class="modal">`), because putting `inert` on an ancestor would disable the modal too.

**Seeing focus.** Never remove the focus outline without a replacement (2.4.7). `:focus-visible` (all major browsers since 2022) shows the ring when the browser judges it helpful: always for keyboard focus and text fields, usually not after a mouse click on a button.

```css
:focus-visible {
  outline: 3px solid #0b57d0;
  outline-offset: 2px;
}
html {
  scroll-padding-top: 5rem;   /* keeps focused/target elements clear of a sticky header (2.4.11) */
}
```

Use `outline` rather than `box-shadow` for focus: Windows contrast themes (forced colours mode) remove box shadows, so a shadow-only focus ring disappears for exactly the users who need it most.

## Live Regions

Screen readers announce what has focus. When something changes elsewhere (a toast, "3 results found", "Saved", a form error that appears without a reload), a **live region** announces it without moving focus (4.1.3 Status Messages).

| Markup | Politeness | Use |
|---|---|---|
| `role="status"` (or `aria-live="polite"`) | Waits until the user is idle | Saved, results count, added to cart |
| `role="alert"` (or `aria-live="assertive"`) | Interrupts | Errors that need attention now; use rarely |
| `role="log"` | Polite, new entries only | Chat messages, activity feeds |
| `<output>` | Status by default | Calculator results |

```html
<div id="cart-status" role="status" class="visually-hidden"></div>
```

```js
function announce(message) {
  const region = document.getElementById("cart-status");
  region.textContent = "";                                   // reset so a repeat is announced again
  setTimeout(() => { region.textContent = message; }, 100);
}
announce("Blue T-shirt added to cart. 3 items in cart.");
```

The region must **already exist** in the DOM, empty, before you change its content. Inserting a new element that already contains text is often not announced, because screen readers only watch regions they knew about. Keep messages short, and don't put whole components inside a live region.

> **Note:** `ariaNotify()` (`document.ariaNotify("Saved")`) asks the screen reader to speak a string with no live region at all. It reached Chrome in 2025 and Firefox and Safari in 2026, so it is very new; keep a live region as the default and treat `ariaNotify()` as an enhancement.

## Accessible Forms

Label basics (`<label for>`, `<fieldset>`/`<legend>`, `autocomplete`) are in [HTML forms](../07-forms/notes.md), and validation attributes in [Input types and validation](../08-input-types-and-validation/notes.md). The accessibility layer on top is mostly about **errors**:

```html
<label for="email">Email address</label>
<p id="email-hint" class="hint">We only use it to send your receipt.</p>
<input id="email" name="email" type="email" autocomplete="email"
       aria-describedby="email-hint email-error" aria-invalid="true">
<p id="email-error" class="error">Enter an email address in the format name@example.com</p>
```

- **Identify the error in text** next to the field (3.3.1) and say how to fix it (3.3.3). A red border alone fails 1.4.1 Use of Color.
- **Associate it**: `aria-describedby` points at the hint and the error, so they are read when the field gets focus. `aria-invalid="true"` makes the screen reader say "invalid entry". (`aria-errormessage` exists too, but support has been weaker; `aria-describedby` is the safe choice.)
- **On submit**, show an error summary at the top that lists each problem as a link to its field, and move focus to it. The GOV.UK Design System popularised this pattern, and the demo implements it.
- **Mark required fields in text** ("required" or an asterisk explained at the top). Native `required` is announced, so `aria-required` is only needed on custom widgets.
- **Don't disable the submit button** until the form is valid: users can't find out what is missing. Let them submit and show the errors.
- **Validate on submit or on blur**, not on every keystroke while someone is still typing. CSS `:user-invalid` (all major browsers since 2023) styles a field only after the user has interacted with it.
- Native validation bubbles are announced inconsistently and can't be styled, so many design systems add `novalidate` and render their own messages while still using the Constraint Validation API (`input.validity`).
- Use `autocomplete` tokens (`email`, `given-name`, `street-address`, `one-time-code`): 1.3.5 Identify Input Purpose, and they also satisfy 3.3.7 Redundant Entry. Allow paste in password and code fields (3.3.8).

## Images and Alt Text

How to write `alt` for ordinary images is in [Images, lists and tables](../04-lists-tables-images/notes.md#writing-good-alt-text). The decision table:

| Image | `alt` |
|---|---|
| Informative (photo, illustration that adds meaning) | What it conveys in context, briefly; not "image of" |
| Decorative (flourish, background texture, an icon next to text that says the same) | `alt=""`: screen readers skip it. A **missing** `alt` is different: some screen readers read the file name |
| Functional (the only content of a link or button) | The action or destination: `alt="Search"`, not `alt="magnifying glass"` |
| Complex (chart, diagram) | Short `alt` plus the data or a longer description in nearby text or a table |
| Text in an image | Avoid; if unavoidable, `alt` repeats the text (1.4.5 Images of Text) |

- Inline SVG that carries meaning: `<svg role="img" aria-label="Rating: 4 out of 5">`; decorative SVG: `aria-hidden="true"`.
- CSS `background-image` is invisible to assistive technology. Never put meaningful content there.
- Media: captions for video (1.2.2), a transcript for audio, and no autoplaying sound (1.4.2); see [Media, SVG, canvas and iframe](../09-media-svg-canvas-iframe/notes.md).

## Colour and Contrast

| Requirement | Ratio | Criterion |
|---|---|---|
| Normal text | **4.5:1** | 1.4.3 (AA) |
| Large text: at least 24px, or about 18.66px bold | **3:1** | 1.4.3 (AA) |
| UI component boundaries, focus indicators, meaningful icons and chart lines | **3:1** against adjacent colours | 1.4.11 Non-text Contrast (AA) |
| Normal / large text, enhanced | 7:1 / 4.5:1 | 1.4.6 (AAA) |

- Disabled controls, pure decoration and logos are exempt.
- Don't use colour as the **only** way to convey information (1.4.1): links inside paragraphs need an underline (or another non-colour cue), errors need text, chart series need labels or patterns.
- DevTools shows the ratio in the colour picker; see [Fonts, text and colour](../../02-css/07-typography-and-color/notes.md#color-contrast-and-accessibility) for the demo's failing example.
- Users who need more contrast may use Windows contrast themes; test with `@media (forced-colors: active)` and avoid conveying state with background colour alone. `prefers-contrast` lets you offer a higher-contrast variant.
- Related low-vision criteria: text must survive 200% resize (1.4.4), content must reflow at 320 CSS px width, which is 1280px at 400% zoom, without horizontal scrolling (1.4.10), and the layout must tolerate increased letter and line spacing (1.4.12), so avoid fixed heights on text containers.

## Motion

Motion can trigger nausea and seizures. `prefers-reduced-motion`, WCAG 2.2.2 (Pause, Stop, Hide) and 2.3.1 (Three Flashes) are covered in [CSS animations](../../02-css/19-animations/notes.md#accessibility). Additions from an accessibility review: auto-advancing carousels need a visible pause button, parallax and scroll-jacking should switch off with reduced motion, and 2.3.3 (AAA) asks that motion triggered by interaction can be disabled.

## Touch Target Size

WCAG 2.2 **2.5.8 Target Size (Minimum), AA**: every pointer target is at least **24×24 CSS px**, unless one of the exceptions applies:

- **Spacing:** a smaller target passes if a 24px-diameter circle centred on it doesn't overlap another target or that target's circle.
- **Inline:** links inside a sentence.
- **Equivalent:** the same action is available through another control that passes.
- **User-agent control:** native controls you haven't restyled.
- **Essential:** the size is required (a map pin at a precise location).

2.5.5 (AAA) asks for 44×44, which matches Apple's 44pt and is close to Material Design's 48dp guidance. A bigger hit area doesn't need a bigger icon:

```css
.icon-button {
  position: relative;
  min-width: 24px;
  min-height: 24px;
}
.icon-button::after {           /* invisible 44×44 hit area around a 24×24 icon */
  content: "";
  position: absolute;
  inset: -10px;
}
```

Also 2.5.7 Dragging Movements: a drag-to-reorder list needs "Move up"/"Move down" buttons or a menu, and a slider must accept a click on the track or arrow keys.

## Testing

No single tool is enough. Layer them from cheapest to most thorough:

| Layer | Tools | Catches |
|---|---|---|
| Editor and lint | `eslint-plugin-jsx-a11y`, the template accessibility rules in angular-eslint, `eslint-plugin-vuejs-accessibility` | Missing `alt`, click handlers on `<div>`, invalid ARIA, at write time |
| Component tests | `jest-axe` / `vitest-axe`, Testing Library `getByRole` queries | Missing names and roles in each component state (open, error, disabled) |
| End-to-end and CI | `@axe-core/playwright`, `cypress-axe`, Pa11y CI, Lighthouse CI | Regressions on real pages |
| Browser extensions | axe DevTools, WAVE, Accessibility Insights for Web, Lighthouse | Quick audits; Accessibility Insights adds a guided tab-stop check |
| Manual keyboard pass | Your keyboard | Order, traps, visible focus, Esc, things only humans can judge |
| Screen readers | NVDA (free) or JAWS on Windows with Chrome/Firefox; VoiceOver with Safari on macOS and iOS; TalkBack with Chrome on Android | Names, announcements, whether the experience makes sense |
| Expert audit and user testing | Specialists and disabled users | Usability, not just conformance |

Automated checkers can only decide criteria that are machine-testable: missing `alt`, contrast, missing labels, invalid ARIA. Whether alt text is meaningful, whether focus order makes sense or whether an announcement helps needs a human. A clean axe report or a Lighthouse score of 100 is a **floor**, not a pass.

A five-minute keyboard pass, done before every merge of new UI:

1. Unplug the mouse (or don't touch it). Tab from the address bar: is the skip link first and visible?
2. Can you reach and operate every control? Is the focus ring always visible and never hidden under a sticky header?
3. Does the order match the visual layout?
4. Open every menu, dialog and popover: does Esc close it and does focus come back to the trigger?
5. Zoom to 400%: does the page reflow into one column without horizontal scrolling?

## Making Accessibility Stick in a Team

Audits find problems; process stops them coming back.

- **Design:** colour tokens are contrast-checked pairs (text-on-surface, not single colours), focus and error states are designed rather than left to developers, and design files annotate headings, landmarks, focus order and accessible names for icon buttons.
- **Design system:** build accessible primitives once (Button, IconButton, Dialog, Menu, Tabs, Combobox, form Field) and test them with screen readers. Make misuse hard in the API: an `IconButton` whose TypeScript props **require** `label`, a `Field` that wires `id`, `aria-describedby` and `aria-invalid` itself.
- **Pipeline:** lint rules as errors, and an axe check in CI that fails on **new** violations while existing ones are tracked in a baseline that only shrinks.
- **Definition of done:** a keyboard pass for any new UI, a screen-reader smoke test for new interactive patterns, and axe clean on the changed pages.
- **People and ownership:** an accessibility champion per team, short training on the APG patterns, a regular expert audit, an accessibility statement with a feedback route, and accessibility bugs triaged with the same severity scale as other bugs (a keyboard trap in checkout is a P1).

## Common Mistakes

- **Clickable `<div>`s and `<span>`s** instead of `<button>` or `<a href>`; adding `role="button"` alone still leaves them without keyboard support.
- **`outline: none`** on `:focus` with no replacement, or a focus style made only of `box-shadow`, which vanishes in forced colours mode.
- **Missing or useless names**: icon-only buttons with no label, "click here" links, `alt="image"`, `aria-label` on a plain `<div>`.
- **Placeholder used as the label**: it disappears on typing, often fails contrast, and is not a reliable accessible name.
- **ARIA that lies**: `role="menu"` on site navigation, `aria-expanded` that is never updated, `aria-hidden="true"` on a focusable element.
- **Positive `tabindex`** values, or CSS reordering that makes the focus order differ from the visual order.
- **Live regions inserted together with their message**, so nothing is announced; or `role="alert"` on everything, so users are interrupted constantly.
- **Errors shown only in red** or only in a native browser bubble, and a submit button that stays disabled without saying why.
- **Not managing focus in an SPA**: after a route change focus stays on the old link (or the body) and the title never changes.
- **Treating a Lighthouse 100 or an overlay widget as compliance** instead of testing with a keyboard and a screen reader.

## Key Takeaways

- Accessibility is about the accessibility tree: every control needs the right **role**, a meaningful **name** and up-to-date **states**. Native HTML gives you all three plus keyboard behaviour.
- WCAG 2.2 is organised as POUR → guidelines → success criteria at A/AA/AAA; "accessible" in law and contracts means **WCAG 2.1 or 2.2 AA**. The EU's European Accessibility Act has applied since 28 June 2025.
- First rule of ARIA: use a native element if one exists. ARIA changes semantics only, never behaviour.
- Names come from `aria-labelledby` → `aria-label` → native label/`alt` → content → `title`; prefer visible text and keep it in the accessible name.
- Everything must work with the keyboard in a logical order; use `tabindex` 0 and -1 only, and a roving tabindex inside composite widgets.
- Move focus when the context changes (dialogs, route changes, deletions, form errors), use `inert` rather than JS focus traps, and keep `:focus-visible` outlines visible.
- Announce off-focus changes with a live region that already exists in the DOM; connect form errors with `aria-describedby` and `aria-invalid`.
- Contrast 4.5:1 / 3:1, targets at least 24×24 CSS px, no colour-only meaning, reduced motion respected; test with axe *and* a keyboard *and* a screen reader, and enforce it through the design system and CI.

## Interview Questions

### Junior (0–1 year)

**Q1. What is web accessibility, and who benefits from it?**
It is building sites that people with disabilities can perceive, understand, navigate and operate: blind users with screen readers, low-vision users with zoom, keyboard-only and switch users, deaf users relying on captions, people with cognitive or vestibular disabilities. It also helps people with temporary or situational limits (a broken arm, bright sunlight), older users, people on slow connections, and automated tools such as search engines and test frameworks that read the same semantics.

**Q2. What is the accessibility tree?**
It is a parallel tree the browser builds from the DOM and exposes to assistive technology through the operating system's accessibility APIs. Each node has a role (button, heading, link), a name ("Submit order"), states (expanded, checked, disabled) and sometimes a value and a description. Screen readers and voice control read this tree, not your pixels or your CSS classes, so a `<div>` styled as a button is just text to them. DevTools' Accessibility pane shows it.

**Q3. What is the difference between `alt=""` and leaving `alt` out?**
`alt=""` declares the image decorative, so screen readers skip it entirely. A missing `alt` is an error: the screen reader doesn't know whether the image matters and may read the file name ("IMG underscore 2041 dot jpg"). Every `<img>` needs an `alt` attribute; leave it empty only when the image adds no information.

**Q4. What is WCAG, and what does "WCAG 2.2 AA" mean?**
The Web Content Accessibility Guidelines from the W3C, organised under four principles (Perceivable, Operable, Understandable, Robust) with testable success criteria at three levels. "WCAG 2.2 AA" means the page meets every Level A and every Level AA criterion of version 2.2. It is the level that laws, procurement rules and contracts usually require; AAA is not expected across a whole site.

**Q5. What are landmarks and skip links for?**
Landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<search>`) expose regions that screen-reader users can list and jump to, so they don't have to listen to the whole header on every page. A skip link ("Skip to main content") is the first focusable element on the page and jumps keyboard users past the repeated header and navigation to `<main>`. It is usually hidden until it receives focus.

**Q6. A designer asks you to remove the blue outline that appears around buttons. What do you say?**
The outline is the focus indicator; without it keyboard users can't see where they are, which fails WCAG 2.4.7. Offer to restyle it instead: use `:focus-visible` so the ring appears for keyboard navigation but usually not after a mouse click, and design it to match the brand with enough contrast (3:1 against its surroundings). Keep it as an `outline` so it still shows in Windows contrast themes.

### Mid-level (2–4 years)

**Q7. What is the "first rule of ARIA"? Give an example where adding ARIA made things worse.**
If a native HTML element or attribute provides the semantics and behaviour you need, use it instead of adding ARIA to something else. ARIA only changes what assistive technology is told; it adds no keyboard support, focus or behaviour. Examples of harm: `role="button"` on a `<div>` with no `tabindex` or key handler announces a button nobody can operate with the keyboard; `role="menu"` on a site's navigation makes screen readers switch to application mode and expect arrow-key menu behaviour that doesn't exist; `aria-hidden="true"` on a container that has focusable links creates "ghost" focus stops that announce nothing.

**Q8. How does the browser compute an element's accessible name? If a field has a `<label>`, an `aria-label` and an `aria-labelledby`, which wins?**
`aria-labelledby` wins, then `aria-label`, then native labelling (`<label>`, `alt`, `<legend>`, `<caption>`), then the element's own text content for roles that allow it, and finally `title` or `placeholder`. So the field is named by the `aria-labelledby` target, and the visible `<label>` is ignored for the name, which is a common source of mismatches. The best practice is one source, preferably visible text, and if the name differs from the visible label it must at least contain it (2.5.3 Label in Name) so voice-control users can say what they see.

**Q9. Explain `tabindex="0"`, `tabindex="-1"` and positive values. What is a roving tabindex?**
`0` adds an element to the Tab order in its DOM position; `-1` makes it focusable from script but skips it with Tab; positive values pull elements to the front of the order in numeric order, which breaks the page's natural flow and should be avoided. A roving tabindex makes a composite widget (toolbar, tabs, radio group, menu) a single Tab stop: the active item has `tabindex="0"`, the others `-1`, and arrow keys move focus by swapping those values. Users Tab into the widget once, use arrows inside, and Tab out, and focus returns to the last active item next time.

**Q10. In a single-page app, screen-reader users say clicking a nav link "does nothing". Why, and how do you fix it?**
A client-side route change swaps the content without a page load, so the browser doesn't announce a new page, focus stays on the clicked link (or falls to `<body>` if the link was removed), and the title may not change. After rendering the new route, update `document.title`, then move focus to the new page's `<h1>` (given `tabindex="-1"`) or to the main container, so the screen reader reads the new heading and Tab continues from there. Some teams also announce "Navigated to Orders" through a polite live region. Most routers don't do this by default, so it belongs in the app shell, written once.

**Q11. You added `<div role="status">Item added</div>` with JavaScript when the user clicks "Add to cart", but nothing is announced. Why?**
Screen readers watch live regions that exist when the page is loaded or before the change; an element inserted already containing its text is often not treated as a change. Render an empty `role="status"` container on page load and set its `textContent` when the event happens. To repeat the same message, clear it and set it again after a short delay. Keep the message short and polite, and don't move focus for a status update.

**Q12. How do you make form validation errors accessible?**
Show each error as text next to its field, saying what is wrong and how to fix it, not just a red border. Link it to the field with `aria-describedby` (alongside any hint) and set `aria-invalid="true"` on the field, removing it once fixed. On submit, render an error summary at the top with links to each invalid field and move focus to the summary, or to the first invalid field on short forms. Don't disable the submit button until the form is valid, validate on blur or submit rather than on every keystroke, and use `autocomplete` attributes so users have less to type.

**Q13. What changed in WCAG 2.2 that affects front-end code most?**
Six criteria matter in day-to-day work. 2.4.11 Focus Not Obscured: sticky headers, cookie banners and chat bubbles must not cover the focused element (`scroll-padding`, non-overlapping banners). 2.5.8 Target Size: pointer targets at least 24×24 CSS px or adequately spaced. 2.5.7 Dragging Movements: every drag interaction needs a click or keyboard alternative. 3.3.7 Redundant Entry: don't ask for the same data twice in a process. 3.3.8 Accessible Authentication: no puzzles or memory tests at login, allow paste and password managers. 3.2.6 Consistent Help: help links stay in the same place. 2.2 also removed 4.1.1 Parsing, because browsers now handle invalid markup consistently.

### Senior (5+ years)

**Q14. You join a product with hundreds of known accessibility issues and a customer contract requiring WCAG 2.2 AA in six months. How do you plan the remediation?**
Measure, then fix by impact rather than by count. Run automated scans across all page templates and have specialists audit the critical user journeys (sign-up, log-in, search, checkout, account settings) manually with keyboard and screen readers. Then group issues by **root cause**: most of them usually trace back to a handful of shared components (the modal, the dropdown, the form field, the icon button), and fixing one component closes hundreds of instances.

Prioritise blockers on critical journeys first (keyboard traps, unlabelled fields, inaccessible dialogs, missing names on functional icons), then serious issues, then the long tail. Before burning down the backlog, stop new issues: lint rules, an axe gate in CI with a shrinking baseline, and accessibility in the definition of done. Communicate honestly: an accessibility statement with known issues and a contact route, and an ACR that says "partially supports" where true; an inflated report becomes a legal liability.

Recommendation: fix the design-system components and the top journeys first, put regression gates in place in week one, and report progress as "critical journeys passing" rather than raw issue counts.

**Q15. How would you design a design-system component API so that consumers can't easily make it inaccessible?**
Encode the rules in the API. An `IconButton` requires a `label` prop in its TypeScript types and renders it as visible-hidden text or `aria-label`; it always renders a real `<button type="button">`, so no consumer can turn it into a `<div>`. A `Field` component owns the wiring: it generates IDs (`useId()` in React), connects `<label>`, hint and error through `for` and `aria-describedby`, and sets `aria-invalid` from an `error` prop. A `Dialog` requires a title, manages focus on open and close, and is built on `<dialog>` or `inert` so consumers can't forget the focus trap.

Allow escape hatches (`aria-*` pass-through, polymorphic `as` props) but keep them narrow: don't let consumers override the role, and document which combinations are supported. Each component ships with documented keyboard behaviour (taken from the APG), axe tests for every state, and a screen-reader test matrix (NVDA + Chrome, VoiceOver + Safari, TalkBack). Recommendation: make the accessible path the only easy path, and treat an accessibility bug in a shared component as a high-severity release blocker, because it is copied into every product.

**Q16. A vendor offers an "accessibility overlay" that promises WCAG compliance by adding one script tag. Your product manager likes it. What is your recommendation?**
Decline it as a compliance strategy. Overlays add a toolbar (font size, contrast, "screen reader mode") and try to patch the DOM at runtime with heuristics, but they can't fix the real problems: inaccessible custom widgets, missing focus management, poor labels, broken reading order. Disabled users already have these adjustments in their browser and assistive technology, and overlays have been reported to interfere with screen readers. Sites using overlays are still sued under the ADA, many accessibility practitioners have publicly signed statements against them, and in 2025 the US Federal Trade Commission ordered a major overlay vendor to pay $1 million over deceptive claims that its tool could make any site WCAG-compliant.

Put the same budget into an audit of key journeys, fixes in shared components and CI checks. Recommendation: no overlay; fix the source, and say so in writing to the PM with the legal and user-impact reasons.

**Q17. Accessibility keeps regressing after each audit. How do you make it stick across many teams?**
Treat it like security or performance: shift left and automate the floor. Design reviews check contrast-safe tokens, focus and error states and annotated focus order. The design system provides accessible primitives so teams don't hand-roll dialogs and menus. Lint rules run as errors, component tests run axe in every state, and an end-to-end axe check fails the build on new violations while legacy ones sit in a baseline that only shrinks.

Automation catches only machine-testable issues, so add humans at the right points: a keyboard pass in the definition of done for any new UI, a screen-reader smoke test for new patterns, and an expert audit on a schedule. Give each team an accessibility champion, track issues by severity like other bugs, and publish a simple metric (critical journeys passing, open serious issues). Recommendation: accessible components plus CI gates plus a definition of done that includes a keyboard pass; without all three, audits keep finding the same issues.

## References

- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C WAI: What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [W3C WAI: How to meet WCAG (quick reference)](https://www.w3.org/WAI/WCAG22/quickref/)
- [W3C WAI: Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C: Using ARIA (the rules of ARIA use)](https://www.w3.org/TR/using-aria/)
- [W3C WAI: ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
- [W3C: Accessible Name and Description Computation](https://www.w3.org/TR/accname-1.2/)
- [MDN: Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [MDN: ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [MDN: ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [MDN: :focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible)
- [MDN: inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)
- [web.dev: Learn Accessibility](https://web.dev/learn/accessibility)
- [WebAIM: The WebAIM Million](https://webaim.org/projects/million/)
- [Deque: axe-core](https://github.com/dequelabs/axe-core)
- [EUR-Lex: European Accessibility Act, Directive (EU) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj)
- [ADA.gov: Guidance on web accessibility and the ADA](https://www.ada.gov/resources/web-guidance/)
- [GOV.UK Design System: Error summary](https://design-system.service.gov.uk/components/error-summary/)
