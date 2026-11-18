# CSS Variables (Custom Properties)

> CSS · Topic 16 · Demo: [index.html](index.html)

CSS variables, officially called **custom properties**, let you store a value (a colour, a size, a number) once and reuse it everywhere with `var()`. Change the variable in one place and every rule that uses it updates, which makes them the foundation of design systems, theming and dark mode.

## Why use variables?

Without variables, the same colour code or spacing value is repeated in dozens of rules. Changing the brand colour means find-and-replace across the whole stylesheet. With variables:

- A value is defined **once** and reused everywhere.
- A **name** like `--color-primary` explains intent better than `rgb(255, 0, 247)`.
- Values can be **overridden for one part of the page** (a component, a section, a theme).
- They are **live at runtime**: media queries and JavaScript can change them, and the page updates instantly.

## Declaring and using a variable

```css
:root {
  --color: rgb(255, 0, 247);
  --seccolor: rgb(231, 164, 246);
  --defpad: 23px;
  --defop: 0.4;
}

.nav {
  background-color: var(--color);
}

ul li {
  opacity: var(--defop);
  padding: var(--defpad);
  border: 2px solid var(--seccolor);
}

.container {
  background-color: var(--seccolor);
}
```

This is the demo. The rules:

- A custom property name **must start with two dashes**: `--color`, `--defpad`.
- Names are **case-sensitive**: `--Color` and `--color` are two different variables.
- It is declared **inside a rule** (a selector block), like any other property. You cannot write `--color: red;` on its own at the top level of a stylesheet.
- You read it with `var(--name)`. Writing `var(color)` or `color: --color` does not work.
- The value can be almost anything: a colour, a length, a plain number (`0.4`), a list of fonts, even part of a value such as `2px solid`.

## Why `:root`?

`:root` selects the root element of the document, which in HTML is `<html>`. Declaring variables there makes them available to the whole page, because **custom properties are inherited**: every element inherits them from `<html>` unless something closer redefines them.

| | `:root` | `html` |
| --- | --- | --- |
| Selects | the `<html>` element | the `<html>` element |
| Specificity | (0,1,0), a pseudo-class | (0,0,1), a type selector |

Both work. `:root` is the convention for global variables.

## Scope: overriding a variable for part of the page

Because custom properties follow the cascade and inheritance, you can **redefine** a variable on a more specific element. The new value applies to that element and its descendants only.

The demo does exactly this:

```css
ul li:first-child {
  --color: rgb(243, 87, 8);              /* override for this li only */
  background-color: var(--color, blue);  /* uses the orange value */
}
```

- The first `<li>` ("Home") gets an orange background, because inside that element `--color` is now `rgb(243, 87, 8)`.
- `.nav` still uses the pink `rgb(255, 0, 247)`, because the override is scoped to the first `<li>`.
- The other `<li>`s are not affected either: variables flow **down** to descendants, never sideways to siblings or up to parents.

This scoping is what makes variables great for components:

```css
.btn {
  --btn-bg: steelblue;
  --btn-text: white;
  background: var(--btn-bg);
  color: var(--btn-text);
}

.btn.danger  { --btn-bg: crimson; }   /* only the variable changes */
.btn.outline { --btn-bg: transparent; --btn-text: steelblue; }
```

## Fallback values

`var()` accepts a second argument: the value to use if the variable is **not defined**.

```css
background-color: var(--color, blue);
```

- In the demo the fallback `blue` is **never used**, because `--color` is defined (on `:root` and again on the first `<li>`). Delete the `--color` lines and the `<li>` turns blue.
- Everything after the **first comma** is the fallback, commas included:
  ```css
  font-family: var(--font, Arial, Helvetica, sans-serif);
  /* fallback = "Arial, Helvetica, sans-serif" */
  ```
- Fallbacks can be nested:
  ```css
  color: var(--text-color, var(--brand-color, black));
  ```

> **Note:** The fallback is used only when the variable is **missing**, not when its value is wrong for the property. If you write `--defpad: red;` and then `padding: var(--defpad);`, the browser does not use a fallback and does not go back to an earlier `padding` rule. The declaration becomes "invalid at computed-value time" and `padding` falls back to its initial value (`0`), as if you had written `padding: unset`.

## Variables in calculations

Variables work inside `calc()`, which is how you build spacing scales:

```css
:root {
  --space: 8px;
}

.card {
  padding: calc(var(--space) * 2);      /* 16px */
  margin-bottom: calc(var(--space) * 3); /* 24px */
}
```

To store a plain number and add a unit later, multiply by `1` of that unit:

