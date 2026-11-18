# Headings, Links and Bookmarks

> HTML · Topic 2 · Demo: [index.html](index.html)

Headings give a page its outline, links (`<a>`) connect it to other pages, and **bookmarks** are links that jump to a specific spot on a page. The demo builds a long "book" of 15 chapters with a link that jumps straight to Chapter 4.

## Headings: `<h1>` to `<h6>`

There are six heading levels. `<h1>` is the most important (the page's main title) and `<h6>` the least.

```html
<h1>Bookmarks</h1>          <!-- page title: one per page -->
<h2>Chapter 1</h2>          <!-- section -->
<h3>1.1 Introduction</h3>   <!-- sub-section of Chapter 1 -->
```

- Headings are **block elements**: each starts on a new line and takes the full width.
- Browsers show them bold and in decreasing size, but **choose the level by meaning, not by size**. If you want a small heading, use the right level and change the size with CSS.
- Do not skip levels (an `<h2>` followed directly by an `<h4>`), and use one `<h1>` per page. Screen-reader users jump between headings to scan a page, and search engines use them to understand the topic structure.
- `<p>` defines a paragraph, the normal container for running text.

## Links: the `<a>` (anchor) element

```html
<a target="_blank" href="https://www.scaler.com/academy/">Scaler Academy </a>
```

- `href` (hypertext reference) is the destination. The text between the tags is the clickable "hypertext".
- Without `href`, an `<a>` is not a link: it is not focusable with the keyboard and not clickable.

### Kinds of `href`

| Kind | Example | Goes to |
|------|---------|---------|
| Absolute URL | `href="https://google.com"` | Another website |
| Relative path | `href="about.html"`, `href="../index.html"` | A file relative to the current page |
| Root-relative | `href="/contact"` | A path from the site's root |
| Fragment (bookmark) | `href="#C4"` | The element with `id="C4"` on this page |
| Page + fragment | `href="book.html#C4"` | `id="C4"` on another page |
| Email | `href="mailto:someone@example.com"` | Opens the user's mail app |
| Phone | `href="tel:+911234567890"` | Starts a call on phones |

### The `target` attribute

| Value | Opens the link in |
|-------|-------------------|
| `_self` (default) | The same tab/frame |
| `_blank` | A new tab or window (used in the demo) |
| `_parent` | The parent frame (only matters inside an `<iframe>`) |
| `_top` | The full window, breaking out of all frames |
| a frame name | The `<iframe>` with that `name` |

> **Note:** A page opened with `target="_blank"` used to get access to the original tab through `window.opener` and could redirect it to a fake login page ("reverse tabnabbing"). Current browsers treat `target="_blank"` as `rel="noopener"` automatically, but adding `rel="noopener noreferrer"` is still common for older browsers. `noreferrer` additionally hides the address of your page from the destination site.

```html
<a href="https://www.scaler.com/academy/" target="_blank" rel="noopener noreferrer">Scaler Academy</a>
```

Opening a new tab takes control away from the user, so use it sparingly (external sites, or links that would interrupt a form the user is filling).

## Bookmarks (fragment links)

Bookmarks are useful when a web page is very long. Creating one takes two steps:

1. **Create the bookmark**: give the target element a unique `id`.
2. **Add a link to it**: set the link's `href` to `#` followed by that id.

When the link is clicked, the page scrolls down or up to the element with that id.

```html
<p><a href="#C4">Jump to Chapter 4</a></p>
...
<h2 id="C4">Chapter 4</h2>
<p>This chapter explains ...</p>
```

### How it works

- Clicking the link changes only the **fragment** (the part after `#`) of the URL, for example `index.html#C4`. The page is **not reloaded** and the fragment is never sent to the server.
- The browser looks for the element whose `id` matches and scrolls it to the top of the viewport. If the page is too short to scroll that far, it scrolls as far as it can.
- Each jump is added to the history, so the Back button returns to where you were.
- Because the fragment is part of the URL, you can share or bookmark `https://site.com/book.html#C4` and it opens at Chapter 4.

### Rules for the `id`

- It must be **unique** on the page. If two elements share an id, the link goes to the first one.
- It is **case-sensitive**: `href="#c4"` does not match `id="C4"`.
- It must not contain spaces. Prefer readable ids such as `id="chapter-4"`.

> **Note:** `href="#"` or `href="#top"` scrolls to the top of the page. The old way to create bookmarks, `<a name="C4">`, is obsolete; use `id` on any element instead.

### Making bookmarks nicer with CSS

```css
/* Animate the jump instead of snapping to it */
html {
    scroll-behavior: smooth;
}

/* Leave room above the target, e.g. for a sticky 60px header */
h2 {
    scroll-margin-top: 70px;
}

/* Highlight the section the URL currently points to */
:target {
    background-color: yellow;
}
```

> **Note:** Some users get motion sickness from animated scrolling. Wrap `scroll-behavior: smooth` in `@media (prefers-reduced-motion: no-preference) { ... }` to respect their system setting.

Modern browsers also support **text fragments**, links that scroll to a piece of text even without an id: `page.html#:~:text=Chapter%204`.

## Common Mistakes

- **Mismatched case or a typo** between `href="#C4"` and `id="C4"` — the link silently does nothing.
- **Duplicate ids** — only the first element can ever be reached, and JavaScript `getElementById` also returns only the first.
- **Forgetting the `#`** — `href="C4"` is a relative path to a file named `C4`, which gives a 404.
- **Choosing heading levels for their size** — breaks the page outline for screen readers and SEO; use CSS for size.
- **Vague link text** like "click here" — screen-reader users often list all links on a page, so the text should describe the destination ("Scaler Academy", "Jump to Chapter 4").
- **Sticky header covering the target** after a jump — fix with `scroll-margin-top`.

## Key Takeaways

- `<h1>`–`<h6>` describe the page outline: one `<h1>`, no skipped levels, levels chosen by meaning.
- `<a href="...">` creates a link; without `href` it is not a link.
- `target="_blank"` opens a new tab; pair it with `rel="noopener noreferrer"` for safety on older browsers.
- A bookmark = an element with a unique `id` + a link to `#thatId`; on another page use `page.html#thatId`.
- Fragment navigation does not reload the page, is not sent to the server, and is recorded in history.
- `scroll-behavior`, `scroll-margin-top` and `:target` improve the bookmark experience.

## Interview Questions

### Junior (0–1 year)

**Q1. How do you create a link that jumps to a section of the same page?**
Give the section a unique `id`, then link to it with a `#` followed by that id:

```html
<a href="#contact">Contact</a>
<section id="contact">...</section>
```

**Q2. What does `target="_blank"` do, and what is the default `target`?**
It opens the link in a new tab or window. The default is `_self`, which opens the link in the same tab (or the same frame).

**Q3. How many `<h1>` elements should a page have, and why does heading order matter?**
Use one `<h1>` for the page's main topic and nest the others in order without skipping levels. Screen-reader users navigate by headings, and search engines use them to understand the page structure, so a logical outline improves both accessibility and SEO.

**Q4. What is the difference between an absolute and a relative URL?**
An absolute URL includes the protocol and domain (`https://example.com/about.html`) and works from anywhere. A relative URL (`about.html`, `../img/logo.png`) is resolved against the current page's location, so it keeps working if the whole site moves to another domain.

**Q5. How would you link to Chapter 4 of `book.html` from a different page?**
Combine the page path with the fragment: `<a href="book.html#C4">Chapter 4</a>`. The browser loads `book.html` and then scrolls to the element with `id="C4"`.

**Q6. What happens if two elements have `id="C4"` and a link points to `#C4`?**
The page is invalid HTML, and the browser scrolls to the first element with that id in document order. The second element can never be reached by the link (and `document.getElementById("C4")` also returns only the first).

### Mid-level (2–4 years)

**Q7. Why was `rel="noopener"` recommended with `target="_blank"`, and is it still needed?**
The newly opened page could use `window.opener` to navigate the original tab to a phishing page (reverse tabnabbing), and it also ran in the same process, which hurt performance. Modern browsers now apply `noopener` to `target="_blank"` links by default, so it is mainly a safeguard for older browsers; `noreferrer` is still a separate choice if you do not want to send the `Referer` header.

**Q8. Your site has a fixed header 80px tall. After clicking a table-of-contents link, the section heading is hidden under it. How do you fix it?**
Add `scroll-margin-top` to the target elements, for example `h2 { scroll-margin-top: 90px; }`. The browser then stops scrolling that far above the element. (`scroll-padding-top` on the scroll container, usually `html`, achieves the same for all targets.)

**Q9. Does clicking a fragment link reload the page or send a request to the server? How can JavaScript react to it?**
No. Only the URL fragment changes, the browser scrolls, and a history entry is added. The fragment is never sent in the HTTP request. JavaScript can read it from `location.hash` and listen for changes with the `hashchange` event, which is how early single-page apps implemented routing.

**Q10. When should you use `<a>` and when `<button>`?**
Use `<a href>` when the action navigates somewhere (another page or a fragment); use `<button>` when it performs an action on the current page (open a modal, submit, toggle). Patterns like `<a href="#" onclick="...">` break expectations: they add a history entry or jump to the top, and assistive technology announces them as links.

**Q11. How can you highlight the section a user has just jumped to without JavaScript?**
Use the `:target` pseudo-class, which matches the element whose id equals the current URL fragment:

```css
section:target { outline: 3px solid orange; }
```

**Q12. You add `scroll-behavior: smooth` site-wide. What accessibility concern should you handle?**
Some users have vestibular disorders and set "reduce motion" in their OS. Apply smooth scrolling only inside `@media (prefers-reduced-motion: no-preference)` so those users get an instant jump.

### Senior (5+ years)

**Q13. Your design system has `Button` and `Link` components, and teams keep asking for "a link that looks like a button" and "a button that navigates". How would you design the API?**
Separate what the element *does* from how it *looks*. Behaviour picks the element: anything that navigates (it has a URL, can be opened in a new tab, copied or bookmarked) renders `<a href>`; an action on the current page renders `<button type="button">`. Appearance is a separate prop, such as `variant="primary" | "secondary" | "text"`, available on both. "A link that looks like a button" is then `<Link variant="primary" href="/signup">`, and "a button that navigates" does not exist: if it navigates, it is a link.

Build the rules into the components: `Link` requires `href`; `target="_blank"` automatically adds `rel="noopener noreferrer"` and visually hidden "(opens in a new tab)" text; `Button` defaults to `type="button"` so it never submits a form by accident. Then let lint catch the rest: `eslint-plugin-jsx-a11y` rules such as `anchor-is-valid` and `no-static-element-interactions` flag `<a onClick>` and `<div onClick>`. Recommendation: two components that share one visual `variant` prop, the element decided by behaviour, and lint rules so the wrong choice fails CI.

**Q14. A `Card` component renders a heading, but the right level depends on where the card is used. How do you keep the heading outline correct across a large app built by many teams?**
Do not rely on the old HTML5 "document outline" idea that an `<h1>` inside a `<section>` counts as a lower level. No browser or screen reader ever implemented it, it was removed from the spec in 2022, and the default styles that made a nested `<h1>` look smaller are being removed too. Every `<h1>` is announced as level 1.

Two workable designs: a `headingLevel` prop on every component that renders a heading (explicit, but easy to forget), or a `Heading` component that reads its level from context, where each `Section` wrapper adds one, so a card inside two sections renders an `<h3>` automatically and a prop overrides it for edge cases. In both, keep the visual size a separate prop (`size="sm"`), because the level follows the document structure and the size follows the design. Check the result with axe or a heading-list browser extension during QA. Recommendation: context-based levels with a separate size prop.

**Q15. In your single-page app, a shared link such as `/docs/setup#install` opens at the top of the page instead of at "Install", and keyboard users lose their place after in-app navigation. Why, and how do you fix it?**
The browser tries to scroll to the fragment when the document loads, but the section is rendered later by JavaScript (often after a data fetch), so at that moment there is nothing to scroll to. Client-side route changes do not trigger the native fragment behaviour at all, and a hash router (`/#/docs/setup`) uses the fragment for routing, so real fragment links cannot work alongside it.

Use history-based routing, and after a route's content has rendered, look up the target (`document.getElementById(decodeURIComponent(location.hash.slice(1)))`) and call `scrollIntoView()`; `scroll-margin-top` still handles the fixed header. For keyboard and screen-reader users, move focus on every navigation: to the fragment target (give it `tabindex="-1"` if it is not focusable) or to the new page's `<h1>`, and announce the route change. Recommendation: solve fragment scrolling and focus once, in the router layer, rather than page by page; most routers expose a hook for it.

**Q16. Your app shows links taken from user content (profile websites, comments). What can go wrong, and how do you handle it?**
Four separate risks, each with its own fix:

- **Script injection through `href`**: `<a href="javascript:alert(document.cookie)">` runs code when clicked. Escaping text does not help, because it is a valid attribute value. Parse the value with `new URL(value)` and allow only `https:` and `http:` (plus `mailto:` if needed); reject `javascript:`, `data:` and everything else.
- **SEO spam**: add `rel="ugc nofollow"` so your site does not pass ranking to spammers' pages.
- **Phishing**: show the real domain next to the link text, and consider a warning page for external links in high-risk areas.
- **Open redirects**: if you route outgoing links through `/out?to=...`, validate `to` against the same scheme rules so attackers cannot use your domain to disguise theirs.

Recommendation: one `UserLink` component that applies the scheme allowlist and `rel` values, used for every user-supplied URL, with a Content Security Policy that blocks `javascript:` URLs as a second line of defence (see [Security: XSS, CSRF and CSP](../../04-browser-platform/04-security-xss-csrf-csp/notes.md)).

## References
- [MDN: `<a>` the anchor element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a)
- [MDN: `<h1>`–`<h6>` heading elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/Heading_Elements)
- [MDN: `id` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/id)
- [MDN: `:target`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:target)
- [MDN: `scroll-margin-top`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-margin-top)
- [MDN: `rel="noopener"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener)
