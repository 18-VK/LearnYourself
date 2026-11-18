# CSS Specificity and the Cascade

> CSS · Topic 3 · Demo: [index.html](index.html)

When several CSS rules set the same property on the same element, the browser needs a way to pick one value. That decision process is the **cascade**, and **specificity** is its most important step. Understanding it explains most "why is my CSS not working?" moments. This note covers how specificity is calculated, the full cascade order (origins, `!important`, inline styles, layers, specificity, scope proximity, source order), and the modern tools that change how you manage it: `:is()` and `:where()`, cascade layers (`@layer`), native CSS nesting, `@scope` and `@supports` feature queries.

Link: https://www.codewithharry.com/tutorial/css-specificity/

## What Is Specificity?

CSS specificity helps determine what style will be applied to the HTML element(s) when there are overlapping or multiple CSS rules. It is a value, or weight, assigned to a CSS selector. **The higher the specificity, the more precedence the selector has.**

So, the order of specificity is:

**Inline style > ID selector > Class, attribute or pseudo-class selector > Element or pseudo-element selector > Universal selector**

> **Note:** Only `!important` (in a stylesheet) can override a normal inline style.

## Calculating Specificity

Think of specificity as three separate counters, written **(A, B, C)**:

| Column | What counts | Examples |
|---|---|---|
| **A**: IDs | each ID selector | `#nav` |
| **B**: classes | each class, attribute selector and pseudo-class | `.btn`, `[type="text"]`, `[href]`, `:hover`, `:nth-child(2)` |
| **C**: types | each element (type) selector and pseudo-element | `h1`, `div`, `::before` |
| (nothing) | universal selector and combinators | `*`, ` `, `>`, `+`, `~` |

Inline styles (the `style` attribute) sit above all three columns, and `!important` sits above that.

To compare two selectors, compare column A first; only if A is equal, compare B; only if B is equal, compare C.

| Selector | (A, B, C) |
|---|---|
| `*` | (0, 0, 0) |
| `h1` | (0, 0, 1) |
| `div > p + span` | (0, 0, 3) |
| `.cred` | (0, 1, 0) |
| `[data-x=a]` | (0, 1, 0) |
| `h1.yellow` | (0, 1, 1) |
| `.card::before` | (0, 1, 1) |
| `ul li:first-child` | (0, 1, 2) |
| `a.harryclass.rohan-class[href]:hover` | (0, 4, 1) |
| `#nav .item a` | (1, 1, 1) |
| `style="..."` | inline: beats all of the above |

### The "1 / 10 / 100" shortcut used in the demo

The demo's comments use a common shortcut: element = 1, class = 10, ID = 100, inline = 1000. So `h1.yellow` is "1 + 10 = 11" and the quiz selector `a.harryclass.rohan-class[href]:hover` is "1 + 10 + 10 + 10 + 10 = 41".

This is fine for small numbers, but it is only an approximation: the columns **never carry over**. Eleven classes are (0, 11, 0), which is still lower than one ID (1, 0, 0), even though "110 > 100". Use the (A, B, C) notation to be exact.

## Walking Through the Demo

```html
<h1 class="yellow cred cpurple" data-x="a">CSS Specificity</h1>
```

```css
h1                { color: aqua !important; }  /* (0,0,1) but !important */
.cpurple          { color: purple; }           /* (0,1,0) */
h1.yellow         { color: yellow; }           /* (0,1,1) */
[data-x=a]        { color: maroon; }           /* (0,1,0) attribute selector */
.cred             { color: red; }              /* (0,1,0) */
a.harryclass.rohan-class[href]:hover { color: blueviolet; } /* (0,4,1), does not match an h1 */
```

| Situation | Winner | Why |
|---|---|---|
| As written | **aqua** | `!important` beats every normal declaration, whatever the specificity |
| Remove `!important` | **yellow** | `h1.yellow` (0,1,1) is the most specific matching selector |
| Also remove `h1.yellow` | **red** | `.cpurple`, `[data-x=a]` and `.cred` tie at (0,1,0); `.cred` comes last in the source |
| Also remove `.cred` | **maroon** | `[data-x=a]` now comes last among the tied selectors |