```css
:root { --columns: 4; }

.grid {
  /* var(--columns)px does NOT work: it produces "4 px", two separate tokens */
  width: calc(var(--columns) * 100px);
}
```

## Theming and dark mode

Define the theme as variables and swap the variables, not the rules:

```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --accent: rgb(255, 0, 247);
}

[data-theme="dark"] {
  --bg: #121212;
  --text: #eeeeee;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

Follow the operating-system setting automatically with a media query:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --text: #eeeeee;
  }
}
```

Variables can also change at breakpoints, so every rule that uses them becomes responsive:

```css
:root { --defpad: 12px; }

@media (min-width: 768px) {
  :root { --defpad: 23px; }
}
```

## Reading and writing variables from JavaScript

```js
const root = document.documentElement;   // the <html> element

// read (returns a string; trim it to be safe)
const color = getComputedStyle(root).getPropertyValue('--color').trim();

// write on :root (affects the whole page)
root.style.setProperty('--color', 'tomato');

// write on one element (affects only that subtree)
document.querySelector('.nav').style.setProperty('--color', 'tomato');

// toggle a theme defined with [data-theme="dark"]
root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
```

Unlike Sass variables, which no longer exist after compilation, this works because custom properties are part of the live CSS.

## Where `var()` does not work

| Attempt | Works? | Why / alternative |
| --- | --- | --- |
| `@media (max-width: var(--bp))` | No | Media query conditions are evaluated without element styles. Repeat the value, or use a preprocessor variable. |
| `var(--prop): red;` (variable as a property name) | No | `var()` only works in property **values**. |
| `var()` inside a selector | No | Same reason: selectors are not property values. |
| `background: url(var(--img));` | No | `url(...)` without quotes is read as one token. Store the whole thing instead: `--img: url("bg.png"); background: var(--img);` |
| `transition: --angle 1s;` on a normal variable | Jumps, no animation | Unregistered variables are not interpolated. Register them with `@property` (below). |

## `@property`: typed, animatable variables

`@property` registers a custom property with a type, an initial value and an inheritance rule. Once the browser knows the type, it can animate it.

```css
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.spinner {
  background: conic-gradient(from var(--angle), red, blue);
  transition: --angle 1s;
}

.spinner:hover {
  --angle: 180deg;
}
```

`@property` is supported in all current major browsers.

## CSS variables vs Sass variables

| | CSS custom properties (`--x`) | Sass variables (`$x`) |
| --- | --- | --- |
| When they exist | In the browser, at runtime | Only at compile time, replaced by plain values |
| Scope | Cascade and inheritance (DOM tree) | Lexical (the `{ }` block in the source file) |
| Change with media queries / classes | Yes | No, the value is already baked in |
| Readable/writable from JavaScript | Yes | No |
| Usable in media query conditions | No | Yes |
| Needs a build step | No | Yes |

Many projects use both: Sass for build-time constants such as breakpoints, and custom properties for anything that changes at runtime (themes, component variants).

## Naming tips

The demo's names (`--color`, `--seccolor`, `--defpad`, `--defop`) work but are short and vague. Prefer names that describe the **role**, not the value:

```css
:root {
  --color-primary: rgb(255, 0, 247);
  --color-secondary: rgb(231, 164, 246);
  --padding-default: 23px;
  --opacity-muted: 0.4;
}
```

Avoid names like `--pink`: when the brand colour changes to green, `--pink: green;` is confusing.

## Common Mistakes

- **Forgetting the dashes or `var()`:** `color: --color` or `var(color)` do nothing.
- **Case mismatch:** `--Color` defined, `var(--color)` used.
- **Gluing a unit:** `var(--size)px` is invalid. Store the unit in the variable (`--size: 20px`) or use `calc(var(--size) * 1px)`.
- **Using a variable in a media query condition.** It is ignored.
- **Expecting the fallback to rescue an invalid value.** Fallbacks only cover undefined variables.
- **Defining a variable on one element and using it on a sibling.** Variables only inherit downwards. Define shared ones on a common ancestor or `:root`.
- **Putting everything on `:root` and updating it from JavaScript many times per second** (for example on `mousemove`). Every element inherits from `:root`, so the browser must recalculate styles for the whole page. Set the variable on the smallest element that needs it.

## Key Takeaways

- Declare with `--name: value;` inside a rule and use with `var(--name)`. Names are case-sensitive.
- Variables on `:root` are global because custom properties inherit.
- Redefining a variable on a selector scopes the new value to that element and its descendants. This is the basis of themes and component variants.
- `var(--x, fallback)` uses the fallback only when `--x` is undefined. An invalid value makes the property fall back to `unset`.
- Variables work in `calc()`, can be changed by media queries and JavaScript, and cannot be used in media query conditions, selectors or property names.
- `@property` gives a variable a type, which makes it animatable.

