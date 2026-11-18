# Machine Coding Round (Vanilla JS)

> Interview · Topic 2 · Demo: [autocomplete.html](autocomplete.html) · [star-rating.html](star-rating.html) · [tabs.html](tabs.html) · [modal.html](modal.html) · [infinite-scroll.html](infinite-scroll.html) · [nested-comments.html](nested-comments.html) · [todo.html](todo.html) · Open any file in a browser; everything is inline and no server or network is needed.

A machine coding round gives you 60–90 minutes to build a small, working UI in plain HTML, CSS and JavaScript: an autocomplete, a star rating, tabs, a modal, infinite scroll, nested comments, a todo list. It is not a puzzle round. The interviewer watches how you structure state, wire events, support keyboard and screen-reader users, cope with slow, failing and out-of-order data, and explain trade-offs. This note covers what is graded, a time plan, one reusable vanilla pattern, and seven worked builds. Each build has a runnable demo in this folder that fakes its API with a local array, a `Promise` and `setTimeout`. The note shows the code that matters, and the demo file has the complete page.

## What Interviewers Grade

| Area | What they look for | How to show it |
|---|---|---|
| Working code | The core flow works end to end before anything else | Something clickable within 20–25 minutes; never reach minute 50 with nothing running |
| Structure | Small named functions; data, rendering and events kept apart | One `state` object, one `render()`, a few action functions |
| State management | One source of truth; derived values computed, not stored | Store `todos`, compute "3 items left"; never read state back out of the DOM |
| Accessibility | Semantic elements, keyboard support, correct ARIA, visible focus | `<button>`, `<dialog>`, radios; arrow keys where the ARIA pattern expects them |
| Edge cases | Empty, loading, error, rapid input, out-of-order responses, long text, hostile input | Name them aloud, handle the important ones, list the rest as TODOs |
| Communication | Clarifies scope, thinks aloud, explains trade-offs, takes hints well | "I'll debounce at 250 ms, and I'll also abort the old request so a late response can't win" |
| Polish | Just enough CSS to be usable | Layout and focus styles last, after behaviour |

> **Note:** Many companies let you choose a framework. Practise vanilla anyway: it proves you know what the framework does for you (rendering from state, delegation, focus), and some interview editors have no build step.

## A Time Plan for 60–90 Minutes

| Phase | 60 min | 90 min | What you do |
|---|---|---|---|
| Clarify | 5 | 5–10 | Restate the task; ask about must-haves, data source, browsers, accessibility expectations; agree what is out of scope |
| Plan | 5 | 10 | Write the state shape, the markup skeleton and the list of events; mention extensions you will skip |
| Happy path | 25 | 35 | Markup → render from state → events → fake API |
| Edge cases and a11y | 10 | 15 | Loading, empty and error states; keyboard; ARIA; stale responses; focus after re-render |
| Polish | 5 | 10 | CSS, naming, remove dead code |
| Walkthrough | 10 | 15 | Demo it, explain trade-offs, answer follow-ups ("how would this scale?", "how would you test it?") |

Keep the devtools console open, test with the keyboard as you go, and when you are stuck say what you are trying and why. A short `// TODO:` list of known gaps reads far better than gaps the interviewer finds themselves.

## The Reusable Vanilla Pattern

Almost every build below uses the same skeleton: **a state object, a `render()` that writes the DOM from state, and a few delegated listeners that call actions, which change state and re-render.** It is the React or Vue mental model without the library.

```js
const state = { items: [], filter: "all" };
const FILTERS = { all: () => true, active: (item) => !item.done, done: (item) => item.done };

function setState(patch) {
  Object.assign(state, patch); // 1. change the data
  render();                    // 2. redraw from the data
}

function render() {
  const visible = state.items.filter(FILTERS[state.filter]); // derived, never stored
  list.replaceChildren(...visible.map(renderItem));
  count.textContent = `${visible.length} shown`;
}

// 3. one listener on the container handles every current and future item
list.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest("li").dataset.id;
  if (button.dataset.action === "delete") {
    setState({ items: state.items.filter((item) => item.id !== id) });
  }
});
```

A tiny element builder keeps rendering short and XSS-safe, because strings passed to `append()` become text nodes, never HTML:

```js
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.append(...children);
  return el;
}

h("button", { type: "button", "data-action": "delete" }, "Delete");
// → <button type="button" data-action="delete">Delete</button>
h("p", {}, "<img src=x onerror=alert(1)>");
// → <p>&lt;img src=x onerror=alert(1)&gt;</p>: shown as text, never executed
```