> **Note:** The order of classes inside the `class` attribute (`"yellow cred cpurple"`) makes **no** difference. Only the order of the **rules in the CSS** matters on a tie.

## The Cascade: How the Browser Picks a Winner

For each property on each element, the browser collects every declaration that applies and sorts them by these criteria, in order. It moves to the next step only when there is a tie.

1. **Origin and importance.** Where the style comes from (browser default, user settings, author/your CSS) and whether it is marked `!important`. Normal author styles beat browser defaults; `!important` declarations beat all normal ones.
2. **Context.** Only matters with Shadow DOM: for a component's host element, the page's normal rules beat the component's own `:host` rules, while for `!important` rules the component wins.
3. **Inline styles.** A declaration in the `style` attribute beats any selector-based declaration of the same importance, whatever its layer or specificity.
4. **Cascade layers.** If you use `@layer`, a later layer beats an earlier one, whatever the specificity (styles not in any layer beat all layered styles).
5. **Specificity.** The higher (A, B, C) wins.
6. **Scope proximity.** Only for rules inside `@scope`: when specificity ties, the rule whose scope root is closer to the element wins.
7. **Order of appearance.** If everything else is equal, the declaration that appears **last** wins (later in the file, or in a stylesheet loaded later).

If no declaration applies at all, the property is **inherited** from the parent (for inherited properties like `color`) or takes its **initial** value.

### Origins and importance in full

Step 1 has more detail than "important beats normal". From highest to lowest priority:

| Priority | Origin and importance |
|---|---|
| 1 (highest) | Running CSS transitions |
| 2 | Browser (user-agent) `!important` |
| 3 | User `!important` |
| 4 | Author (your) `!important` |
| 5 | Running CSS animations (`@keyframes`) |
| 6 | Author normal |
| 7 | User normal |
| 8 (lowest) | Browser (user-agent) normal |

Notice that importance **reverses** the origin order: normally your CSS beats the user's, but a user's `!important` (for example an accessibility stylesheet forcing larger text) beats yours. Animations sit above every normal declaration, which is why an animated property ignores normal rules while the animation runs.

### Specificity vs inheritance

An inherited value has **no** specificity. Any rule that targets the element directly beats it, no matter how weak that rule's selector is.

```html
<div id="main">
  <p>What color am I?</p>
</div>
```

```css
#main { color: red; }    /* (1,0,0), but it targets the div, not the p */
p     { color: blue; }   /* (0,0,1), targets the p directly */
```

The paragraph is **blue**. The red would only reach the `<p>` through inheritance, and inheritance is used only when nothing targets the element.

## `!important`

```css
p {
  color: red !important;
}
```