## Interview Questions

### Junior (0–1 year)

**Q1. What are CSS custom properties and how do you declare and use one?**
They are user-defined properties that hold a value for reuse. You declare them with a name starting with `--` inside a rule, such as `:root { --main-color: teal; }`, and use them with `var()`: `color: var(--main-color);`.

**Q2. Why are global variables usually declared on `:root`?**
`:root` is the `<html>` element, the ancestor of every element, and custom properties are inherited. A variable declared there is available everywhere unless it is redefined lower in the tree. `:root` also has higher specificity than `html`.

**Q3. What does `var(--color, blue)` mean and when is `blue` used?**
`blue` is the fallback. It is used only if `--color` is not defined for that element (no declaration on the element or any ancestor). If `--color` is defined, its value is used even when it is invalid for the property (in that case the property behaves as `unset`, not as `blue`).

**Q4. In this code, what background does the first `<li>` get, and what does `.nav` get?**
```css
:root { --color: rgb(255, 0, 247); }
.nav { background-color: var(--color); }
ul li:first-child {
  --color: rgb(243, 87, 8);
  background-color: var(--color, blue);
}
```
The first `<li>` is orange (`rgb(243, 87, 8)`) because it redefines `--color` for itself. `.nav` stays pink because the override applies only to that `<li>` and its descendants. The fallback `blue` is not used.

**Q5. How are CSS variables different from Sass variables?**
CSS variables exist in the browser at runtime: they cascade, inherit, can be changed by media queries, classes and JavaScript, and need no build step. Sass variables are replaced with fixed values at compile time, have lexical scope, and cannot change in the browser. Sass variables can be used in media query conditions and CSS variables cannot.

### Mid-level (2–4 years)

**Q6. How would you implement a light/dark theme toggle with CSS variables?**
Define all theme colours as variables on `:root`, override them in `[data-theme="dark"]` (and optionally in `@media (prefers-color-scheme: dark)`), and make every rule use the variables. The toggle button only flips an attribute: `document.documentElement.dataset.theme = 'dark'`. Save the choice in `localStorage` and apply it before first paint to avoid a flash of the wrong theme.

**Q7. What happens here, and why?**
```css
.box { padding: 10px; }
.box { --gap: red; padding: var(--gap); }
```
The second `padding` wins the cascade, but `red` is not a valid padding. The declaration is "invalid at computed-value time", so `padding` becomes its initial value, `0`. It does not fall back to the `10px` rule, because the cascade had already picked the second declaration before the variable was substituted.

**Q8. Can you use a CSS variable inside a media query condition? What are the alternatives?**
No. `@media (max-width: var(--bp))` is ignored, because media conditions are evaluated against the viewport, not an element, so there is nothing to inherit the variable from. Alternatives are to repeat the literal value, use a preprocessor variable (Sass `$bp`), or use container queries when the layout should depend on the component's size.

**Q9. How do custom properties help build component variants or a design system?**
Components read their visual values from variables (`background: var(--btn-bg)`), and variants or themes only redefine those variables (`.btn.danger { --btn-bg: crimson; }`). Global design tokens (`--color-primary`, `--space-2`) live on `:root`, and components can map them to local variables. This keeps specificity low and lets consumers restyle a component without overriding its internal selectors.

**Q10. You put `transition: --angle 0.5s` on an element but the gradient jumps instead of animating. Why, and how do you fix it?**
An unregistered custom property is treated as an untyped token stream, so the browser cannot interpolate between two values and switches at once. Register it with `@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }`, and the browser can animate it.

**Q11. A feature updates `--mouse-x` on `:root` on every `mousemove`, and the page becomes janky. What would you change?**
Changing a variable on `:root` invalidates styles for every element that inherits it, which is the whole document, on every event. Set the variable on the smallest element that uses it (`card.style.setProperty('--mouse-x', ...)`), throttle updates with `requestAnimationFrame`, and register the property with `inherits: false` via `@property` if descendants do not need it.

### Senior (5+ years)

**Q12. You are structuring the tokens for a design system that must support two brands and light/dark themes. How do you organise the custom properties, and what is the classic trap?**
Use three tiers, and let each tier reference only the one below it:

```css
:root {
  /* 1. Primitives: the raw palette. Components never use these directly. */
  --blue-600: oklch(0.55 0.2 260);
  --gray-50: oklch(0.98 0 0);
  --gray-900: oklch(0.2 0 0);

  /* 2. Semantic tokens: what a value is FOR. Themes and brands remap these. */
  --color-surface: var(--gray-50);
  --color-action-bg: var(--blue-600);
}

[data-theme="dark"] {
  --color-surface: var(--gray-900);
}

.button {
  /* 3. Component tokens: the component's public knobs, defaulting to semantic tokens */
  background: var(--button-bg, var(--color-action-bg));
}
```