| | Re-render the list from state | Patch only what changed |
|---|---|---|
| Code | Short and hard to get out of sync | More code: find the node, update it |
| Focus and typed input | Lost, because the focused element is replaced (restore it, see [Build 7](#build-7-todo-list-persisted-to-localstorage)) | Kept |
| Cost | Fine for tens to a few hundred items | Needed for long or growing lists |
| Use for | Todo lists, comments, filters | Feeds, chat, live typing |

Background: [DOM manipulation](../../03-javascript/23-dom-manipulation/notes.md), [event delegation](../../03-javascript/24-events-and-delegation/notes.md#event-delegation), and debounce and throttle in [Functional patterns](../../03-javascript/26-functional-patterns/notes.md).

## Build 1: Autocomplete With Debounce, Keyboard and ARIA Combobox

Demo: [autocomplete.html](autocomplete.html). This is the most common machine coding task because it touches everything: async data, race conditions, keyboard handling, ARIA and XSS. Ask first: request on every keystroke or after a pause? Minimum characters? How many results? What does selecting do (fill the input, navigate)? Highlight the match? Cache?

The markup follows the ARIA 1.2 combobox pattern. Focus stays in the `<input>` the whole time, and the input *points* at the highlighted option with `aria-activedescendant`:

```html
<label for="city-input">City</label>
<div class="combo" id="city-combo">
  <input id="city-input" type="text" role="combobox" autocomplete="off"
         aria-autocomplete="list" aria-expanded="false" aria-controls="city-listbox">
  <ul id="city-listbox" class="listbox" role="listbox" aria-label="Cities" hidden></ul>
</div>
<p id="city-status" class="status" role="status"></p> <!-- "5 suggestions…", "No cities match…", errors -->
```

| Attribute | On | Why |
|---|---|---|
| `role="combobox"`, `aria-autocomplete="list"` | input | Announced as an editable combo box that shows a list of suggestions |
| `aria-expanded` | input | Whether the list is showing; update it on every open and close |
| `aria-controls` | input | Points to the listbox |
| `aria-activedescendant` | input | The id of the highlighted option, so screen readers read it while focus stays in the input |
| `role="option"` + `aria-selected="true"` | `<li>` | Marks the highlighted option |
| `autocomplete="off"` | input | Stops the browser's own suggestion dropdown covering yours |
| `role="status"` | message | Polite live region: result counts and errors get announced |

The fake API answers after a random 100–700 ms, so responses really do arrive out of order:

```js
function fakeSearch(query, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (query === "fail") return reject(new Error("500 Internal Server Error"));
      const q = query.toLowerCase();
      resolve(CITIES.filter((city) => city.toLowerCase().includes(q)).slice(0, 8));
    }, 100 + Math.random() * 600);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason); // a DOMException named "AbortError"
    }, { once: true });
  });
}
```

State and request logic: debounce, cache, abort, and drop stale responses.

```js
const state = { query: "", results: [], activeIndex: -1, open: false, status: "idle" }; // idle | loading | done | error
const cache = new Map(); // query → results
let controller = null;   // AbortController of the request in flight

async function search(query) {
  if (query !== state.query) return; // a debounced call for text that is no longer in the box

  if (cache.has(query)) {
    setState({ results: cache.get(query), activeIndex: -1, open: true, status: "done" });
    return;
  }

  controller?.abort(); // cancel the previous request: it can no longer resolve late
  controller = new AbortController();
  setState({ status: "loading" });

  try {
    const results = await fakeSearch(query, controller.signal);
    cache.set(query, results);
    if (query !== state.query) return; // stale: the user typed again before the debounce fired
    setState({ results, activeIndex: -1, open: true, status: "done" });
  } catch (err) {
    if (err.name === "AbortError") return; // we cancelled it ourselves: not an error
    setState({ results: [], activeIndex: -1, open: false, status: "error" });
  }
}
const debouncedSearch = debounce(search, 250);

function reset() {
  controller?.abort();
  setState({ query: "", results: [], activeIndex: -1, open: false, status: "idle" });
}

input.addEventListener("input", () => {
  const query = input.value.trim();
  if (!query) return reset();
  setState({ query });
  debouncedSearch(query);
});
```

`abort()` is the optimisation: no wasted work, and an aborted request can never resolve late. The `query !== state.query` check is the guarantee, because not every API can be cancelled, and a response can resolve in the gap before the next debounced call aborts it. The demo's request log shows both: `× aborted "lo"` and `↷ dropped stale response for "lon"`.

Rendering highlights the match with DOM nodes, not `innerHTML`. The query is user input, so `innerHTML` would be an XSS hole:

```js
function highlight(text, query) {
  const start = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || start === -1) return [text];
  const mark = document.createElement("mark");
  mark.textContent = text.slice(start, start + query.length);
  return [text.slice(0, start), mark, text.slice(start + query.length)];
}

function render() {
  const { query, results, activeIndex, open, status } = state;

  listbox.replaceChildren(...results.map((city, i) => {
    const li = document.createElement("li");
    li.id = `city-option-${i}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(i === activeIndex));
    li.dataset.index = String(i);
    li.append(...highlight(city, query));
    return li;
  }));

  const expanded = open && results.length > 0;
  listbox.hidden = !expanded;
  input.setAttribute("aria-expanded", String(expanded));
  combo.dataset.status = status; // CSS shows "Loading…" from [data-status="loading"]

  if (expanded && activeIndex >= 0) {
    input.setAttribute("aria-activedescendant", `city-option-${activeIndex}`);
    listbox.children[activeIndex].scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }

  let message = "";
  if (status === "error") message = "Couldn't load suggestions. Keep typing to try again.";
  else if (status === "done" && open) {
    message = results.length
      ? `${results.length} suggestion${results.length === 1 ? "" : "s"}. Use up and down arrows to choose.`
      : `No cities match “${query}”.`;
  }
  if (statusEl.textContent !== message) statusEl.textContent = message; // don't re-announce identical text
}
```

Keyboard and mouse:

```js
input.addEventListener("keydown", (e) => {
  const { results, activeIndex, open } = state;
  const last = results.length - 1;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault(); // keep the caret where it is
      if (results.length) setState({ open: true, activeIndex: !open || activeIndex >= last ? 0 : activeIndex + 1 });
      break;
    case "ArrowUp":
      e.preventDefault();
      if (results.length) setState({ open: true, activeIndex: !open || activeIndex <= 0 ? last : activeIndex - 1 });
      break;
    case "Enter":
      if (open && activeIndex >= 0) {
        e.preventDefault(); // don't submit a surrounding form
        choose(activeIndex);
      }
      break;
    case "Escape":
      if (open) {
        setState({ open: false, activeIndex: -1 });
      } else {
        input.value = ""; // a second Esc clears the box, as the ARIA pattern suggests
        reset();
      }
      break;
  }
});