- It lifts a declaration above all normal declarations, including inline styles.
- When two `!important` declarations compete, specificity and then source order decide between them.
- An inline `style="color: blue !important"` beats `!important` in a stylesheet.
- With cascade layers, the order is **reversed** for important declarations: `!important` in an earlier layer beats `!important` in a later layer (see [Cascade layers](#cascade-layers-layer)).

`!important` is a sledgehammer. Each use forces the next override to use `!important` too ("specificity wars"). Acceptable uses: utility classes that must always win (`.hidden { display: none !important; }`), overriding third-party inline styles you cannot change, and user accessibility stylesheets.

## Selectors with Special Specificity Rules

| Selector | Specificity |
|---|---|
| `*` (universal) | (0, 0, 0) |
| Combinators (` `, `>`, `+`, `~`) | add nothing |
| `:is(...)`, `:not(...)`, `:has(...)` | the specificity of their **most specific** argument: `:not(#id)` counts as (1, 0, 0) |
| `:where(...)` | always (0, 0, 0) |
| Pseudo-elements (`::before`) | count in column C, like an element |
| Nested rules (`&`) | like `:is()` around the parent selector list (see [Native CSS nesting](#native-css-nesting)) |

### `:is()` vs `:where()`

Both take a selector list and match an element that matches any selector in it, which shortens repetitive selectors. They match **exactly the same elements**; the only difference is specificity.

```css
:is(#sidebar, .widget) a  { color: teal; }   /* (1,0,1) for every match, even links inside .widget */
:where(#sidebar, .widget) a { color: teal; } /* (0,0,1): only the a counts */
```

| | `:is()` | `:where()` |
|---|---|---|
| Specificity | the most specific argument, applied to every match | always zero |
| Invalid entry in the list | ignored (forgiving list) | ignored (forgiving list) |
| Can contain pseudo-elements | no | no |
| Typical use | shorter selectors that should keep normal weight | resets, base styles, library defaults that must be easy to override |

The `:is()` rule has a trap: the strongest argument applies even when the element matched through a weaker one, so `:is(#sidebar, .widget) a` is hard to override for links in `.widget` too. Keep IDs out of `:is()` lists.

## Cascade Layers (`@layer`)

Cascade layers let you decide priority by **layer** instead of by selector strength. They are supported in all major browsers since 2022.

```css
/* 1. Declare the order once, as early as possible. First = lowest priority. */
@layer reset, vendor, base, components, utilities;

/* 2. Put rules into layers in any order; the declaration above decides priority. */
@layer base {
  a { color: blue; }
}

@layer components {
  .btn { color: white; }      /* beats anything in base, regardless of specificity */
}

@layer reset {
  #app a { color: inherit; }  /* (1,0,1), but reset is the lowest layer, so it loses to base */
}

/* 3. Unlayered rules beat every layer. */
a { text-decoration: underline; }
```

Rules to remember:

- **Layer order is fixed by first appearance.** A layer's position is set the first time its name appears, so write the `@layer a, b, c;` statement first, before any layer blocks or imports.
- **Unlayered styles win over all layered styles** (for normal declarations). This makes migration easy: existing CSS that is not in a layer keeps winning.
- **`!important` reverses the order.** For important declarations, earlier layers beat later ones, and unlayered `!important` is the weakest. A reset layer can therefore protect a rule with `!important` that no later layer can undo.
- **Nested layers** are written `@layer framework { @layer base { ... } }` and referred to as `framework.base`. Rules directly in `framework` beat its nested layers.
- **Anonymous layers** (`@layer { ... }`) have a position but no name, so nobody can add to them later.
- **`revert-layer`** rolls a property back to the value it would have from the previous layers: `.btn { color: revert-layer; }`.

### Layering third-party CSS

Import a library into a low layer so your normal, unlayered or later-layer styles beat it without matching its specificity:

```css
@layer vendor, components;
@import url("bootstrap.css") layer(vendor);

@layer components {
  .btn { border-radius: 0; }  /* beats Bootstrap's .btn rules, even more specific ones */
}
```

`@import` must come before other rules (only `@charset` and `@layer` statements may precede it). If a library uses `!important`, the reversal means its important rules in the low `vendor` layer will beat your later-layer important rules; only `!important` in an earlier layer can override them.

## Native CSS Nesting

CSS now supports nesting rules inside rules, like Sass, without a build step. It is supported in all major browsers since 2023; the relaxed syntax that lets a nested selector start with a tag name or class without `&` arrived in December 2023.

```css
.card {
  padding: 1rem;

  & .title { font-weight: bold; }  /* .card .title */
  .title   { font-weight: bold; }  /* same: & is optional before a descendant selector */
  &:hover  { box-shadow: 0 2px 8px rgb(0 0 0 / 0.2); }  /* .card:hover */
  &.featured { border-color: gold; }                    /* .card.featured (no space) */
  .theme-dark & { background: #222; }                   /* .theme-dark .card */

  @media (width >= 768px) {
    padding: 2rem;                                      /* nested media query */
  }
}
```

- `&` stands for the parent selector. Without `&`, a nested selector is treated as a descendant (`.card .title`).
- `&:hover` and `& :hover` are different, exactly like `.card:hover` and `.card :hover`.

### Specificity of nested rules

`&` behaves like `:is()` wrapped around the parent selector list. For a single parent selector, that is the same as Sass. For a list, it is not:

```css
#app, .page {
  .title { color: red; }
}
/* Native CSS: :is(#app, .page) .title  ->  (1,1,0) for every .title, even inside .page */
/* Sass output: #app .title, .page .title  ->  (1,1,0) and (0,2,0) */
```

### Differences from Sass

- **No string concatenation.** In Sass, `.block { &__title { } }` produces `.block__title`. In native CSS, `&` is a whole selector, not text, so this BEM pattern does not work. Write `.block__title` as its own rule.
- The browser handles nesting itself, so DevTools shows the rules as you wrote them, and the CSS you ship is not inflated by repeated parent selectors.

## `@scope`

`@scope` limits rules to a subtree of the DOM, and optionally stops them at an inner boundary (a "donut scope"):

```css
@scope (.card) to (.card__content) {
  img { border-radius: 8px; }  /* images in a .card, but not inside .card__content */
  :scope { padding: 1rem; }    /* :scope is the .card itself */
}
```

```html
<style>
  @scope {               /* no prelude: scoped to this <style>'s parent element */
    p { color: gray; }
  }
</style>
```

- The scope root does **not** add specificity: `img` inside `@scope (.card)` is still (0, 0, 1). Writing `:scope` in the selector adds (0, 1, 0) like any pseudo-class; writing `&` adds the specificity of the root selector itself.
- **Scope proximity** is a new cascade step after specificity: if two scoped rules tie on specificity, the one whose scope root is fewer DOM levels away wins. That fixes the classic "nested light theme inside dark theme" problem, where source order used to decide.
- The "to" boundary is what BEM naming or CSS Modules cannot express: a component's styles stop where its slotted or user-provided content starts.

> **Note:** Browser support is the catch. Chromium-based browsers support `@scope` since version 118 (2023) and Safari since 17.4 (2024); Firefox was the last engine to work on it and kept it behind a flag for a long time. Check MDN's compatibility table for the browsers you must support, and treat `@scope` as an enhancement, not your only isolation mechanism.

## `@supports` Feature Queries

`@supports` applies rules only if the browser supports a property-value pair or a selector:

```css
.gallery { display: flex; flex-wrap: wrap; }   /* fallback for every browser */

@supports (display: grid) {
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
}

@supports not (aspect-ratio: 1) {
  .thumb { padding-top: 100%; }                 /* old aspect-ratio hack only where needed */
}

@supports (backdrop-filter: blur(4px)) or (-webkit-backdrop-filter: blur(4px)) {
  .dialog {                                          /* see-through only if the blur works */
    background: rgb(255 255 255 / 0.6);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }
}

@supports selector(:has(a)) {
  .card:has(img) { padding-top: 0; }
}
```

```js
CSS.supports("display", "grid");          // → true
CSS.supports("selector(:has(a))");        // → true in current browsers
```

- You often do not need it: the browser already ignores declarations it does not understand, so `display: flex; display: grid;` falls back by itself. Use `@supports` when several declarations must change **together** (a grid layout plus removing the flex fallback's margins), or when a new feature needs a different fallback.
- It tests whether the browser *parses* the feature, not whether the implementation is complete or bug-free.
- `@supports` does not change specificity; rules inside it cascade normally.

## Another Example from the Notes

This rule was saved in the original notes:

```css
div > button {
  border-radius: 1em;
  border: 2px rgba(0, 0, 255, 0.244);
  /* margin: 40%;
  padding: 10px; */
  background-color: rgba(0, 140, 255, 0.452);
  color: rgba(0, 0, 255, 0.612);
  font-weight: bolder;
  text-align: center;
}
```

- Specificity: two type selectors, so (0, 0, 2). The `>` combinator adds nothing.
- It beats a plain `button { ... }` rule (0, 0, 1) but loses to any class such as `.btn` (0, 1, 0).

> **Note:** `border: 2px rgba(...)` has no border style. A shorthand resets every part you leave out to its initial value, and the initial `border-style` is `none`, so this rule actually **removes** the button's default border. Write `border: 2px solid rgba(0, 0, 255, 0.244);` to get a visible border.

## Managing Specificity in Real Projects

- **Prefer classes** for styling; keep most selectors at (0, 1, 0) or (0, 2, 0).
- **Avoid IDs in CSS**; they are hard to override.
- **Avoid deep nesting** like `.page .sidebar ul li a`, whether written out or with native nesting. Flat naming (for example BEM: `.sidebar__link`) keeps specificity low and even.
- **Use `:where()`** for resets and base styles so anything can override them.
- **Use `@layer`** to set priority by layer instead of by selector strength: declare `@layer reset, vendor, base, components, utilities;` once, and import third-party CSS into a low layer.
- **Use `@supports`** for feature-dependent groups of declarations, and keep a working fallback outside it.
- **Lint it**: Stylelint rules such as `selector-max-specificity`, `selector-max-id` and `declaration-no-important` stop regressions.

## Common Mistakes

- **Thinking the order of class names in HTML matters.** It does not; only the order of rules in CSS matters.
- **Adding up columns as decimal numbers** and concluding many classes beat an ID.
- **Counting combinators or `*`.** They add nothing.
- **Expecting a strong selector on a parent to beat a weak selector on the child.** Inherited values lose to any direct rule.
- **Reaching for `!important` first.** Check the winning rule in DevTools and fix the cause instead.
- **Forgetting that the last rule wins on a tie**, including rules from a stylesheet linked later.
- **Putting IDs inside `:is()`**, which gives every match ID-level specificity.
- **Assuming layered styles beat unlayered ones.** It is the opposite: unlayered normal styles beat every layer.
- **Declaring layer order too late.** A layer's position is fixed where its name first appears, so a stray `@layer components { }` before the order statement changes the order.
- **Writing Sass-style `&__element` in native CSS.** `&` is not text; the rule does not produce `.block__element`.

## Key Takeaways

- Specificity is compared column by column: IDs (A), then classes/attributes/pseudo-classes (B), then elements/pseudo-elements (C). Inline styles beat any selector; `!important` beats inline styles.
- The full cascade order is: origin and importance, context (Shadow DOM), inline, layers, specificity, scope proximity, source order. On a full tie, the rule that appears last wins.
- `!important` reverses the origin order (user important beats author important) and the layer order (earlier layers win).
- Inherited values have no specificity; any direct rule overrides them.
- `:where()` has zero specificity; `:is()`, `:not()` and `:has()` take their strongest argument. Native nesting's `&` behaves like `:is()`.
- Unlayered styles beat all layers; import third-party CSS into a low layer instead of fighting its specificity.
- `@scope` adds donut scoping and proximity but is not yet safe as the only tool everywhere; `@supports` groups declarations that need a feature.
- Keep specificity low and flat; use `@layer` and `:where()` instead of `!important`.

## Interview Questions

### Junior (0–1 year)

**Q1. What is CSS specificity?**
Specificity is the weight the browser gives a selector to decide which declaration wins when several rules set the same property on the same element. More specific selectors (IDs over classes over element names) win. It is one step in the cascade, after importance and before source order.

**Q2. Rank these from highest to lowest priority: element selector, inline style, class selector, ID selector, `!important`.**
`!important`, then inline style, then ID selector, then class selector, then element selector. Attribute selectors and pseudo-classes rank with classes, pseudo-elements rank with elements, and the universal selector `*` has zero specificity.

**Q3. Calculate the specificity of `#nav .item a`, `ul li:first-child` and `.card::before`.**
`#nav .item a` is (1, 1, 1): one ID, one class, one element. `ul li:first-child` is (0, 1, 2): one pseudo-class and two elements. `.card::before` is (0, 1, 1): one class and one pseudo-element.

**Q4. Two rules have exactly the same specificity. Which one is applied?**
The one that appears later in the CSS source order. This includes order across files: a stylesheet linked after another one wins ties. The order of class names in the HTML `class` attribute does not matter.

**Q5. What color is the heading?**

```html
<h1 class="yellow cred" data-x="a">Title</h1>
```

```css
h1.yellow  { color: yellow; }
[data-x=a] { color: maroon; }
.cred      { color: red; }
```

Yellow. `h1.yellow` is (0, 1, 1), higher than `[data-x=a]` and `.cred`, which are both (0, 1, 0). Source order would only matter between the two tied selectors.

**Q6. How can you override an inline style from a stylesheet?**
Only with `!important`, for example `.box { color: red !important; }`. Specificity alone can never beat an inline style. The better fix is usually to remove the inline style or move it into a class.

### Mid-level (2–4 years)

**Q7. Does a selector with 11 classes beat a selector with one ID?**
No. Specificity columns do not carry over: (0, 11, 0) is compared to (1, 0, 0) by the first column, and 1 ID wins. The "class = 10, ID = 100" shortcut is only a mental approximation and gives the wrong answer here.

**Q8. What is the difference between `:is()` and `:where()`, and when would you use each?**
Both match any selector in their list, and both use a forgiving selector list (an invalid entry is ignored instead of breaking the rule). The difference is specificity: `:is()` takes the specificity of its most specific argument, so `:is(#a, .b) p` counts as (1, 0, 1) even when it matches through `.b`; `:where()` always counts as zero. Use `:where()` for resets, base styles and library defaults that consumers should override easily, and `:is()` when you just want a shorter selector with normal weight (keeping IDs out of the list).

**Q9. A parent has `#main { color: red; }` and its child paragraph has `p { color: blue; }`. Which color does the paragraph get, and why?**
Blue. Specificity only compares declarations that apply to the same element. `#main` targets the parent; the paragraph would only receive red through inheritance, and inherited values are used only when no rule targets the element directly. Even `#main { color: red !important; }` would not change this.

**Q10. How do cascade layers change the cascade, and how does `!important` interact with them?**
`@layer` groups styles into named layers whose order is decided by declaration order (for example `@layer reset, base, components;`). For normal declarations, a later layer wins over an earlier one regardless of specificity, and unlayered styles beat all layers. For `!important` declarations the order is reversed: important styles in earlier layers win and unlayered important styles are the weakest, which lets a reset layer protect critical rules.

**Q11. Your styles for a button are being overridden by a third-party UI library. How do you fix it cleanly?**
First inspect the button in DevTools to see which selector wins and why (specificity, order or `!important`). Then fix it with the least force: load your stylesheet after the library, match or slightly raise specificity (for example `.app .btn`), or import the library into a low-priority layer with `@import url("lib.css") layer(vendor);` so any unlayered rule of yours wins. Use `!important` only as a last resort, and document why.

**Q12. A team's CSS is full of `!important` and long selectors. How would you improve maintainability?**
Introduce a naming convention with single-class selectors (such as BEM or utility classes) so specificity stays flat. Move resets and base styles into `:where()` or low cascade layers, and define a layer order like `reset, base, components, utilities`. Remove `!important` gradually, keeping it only for deliberate utilities, and add a linter rule (for example `selector-max-specificity` or `declaration-no-important` in Stylelint) to stop regressions.

**Q13. What is the specificity of the nested `.title` rule below, and how does it differ from Sass?**

```css
#app, .page {
  .title { color: red; }
}
```

Native nesting treats the parent list like `:is(#app, .page)`, so the rule is `:is(#app, .page) .title` with specificity (1, 1, 0) for every `.title`, including those inside `.page`. Sass would output two selectors, `#app .title` (1, 1, 0) and `.page .title` (0, 2, 0). The practical consequence: after moving from Sass to native nesting, rules nested under mixed selector lists can become harder to override. Also, Sass's `&__title` concatenation does not exist natively.

**Q14. When do you need `@supports`, given that browsers already ignore unknown declarations?**
Single declarations fall back on their own (`display: flex; display: grid;`). `@supports` is for groups of declarations that must change together, for example switching to a grid layout and also removing the margins the flex fallback needed, or for applying a fallback only where a feature is missing (`@supports not (aspect-ratio: 1)`). `@supports selector(:has(a))` does the same for selectors, and `CSS.supports()` gives the same check in JavaScript. It only tests whether the browser parses the feature, not whether its implementation is bug-free.

### Senior (5+ years)

**Q15. How would you introduce cascade layers into a large existing codebase without a big-bang rewrite?**
Use the fact that unlayered styles beat all layers. Plan:

1. Add the order statement once, in the first stylesheet that loads: `@layer reset, vendor, legacy, base, components, utilities;`.
2. Import third-party CSS into `vendor` (`@import url(...) layer(vendor)`), so your code beats it without specificity hacks.
3. Leave existing CSS unlayered at first, so nothing changes visually. Then move it into `legacy` file by file; once it is layered, new code in `components` and `utilities` beats it regardless of its old high specificity.
4. Audit `!important` before moving each file, because the reversal changes who wins: an `!important` that moves into the early `legacy` layer will beat important rules in later layers.

Back each step with visual regression tests. Recommendation: migrate in this order (order statement, vendor, legacy wrap, new layers) and treat `!important` as the main risk to review.

**Q16. You maintain a design system's CSS that many product teams consume. How do you make it easy to customise without specificity wars?**
The library should be the weakest thing in the consumer's cascade and should offer explicit customisation points:

- Ship it in a named layer (`@layer ds { ... }`, or document `@import url(ds.css) layer(ds)`), so any unlayered consumer rule beats it.
- Keep selectors flat and single-class, and wrap base element styles in `:where()` so their specificity is zero.
- Expose theming through custom properties (`--ds-button-bg`) rather than asking consumers to override internal selectors.
- Never use `!important` in the library: with layers, an important rule in the library's layer would beat the consumer's important rules.

Recommendation: layer plus low specificity plus custom properties as the public API, documented with the layer name and the list of supported properties, and treat any change to them as a breaking change.

**Q17. A component looks right in development but different in production, and no CSS changed. What do you suspect?**
A change in **source order**. Many teams rely, without realising it, on equal-specificity rules from different files resolving by load order. In development, the bundler may inject styles per module in import order; in production, CSS is extracted, split into chunks and concatenated, and code splitting or a new lazy-loaded route can change the order chunks load. Two `.btn` rules of equal specificity then swap winners. Confirm it in DevTools by comparing the winning rule and its source file in both environments.

Fixes: do not let correctness depend on cross-file order. Give conflicting rules a deliberate priority with `@layer` (layer order is fixed by the order statement, not by load order), or make the override more specific on purpose. Recommendation: put an `@layer` order statement in the entry CSS and require component overrides to live in a later layer, so chunk ordering can no longer change the result.

**Q18. Would you adopt `@scope` today for component styling? What does it give you that BEM or CSS Modules do not?**
BEM and CSS Modules prevent your styles from leaking out by making class names unique, but they cannot stop at an inner boundary and they resolve nested themes by source order. `@scope` adds two things: donut scoping (`@scope (.card) to (.card__content)` stops styles at slotted or user content) and proximity (the nearest scope root wins on a tie, which fixes nested light/dark themes). It does not keep outside styles out; that still needs Shadow DOM.

The deciding factor is support: Chromium and Safari have it, while Firefox was the last engine to work on it, so check the current compatibility data against your browser matrix. Recommendation: keep your existing naming or CSS Modules as the primary isolation tool, use `@scope` as a progressive enhancement where donut scoping or proximity solves a real problem, and make sure the unscoped fallback is acceptable.

## References

- [CodeWithHarry: CSS Specificity](https://www.codewithharry.com/tutorial/css-specificity/)
- [MDN: Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)
- [MDN: Introducing the CSS cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade)
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [MDN: :is()](https://developer.mozilla.org/en-US/docs/Web/CSS/:is)
- [MDN: :where()](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)
- [MDN: CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting)
- [MDN: @scope](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope)
- [MDN: @supports](https://developer.mozilla.org/en-US/docs/Web/CSS/@supports)
- [web.dev: Learn CSS - The cascade](https://web.dev/learn/css/the-cascade)
- [web.dev: Learn CSS - Specificity](https://web.dev/learn/css/specificity)
- [web.dev: Learn CSS - Cascade layers](https://web.dev/learn/css/layers)