The trap: `var()` is substituted where the custom property is **declared**, and the resulting value is what descendants inherit. `--color-action-bg` is computed once on `:root`, so redefining `--blue-600` on a subtree does **not** change `--color-action-bg` inside it. To re-theme a subtree you must redefine the **semantic** tokens on that subtree, which is exactly why components should only read semantic tokens. Recommendation: primitives → semantic → component, themes and brands override only the semantic tier, and the tokens are generated from one source (for example Style Dictionary) so CSS, JS and native apps share them.

**Q13. Custom properties are part of a component's public API. How do you design that API so it is stable, and so a value set for one button does not leak into nested components?**
Expose a short, documented list of knobs (`--button-bg`, `--button-radius`) and read each one **once**, into a private property, with the default in a single place:

```css
.button {
  --_bg: var(--button-bg, var(--color-action-bg));   /* the leading underscore means "internal, don't set" */
  background: var(--_bg);
}
.button:hover {
  background: color-mix(in oklch, var(--_bg) 85%, black);   /* hover derived from the same input */
}
```

Leaking happens because custom properties inherit: `--button-bg` set on a toolbar reaches every button nested inside it, including buttons inside a dropdown. Stop that by registering the public knob as non-inheriting: `@property --button-bg { syntax: "*"; inherits: false; }`. It then applies only to the element it is set on. With the universal syntax `"*"` no `initial-value` is required, so an unset knob still counts as "not defined" and the `var()` fallback keeps working. A typed registration such as `syntax: "<color>"` requires an `initial-value`, and that value would replace your fallback. For web components, custom properties are the main styling channel, because they inherit through the shadow boundary, alongside `::part()`.

Recommendation: treat every public custom property like a function parameter: name it consistently, document it, version it (keep the old name working as a fallback for one major version), and never let consumers depend on the underscore-prefixed internals.

**Q14. The dark theme passed design review, but users report white form controls and scrollbars, a white flash on load, and focus rings that are invisible. What is missing?**
Variables only recolour what your CSS paints. The rest needs:

- **`color-scheme: light dark`** on `:root`, which tells the browser to render native controls, scrollbars and the default canvas in the matching scheme. It also enables `light-dark()` (supported in all current browsers since 2024): `--color-surface: light-dark(#fff, #121212);` keeps both values next to each other.
- **No flash:** `<meta name="color-scheme" content="light dark">` in `<head>` so the canvas is dark before CSS loads, and set the user's saved theme before first paint, with a tiny inline script in `<head>` or a server-rendered `data-theme` read from a cookie.
- **Per-theme contrast:** focus-ring, border and muted-text tokens need their own dark values. Check every foreground/background token pair against WCAG contrast automatically in CI, for each theme.

Recommendation: drive themes from semantic tokens plus `color-scheme`, render the chosen theme on the server where possible, and make contrast checks part of the token build, not a manual design step.

**Q15. You are migrating a large Sass codebase from `$variables` to custom properties. What do you migrate, what do you leave, and what breaks?**
Migrate values that should change at runtime or per context: colours, spacing, radii, typography, anything themed. Leave build-time constants in Sass: breakpoints (custom properties do not work in media conditions) and values used to generate selectors or loops.

What breaks:

- **Sass colour functions** (`darken($brand, 10%)`) cannot run on a runtime value. Replace them with `color-mix(in oklch, var(--brand), black 10%)` or relative colour syntax, `oklch(from var(--brand) calc(l - 0.1) c h)`; both work in all current browsers.
- **Silent failures:** Sass reported type errors at compile time; a wrong custom property value is "invalid at computed-value time" and quietly falls back to the property's initial value. Register key tokens with `@property` and add visual-regression tests.
- **Specificity and order** do not change, but scope does: a Sass variable defined inside a block was lexical, a custom property inherits through the DOM, so a value can now reach places it never did before.

Recommendation: emit both forms during the transition (`--color-brand: #{$color-brand};`), move components over to `var()` one by one with a codemod, and delete the Sass variables only when nothing reads them. See [CSS architecture](../21-css-architecture/notes.md) for how tokens fit into the wider stylesheet structure.

## References

- [MDN: Using CSS custom properties (variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN: var()](https://developer.mozilla.org/en-US/docs/Web/CSS/var)
- [MDN: @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property)
- [MDN: :root](https://developer.mozilla.org/en-US/docs/Web/CSS/:root)
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [MDN: light-dark()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)