function choose(index) {
  const city = state.results[index];
  if (!city) return;
  input.value = city;
  selectedEl.textContent = city;
  setState({ query: city, activeIndex: -1, open: false });
}

listbox.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
listbox.addEventListener("click", (e) => {
  const option = e.target.closest('[role="option"]');
  if (option) choose(Number(option.dataset.index));
});
input.addEventListener("blur", () => setState({ open: false, activeIndex: -1 }));
```

This handles empty and whitespace-only input, no results, a server error (type `fail`), out-of-order responses, repeated queries (cache), Enter with nothing highlighted (the form can still submit), and long lists (`scrollIntoView({ block: "nearest" })`). Worth mentioning as next steps: accent-insensitive matching ("Sao" should find "São Paulo"), a size limit on the cache, and testing with VoiceOver, whose `aria-activedescendant` support has historically been the weakest.

## Build 2: Star Rating (Keyboard and ARIA)

Demo: [star-rating.html](star-rating.html). The strongest answer reuses the platform. A star rating is "pick one value out of five", which is a **radio group**, so build it from real radio buttons inside a `<fieldset>`. The browser then provides Tab into the group, arrow keys to change the value, and the announcement "3 stars, radio button, 3 of 5" without any ARIA.

```html
<fieldset class="rating" id="product-rating">
  <legend>Rate this product</legend> <!-- the group's accessible name; the stars are generated -->
</fieldset>
```

```js
function createStarRating(fieldset, { max = 5, value = 0, onChange = () => {} } = {}) {
  const name = `${fieldset.id}-value`; // unique per widget, so several ratings can share a page
  const state = { value, hover: 0 };
  const stars = [];

  for (let i = 1; i <= max; i++) {
    const id = `${name}-${i}`;
    const input = h("input", { type: "radio", class: "visually-hidden", name, id, value: i });
    const label = h("label", { for: id, "data-value": i },
      h("span", { "aria-hidden": "true" }, "★"),
      h("span", { class: "visually-hidden" }, `${i} star${i === 1 ? "" : "s"}`));
    fieldset.append(input, label);
    stars.push({ input, label });
  }

  function render() {
    const shown = state.hover || state.value; // hover previews, otherwise show the saved value
    stars.forEach(({ input, label }, i) => {
      input.checked = i + 1 === state.value;
      label.classList.toggle("filled", i < shown);
    });
  }

  function set(newValue) {
    state.value = newValue;
    render();
    onChange(newValue);
  }

  // Radios fire "change" for label clicks AND arrow keys: one handler covers mouse and keyboard
  fieldset.addEventListener("change", (e) => set(Number(e.target.value)));
  fieldset.addEventListener("pointerover", (e) => {
    const label = e.target.closest("label[data-value]");
    if (!label) return;
    state.hover = Number(label.dataset.value);
    render();
  });
  fieldset.addEventListener("pointerleave", () => {
    state.hover = 0;
    render();
  });

  render();
  return { get value() { return state.value; }, set };
}

const rating = createStarRating(document.getElementById("product-rating"), {
  onChange: (value) => { output.textContent = value ? `${value} of 5` : "none"; },
});
document.getElementById("clear-rating").addEventListener("click", () => rating.set(0));
```

```css
.rating label { font-size: 2.25rem; color: #d1d5db; cursor: pointer; }
.rating label.filled { color: #f59e0b; }
.rating input:focus-visible + label { outline: 3px solid #2563eb; } /* the radio is hidden, so its star shows focus */
```

- The radio is **visually hidden**, not `display: none`, so it stays focusable and in the accessibility tree.
- A factory with options and a small returned API (`value`, `set`) is what "make it reusable" means in this round.
- Hover preview is separate state (`hover`) that never changes the saved value.
- Radios cannot be unchecked by clicking again, so offer "Clear rating" (`rating.set(0)`) or a visible "No rating" radio.
- A **read-only** average (3.5 stars) is not a control. Render it as an image with a text alternative, `<div role="img" aria-label="Rated 3.5 out of 5">`, and draw partial stars with a gradient clipped to the star characters (see the demo).
- The ARIA alternative (`role="radiogroup"`, `role="radio"` spans, `aria-checked`, a roving `tabindex` and your own arrow-key code) works, but re-implements what radios give for free. The roving tabindex technique is shown in [Build 3](#build-3-tabs-aria-tabs-pattern).

## Build 3: Tabs (ARIA Tabs Pattern)

Demo: [tabs.html](tabs.html).

```html
<div role="tablist" aria-label="Account settings">
  <button type="button" role="tab" id="tab-profile" aria-controls="panel-profile" aria-selected="true">Profile</button>
  <button type="button" role="tab" id="tab-security" aria-controls="panel-security" aria-selected="false">Security</button>
  <button type="button" role="tab" id="tab-billing" aria-controls="panel-billing" aria-selected="false">Billing</button>
</div>
<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile" tabindex="0">…</div>
<div role="tabpanel" id="panel-security" aria-labelledby="tab-security" tabindex="0">…</div>
<div role="tabpanel" id="panel-billing" aria-labelledby="tab-billing" tabindex="0">…</div>
```

```js
function initTabs(root) {
  const tablist = root.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  function select(tab, { focus = true } = {}) {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1; // roving tabindex: only the selected tab is in the Tab order
      document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
    }
    if (focus) tab.focus();
  }

  tablist.addEventListener("click", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) select(tab);
  });

  tablist.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(e.target.closest('[role="tab"]'));
    if (i === -1) return;
    const next = {
      ArrowRight: tabs[(i + 1) % tabs.length],
      ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[e.key];
    if (!next) return;
    e.preventDefault(); // Home/End would otherwise scroll the page
    select(next);       // automatic activation: moving focus also selects
  });

  // Progressive enhancement: the HTML shows every panel; JS hides all but the selected one
  select(tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0], { focus: false });
}

initTabs(document.getElementById("settings-tabs"));
```

| Key | Result |
|---|---|
| Tab (into the widget) | Focuses the selected tab only; the tab list is a single Tab stop |
| Tab (again) | Moves into the panel (`tabindex="0"`, so it is reachable even without focusable content) |
| ← / → | Previous / next tab, wrapping at the ends |
| Home / End | First / last tab |

**Roving tabindex** means exactly one item in a composite widget has `tabindex="0"` and the rest have `-1`; arrow keys move focus inside and Tab leaves. **Automatic activation** (select on arrow) suits panels that are already in the DOM. Use **manual activation** (arrows only move focus; Enter or Space selects) when showing a panel triggers a fetch or a heavy render. To make tabs linkable, mirror the selected tab in the URL (`#security` or `?tab=security` via `history.replaceState`) and select it on load.

## Build 4: Modal With `<dialog>`

Demo: [modal.html](modal.html). Before `<dialog>`, a modal meant a hand-written focus trap, `aria-modal`, `inert` on the rest of the page and z-index fights. `showModal()` does most of that. More on the element (and on `popover` and `inert`) in [Interactive elements and web components](../../01-html/12-interactive-elements-and-web-components/notes.md).

| Requirement | Does `showModal()` handle it? |
|---|---|
| Move focus into the dialog | Yes: to the `autofocus` element, otherwise the first focusable one |
| Keep focus inside, block the page | Yes: everything outside is inert |
| Close on Esc | Yes: fires `cancel`, then `close` |
| Return focus to the opener | Yes, in current browsers |
| Render above everything | Yes: the top layer, no `z-index` needed |
| Dim the page | Style `::backdrop` |
| Close on backdrop click | No: add a handler (or the new `closedby="any"` attribute, not yet in every browser) |
| Stop the page scrolling behind | No: add CSS |

```html
<button type="button" id="delete-account">Delete account…</button>

<dialog id="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
  <form method="dialog" class="dialog-body"> <!-- method="dialog": a submit button closes the dialog -->
    <h2 id="confirm-title">Delete your account?</h2>
    <p id="confirm-desc">All your projects and settings will be removed. This cannot be undone.</p>
    <button value="cancel" autofocus>Cancel</button>  <!-- safe default focus for a destructive action -->
    <button value="confirm" class="danger">Delete account</button>
  </form>
</dialog>
```

```css
dialog { padding: 0; }                       /* padding goes on .dialog-body instead, see below */
dialog::backdrop { background: rgb(15 23 42 / 0.55); }
html:has(dialog[open]) { overflow: hidden; } /* scroll lock */
```

```js
// Opens a modal <dialog> and resolves with the value of the button that closed it ("" for Esc)
function showDialog(dialog) {
  dialog.returnValue = ""; // returnValue survives from the previous close: reset it
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true });
  });
}

// A click whose target is the <dialog> element itself landed on the backdrop
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close("cancel");
});

document.getElementById("delete-account").addEventListener("click", async () => {
  const answer = await showDialog(dialog);
  result.textContent = answer === "confirm" ? "Account deleted (not really)." : `Cancelled (returnValue "${answer}").`;
});
```

The backdrop check only works because the dialog has no padding of its own: the form fills it, so a click inside never has the dialog as its target. A promise-returning `showDialog()` lets calling code read like `if (await showDialog(confirmDialog) === "confirm")`. One known gap: pressing inside the dialog and releasing on the backdrop (while selecting text) fires `click` on the dialog too. Production code records where `pointerdown` happened and only closes if both ends were on the backdrop.

## Build 5: Infinite Scroll With IntersectionObserver

Demo: [infinite-scroll.html](infinite-scroll.html). Watch a 1 px **sentinel** after the list instead of listening to `scroll`: the browser computes intersections asynchronously as part of rendering and calls back only when the sentinel's visibility changes, so no code runs on every scroll event and nothing reads layout in a hot loop. Observers in general are covered in [Observers, history and workers](../../04-browser-platform/06-observers-history-workers/notes.md).

```html
<ul id="feed" class="feed" aria-busy="false"></ul>
<div id="sentinel" class="sentinel"></div>
<p id="feed-status" class="status" role="status"></p>
<p class="controls"><button type="button" id="load-more" hidden>Load more</button></p>
```

```js
const state = { count: 0, nextCursor: 0, loading: false, error: null }; // nextCursor null = no more pages

async function loadMore() {
  if (state.loading || state.nextCursor === null) return; // the observer can fire again mid-request
  state.loading = true;
  state.error = null;
  renderStatus();
  try {
    const { items, nextCursor } = await fetchPosts(state.nextCursor);
    appendPosts(items); // append only the new page: a full re-render would lose scroll position and focus
    state.count += items.length;
    state.nextCursor = nextCursor;
  } catch (err) {
    state.error = `Couldn't load more posts (${err.message}).`;
  } finally {
    state.loading = false;
    renderStatus(); // shows "Retry" after an error, "You're all caught up" at the end
  }

  if (state.nextCursor === null) {
    observer.disconnect(); // nothing left to load
  } else if (!state.error) {
    // If the sentinel is STILL visible (short page, tall screen), its visibility never changes again,
    // so no callback would fire. Re-observing queues a fresh initial callback with the current state.
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  }
}

const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) loadMore();
}, { rootMargin: "0px 0px 300px 0px" }); // start loading 300 px before the sentinel is on screen

observer.observe(sentinel); // the initial callback loads the first page
loadMoreBtn.addEventListener("click", loadMore);
```

`appendPosts()` builds the new `<li>`s into a `DocumentFragment` with `textContent` and appends it once. `renderStatus()` sets `aria-busy` on the list while loading and shows the "Load more" / "Retry" button whenever a request is not running.

- The **`loading` guard** stops duplicate requests; the **`nextCursor === null`** check stops requests past the end.
- The **button fallback** matters: keyboard and switch users, failed requests (no intersection change happens to trigger a retry), and anyone who wants to reach the footer, which pure infinite scroll makes unreachable.
- Cursor pagination, virtualisation of very long feeds and restoring scroll position on back navigation are design questions: see the feed design in [Front-end system design](../01-frontend-system-design/notes.md#worked-design-2-news-feed-with-infinite-scroll).

## Build 6: Nested Comments

Demo: [nested-comments.html](nested-comments.html). APIs and databases usually return a **flat list with `parentId`**, so keep that as state and build the tree only when rendering. Replies at any depth, cancel and delete all go through two delegated listeners.

```js
const state = {
  comments: [
    { id: 1, parentId: null, author: "Asha", text: "Great write-up! The debounce part finally clicked." },
    { id: 2, parentId: 1, author: "Ben", text: "Same here. The stale-response check was new to me." },
    { id: 3, parentId: 2, author: "Asha", text: "AbortController plus a query check covers both cases." },
    { id: 4, parentId: 1, author: "Chen", text: "Would love a follow-up on virtualised lists." },
    { id: 5, parentId: null, author: "Dana", text: "Is the combobox pattern the same in React?" },
  ],
  replyingTo: null, // id of the comment whose reply form is open
};
let nextId = 6;

function render() {
  const byParent = Map.groupBy(state.comments, (c) => c.parentId); // parentId → [children], built once: O(n)
  root.replaceChildren(renderThread(byParent, null) ?? h("p", {}, "No comments yet."));
}

function renderThread(byParent, parentId) {
  const children = byParent.get(parentId);
  if (!children) return null;
  return h("ul", { class: "thread" }, ...children.map((c) => renderComment(byParent, c)));
}

function renderComment(byParent, c) {
  const article = c.deleted
    ? h("article", {}, h("p", { class: "deleted" }, "This comment was deleted."))
    : h("article", {},
        h("p", { class: "meta" }, h("strong", {}, c.author)),
        h("p", {}, c.text),
        h("div", { class: "actions" },
          h("button", { type: "button", "data-action": "reply", "aria-expanded": String(state.replyingTo === c.id) }, "Reply"),
          h("button", { type: "button", "data-action": "delete" }, "Delete")));

  const li = h("li", { "data-id": c.id }, article);
  if (state.replyingTo === c.id) li.append(replyForm(c)); // a <form data-parent-id> with a labelled <textarea>
  const replies = renderThread(byParent, c.id);           // recursion: depth is unlimited
  if (replies) li.append(replies);
  return li;
}

// Re-rendering replaces the DOM, so put focus back somewhere sensible
function focusInComment(id, selector) {
  root.querySelector(`li[data-id="${id}"] ${selector}`)?.focus();
}

function deleteComment(id) {
  if (state.replyingTo === id) state.replyingTo = null;
  const hasReplies = state.comments.some((c) => c.parentId === id);
  state.comments = hasReplies
    ? state.comments.map((c) => (c.id === id ? { ...c, text: "", deleted: true } : c)) // soft delete keeps the thread
    : state.comments.filter((c) => c.id !== id);
}

section.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.closest("li[data-id]").dataset.id);
  switch (button.dataset.action) {
    case "reply":
      state.replyingTo = state.replyingTo === id ? null : id;
      render();
      if (state.replyingTo) document.getElementById(`reply-${id}`).focus();
      else focusInComment(id, '[data-action="reply"]');
      break;
    case "cancel":
      state.replyingTo = null;
      render();
      focusInComment(id, '[data-action="reply"]'); // re-render replaced the DOM: put focus back
      break;
    case "delete":
      deleteComment(id);
      render();
      section.querySelector("#new-comment").focus(); // the clicked button no longer exists
      break;
  }
});

section.addEventListener("submit", (e) => { // submit bubbles, so one listener covers every reply form
  e.preventDefault();
  const form = e.target;
  const text = form.elements.text.value.trim();
  if (!text) return;
  const parentId = form.dataset.parentId ? Number(form.dataset.parentId) : null;
  const id = nextId++;
  state.comments.push({ id, parentId, author: "You", text });
  state.replyingTo = null;
  render();
  if (parentId === null) form.reset();              // the top-level form is not re-rendered
  else focusInComment(id, '[data-action="reply"]'); // land on the new reply
});
```

| Data shape | Good at | Weak at |
|---|---|---|
| Flat list with `parentId` | Matches the API; easy add, delete and update by id; easy to paginate per parent | Needs grouping before rendering |
| Nested tree (`replies: [...]`) | Renders directly with recursion | Updating a deep node means walking the tree; duplicates if a subtree is refetched |

- Grouping once with `Map.groupBy()` (ES2024, in every current browser) keeps rendering O(n). Filtering the whole array for each comment would be O(n²). A plain loop over the array building a `Map` does the same job in older environments.
- **Soft delete** ("This comment was deleted.") keeps the replies attached; hard-deleting a parent would orphan them.
- Nested `<ul>`s give screen readers the nesting level for free. Cap the *visual* indent after a few levels and offer "Continue this thread" for very deep chains.

## Build 7: Todo List Persisted to localStorage

Demo: [todo.html](todo.html). It is the simplest app, so interviewers grade the details: storage failures, validation, focus after re-render, and syncing tabs. Storage APIs are compared in [Storage and cookies](../../04-browser-platform/02-storage-and-cookies/notes.md).

```js
const STORAGE_KEY = "machine-coding:todos:v1"; // namespaced and versioned, so a new shape can migrate

function loadTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t?.id === "string" && typeof t.title === "string"); // never trust stored data
  } catch {
    return []; // corrupt JSON or storage blocked: start empty instead of crashing
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
  } catch (err) {
    console.warn("Could not save todos:", err); // quota exceeded or storage disabled
  }
}

const state = { todos: loadTodos(), filter: "all" };
const FILTERS = { all: () => true, active: (t) => !t.done, done: (t) => t.done };

function setState(patch) {
  Object.assign(state, patch);
  if ("todos" in patch) saveTodos();
  render();
}

function renderTodo(todo) {
  const checkboxId = `todo-${todo.id}`;
  const checkbox = h("input", { type: "checkbox", id: checkboxId, "data-action": "toggle" });
  checkbox.checked = todo.done;
  return h("li", { "data-id": todo.id, class: todo.done ? "done" : "" },
    checkbox,
    h("label", { for: checkboxId }, todo.title),
    h("button", { type: "button", "data-action": "delete", "aria-label": `Delete “${todo.title}”` }, "×"));
}

function render() {
  // Re-rendering the list destroys the focused element: remember it and restore it afterwards
  const active = document.activeElement;
  const focusedId = list.contains(active) ? active.closest("li").dataset.id : null;
  const focusedAction = focusedId ? active.dataset.action : null;

  const visible = state.todos.filter(FILTERS[state.filter]);
  list.replaceChildren(...visible.map(renderTodo));
  empty.hidden = visible.length > 0;

  const left = state.todos.filter((t) => !t.done).length;
  count.textContent = `${left} item${left === 1 ? "" : "s"} left`; // count is a role="status" region
  clearDone.hidden = !state.todos.some((t) => t.done);
  for (const b of filters.querySelectorAll("[data-filter]")) {
    b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter));
  }

  if (focusedId) {
    const target = list.querySelector(`li[data-id="${focusedId}"] [data-action="${focusedAction}"]`);
    (target ?? input).focus(); // the item may be gone (deleted or filtered out)
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  setState({ todos: [...state.todos, { id: crypto.randomUUID(), title, done: false }] });
  form.reset();
});

list.addEventListener("change", (e) => {
  if (e.target.dataset.action !== "toggle") return;
  const id = e.target.closest("li").dataset.id;
  setState({ todos: state.todos.map((t) => (t.id === id ? { ...t, done: e.target.checked } : t)) });
});

list.addEventListener("click", (e) => {
  const button = e.target.closest('[data-action="delete"]');
  if (!button) return;
  const id = button.closest("li").dataset.id;
  setState({ todos: state.todos.filter((t) => t.id !== id) });
});

// Another tab wrote the same key: reload (don't save, the other tab already did)
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  state.todos = loadTodos();
  render();
});
```

The filter buttons and "Clear completed" use the same delegated style (see the demo).

- `localStorage` is synchronous, string-only and limited to roughly 5 MB per origin. `setItem` throws when the quota is full, and some privacy modes block storage entirely.
- The `storage` event fires only in *other* tabs of the same origin, never in the tab that wrote.
- `crypto.randomUUID()` needs a secure context (HTTPS, `localhost`, and local files in current browsers). A counter or `Date.now()` plus a random suffix is the fallback.
- Filters use `aria-pressed` toggle buttons. To survive a reload, keep the filter in the URL hash (`#/active`) rather than in storage.

## Other Builds in This Repo

| Build | Note | What it adds |
|---|---|---|
| FAQ accordion | [Accessible FAQ accordion](../../05-projects/02-faq-accordion/notes.md) | `<details>`, `aria-expanded`, height animation |
| Hamburger navbar | [Responsive navbar](../../05-projects/03-responsive-navbar/notes.md) | A disclosure button, mobile-first media queries |
| Carousel | [Horizontal carousel](../../05-projects/04-horizontal-carousel/notes.md) | Scroll snapping, drag, autoplay, DOM measuring |

## Common Mistakes

- **Styling first.** Thirty minutes of CSS and no working behaviour is the most common way to fail this round.
- **Reading state from the DOM** (`li.classList.contains("done")`) instead of keeping it in one state object.
- **`innerHTML` with template strings containing user input.** Typing `<img src=x onerror=alert(1)>` into the todo box runs the script. Build with `textContent` / `append()`.
- **No stale-response handling** in search: a slow old response overwrites the new results.
- **A listener per item** created in a loop, instead of one delegated listener on the container.
- **Clickable `<div>`s and `<span>`s** with no keyboard support, where `<button>`, radios or `<dialog>` would give it for free.
- **Losing focus after re-rendering** a list, which strands keyboard users at the top of the page.
- **Forgetting loading, empty and error states**, or a retry path after an error.
- **Infinite scroll without a guard**, so one scroll fires three identical requests, or without an end condition.
- **Unhandled `localStorage` failures**: `JSON.parse` on corrupt data, or `setItem` throwing on a full quota, crashes the whole app.

## Key Takeaways

- Clarify scope, plan the state shape, get the happy path working, then edge cases and accessibility, then CSS.
- State object + `render()` + delegated events is a reusable skeleton for almost any widget.
- Build DOM with `createElement`, `textContent` and `append()`. User input never goes through `innerHTML`.
- Search needs debounce, `AbortController` *and* a stale-response check; cache repeated queries.
- Prefer native elements (radios, `<dialog>`, `<button>`) and follow the ARIA Authoring Practices pattern when you must build a composite widget (combobox, tabs).
- Roving tabindex makes a composite widget one Tab stop with arrow-key navigation inside.
- `IntersectionObserver` + sentinel + loading guard + end condition + button fallback is the infinite scroll recipe.
- After re-rendering, put focus back somewhere sensible.

## Interview Questions

### Junior (0–1 year)

**Q1. Why does the todo list use one listener on the `<ul>` instead of a listener on every delete button?**
Event delegation: clicks bubble from the button up to the list, so one listener handles every current and future item. `e.target.closest("[data-action='delete']")` finds the button even if the click landed on an icon inside it, and `closest("li").dataset.id` says which todo it was. There is no need to attach listeners after each render or remove them when items are deleted, and memory use stays flat however long the list gets.

**Q2. What does debouncing do in the autocomplete, and how is it different from throttling?**
Debouncing waits until the user stops typing for a set time (250 ms here) and then runs once, so typing "london" sends one request instead of six. Throttling runs at most once per interval *while* events keep coming, which suits scroll or resize handlers. For search-as-you-type, debounce is the default; throttle only if results must update during continuous fast typing. Typical delays are 150–300 ms: shorter feels more responsive, longer saves requests.

**Q3. Why build elements with `textContent` and `append()` instead of `innerHTML` and template strings?**
Anything assigned through `innerHTML` is parsed as HTML, so user input such as `<img src=x onerror=alert(1)>` becomes a real element and runs script (XSS). `textContent` and strings passed to `append()` are always plain text. `createElement` also avoids re-parsing HTML and lets you attach properties directly. If you must use `innerHTML`, escape or sanitise every interpolated value, and know that a strict Content Security Policy is the safety net, not the fix.

**Q4. What does `dialog.showModal()` give you that a `<div class="modal">` does not?**
It puts the dialog in the top layer (no z-index battles), makes the rest of the page inert so focus and clicks cannot leave, moves focus inside (to the `autofocus` element), closes on Esc, returns focus to the opener when it closes, exposes the dialog role to assistive technology, and provides `::backdrop` for styling. With a `<div>` you must build each of those by hand, and focus trapping is easy to get wrong. You still add backdrop-click closing and scroll locking yourself.

**Q5. Why are the stars real radio buttons instead of clickable `<span>`s?**
A rating is a single choice from a set, which is exactly what a radio group is. Radios give Tab into the group, arrow keys to change the value, a `change` event for both mouse and keyboard, form submission, and a screen-reader announcement like "3 stars, radio button, 3 of 5". Spans give none of that. Hide the radios visually (not with `display: none`) and style their labels as stars.

**Q6. What can go wrong when the todo app reads and writes `localStorage`, and how does the code handle it?**
The stored value might be missing, corrupt JSON, an old shape from a previous version, or tampered with; `getItem` and `setItem` can throw when storage is disabled; and `setItem` throws when the quota (about 5 MB) is full. The code wraps both in `try/catch`, falls back to an empty list, validates each item's shape, and uses a versioned key (`todos:v1`) so a future format can migrate instead of crashing.

### Mid-level (2–4 years)

**Q7. The autocomplete sometimes shows results for an older query. Why, and how do you fix it?**
Responses can arrive out of order: the request for "lo" may be slower than the later request for "lon" and overwrite its results. Fix it twice. Abort the previous request with an `AbortController` when a new one starts, which saves work and guarantees an aborted promise never resolves. Then, after `await`, compare the query the response belongs to with the current query (or a request counter) and drop it if they differ, which covers APIs that cannot be cancelled and responses that resolve just before the abort. Debouncing reduces the problem but does not solve it.

**Q8. Explain roving tabindex, and when you would use manual activation for tabs.**
In a composite widget (tabs, toolbar, radio group, listbox), only one item has `tabindex="0"` and the rest have `-1`. Tab enters and leaves the widget in one step, and arrow keys move focus between items, updating which one has `0`. Tabs default to automatic activation, where moving focus selects the tab. If showing a panel is expensive (a network request, a heavy chart), use manual activation: arrows move focus only, and Enter or Space selects, so arrowing past three tabs does not fire three requests.

**Q9. Infinite scroll loads the first page and then stops on a tall monitor. Why, and how do you fix it?**
`IntersectionObserver` only calls back when the target's intersection state *changes*. If the first page is too short to push the sentinel off screen, the sentinel stays visible, nothing changes, and no further callback fires. Fix it by re-observing after each successful load (`unobserve` then `observe` queues a fresh initial callback), by checking `getBoundingClientRect()` after appending and loading again in a loop, or by requesting a page size that always fills the viewport. Always keep a "Load more" button as a fallback.

**Q10. After re-rendering a list, keyboard users lose their place. How do you fix it?**
`replaceChildren()` destroys the focused element, so focus falls back to `<body>`. Before rendering, record which item and which control had focus (a stable `data-id` plus a `data-action`). After rendering, focus the matching element in the new DOM, or a sensible fallback (the next item, or the input) if that item is gone. The alternatives are to patch only the changed nodes instead of re-rendering, or to use keyed reconciliation, which is what framework `key` props do.

**Q11. Why does the autocomplete call `preventDefault()` on `mousedown` in the listbox?**
Pressing the mouse on an option normally moves focus out of the input first. The input's `blur` handler closes the list, the option disappears, and the `click` event never lands on it. Cancelling `mousedown` keeps focus in the input, so the list stays open until `click` selects the option. The alternative is delaying the blur-close with a timeout, which is fragile. The same trick keeps focus in a text editor when you click its toolbar buttons.

**Q12. How would you test the autocomplete?**
Unit-test the pure parts (debounce, `highlight()`, the keyboard index logic) with fake timers. Test the component with Testing Library-style queries by role (`getByRole("combobox")`, `getAllByRole("option")`), driving it with typing and arrow keys. Replace the API with controllable promises so a test can resolve "lon" before "lo" and assert the stale result is ignored, and make it reject to cover the error state. Add an automated axe check, and finish with a manual pass using a keyboard and at least one screen reader, because automated tools cannot tell whether announcements make sense.

**Q13. A thread has 2,000 replies. What changes in the nested comments build?**
Do not fetch or render them all. Load top-level comments in pages, include `replyCount` and the first few replies with each comment, and fetch more per thread on demand ("View 37 more replies", using a cursor per parent). Collapse deep branches by default and cap the visual indent. Keep the flat, normalised store so newly loaded pages merge by id without duplicates. Append rather than re-render, and virtualise the top-level list if it is still long. Reply forms must not wipe out loaded state when they open.

### Senior (5+ years)

**Q14. Other teams want to reuse your autocomplete. What API do you design, and what stays internal?**
Expose a factory or a custom element with a narrow API. Inputs: `source(query, { signal }) => Promise<Item[]>`, so callers own fetching (REST, GraphQL or a local array) and cancellation still works; `getLabel(item)`, `renderOption(item)`, `minChars`, `debounceMs` and translatable strings for the status messages. Outputs: a `select` event and a `destroy()` that removes listeners and aborts requests. Theme through CSS custom properties. Keep the ARIA wiring, keyboard handling, stale-response logic and live-region messages internal and non-optional. If teams can switch accessibility off or reimplement races, they will.

Recommendation: ship accessibility and correctness inside, extension points for data and rendering outside, unique ids per instance, and an end-to-end test suite that every release must pass.

**Q15. In production, the feed must restore its scroll position on back navigation, and memory must stay bounded after 2,000 posts. What changes?**
Keep the feed data (normalised posts plus the cursor) in a cache that outlives the page component (memory, or `sessionStorage` for a full reload) and save the scroll anchor, the id of the first visible post plus its offset, rather than a raw `scrollY`, because images above may load at different heights. On return, render from the cache, then scroll the anchor post into place (`history.scrollRestoration = "manual"` if you restore it yourself). For memory, virtualise the list or keep a window of pages: release DOM for pages far off screen, keep their data, and re-render them on the way back. Reserve image space with `aspect-ratio` so the restore lands accurately.

Recommendation: anchor-based restoration plus windowed rendering, measured with a long-session memory test in CI.

**Q16. Your team wants to replace an in-house modal library with native `<dialog>`. How do you plan the migration?**
Native `<dialog>` is in every current browser and removes a lot of fragile focus-trap code. First inventory what the library does that `showModal()` does not: backdrop-click closing, scroll lock, stacked or nested modals, enter and exit animations (now possible with `@starting-style` and `transition-behavior: allow-discrete` in current browsers), and promise-style results. Wrap `<dialog>` in a small shared helper with the same API as the old library, so call sites barely change. Migrate behind a flag one product area at a time, check every converted dialog with keyboard and screen reader, and run dialog tests in a real browser (Playwright), since some test environments do not fully implement `showModal()`.

Recommendation: a thin wrapper over native `<dialog>`, incremental rollout, and a lint rule that bans new uses of the old library.

## References

- [WAI-ARIA APG: Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [WAI-ARIA APG: Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [WAI-ARIA APG: Radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [WAI-ARIA APG: Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [MDN: aria-activedescendant](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-activedescendant)
- [MDN: The dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
- [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [MDN: Window storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
- [MDN: Map.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy)
