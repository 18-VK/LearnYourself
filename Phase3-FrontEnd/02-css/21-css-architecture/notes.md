# CSS Architecture at Scale

> CSS · Topic 21 · Demo: [index.html](index.html) · Open index.html in a browser and inspect the cascade layers in the DevTools Styles panel

Every CSS rule lives in one global namespace and competes with every other rule through specificity and source order. That is fine for a ten-page site and painful for an application with hundreds of components and several teams, where styles leak, overrides escalate and nobody dares delete anything. CSS architecture is the set of conventions and tools that keep styles predictable as a codebase grows: naming methodologies such as BEM, build-time scoping with CSS Modules, utility-first frameworks such as Tailwind, CSS-in-JS, design tokens, cascade layers, native scoping with `@scope` and Shadow DOM, and linting. This note explains what problem each one solves, what it costs, and how to choose.

## Why CSS Gets Hard at Scale

| Problem | What it looks like in a big codebase |
|---|---|
| **Global namespace** | Two teams both write `.title` or `.active`; one change restyles a page the author never opened. |
| **Specificity wars** | To beat `.sidebar .nav a`, someone writes `#app .sidebar .nav a`, then someone else adds `!important`. Each fix makes the next override harder. |
| **Source-order dependence** | Two rules with equal specificity: the later one wins. With code-split CSS, "later" depends on which route loaded first, so a bug appears only after a certain navigation path in production. |
| **Dead code** | Nobody can prove a selector is unused (class names built in JavaScript, HTML from a CMS), so nothing is deleted and the stylesheet only grows. |
| **Coupling to markup** | Descendant selectors like `.card div > p` break when someone wraps an element in a new `<div>`. |
| **Inconsistent values** | Forty shades of grey and twelve different paddings, because each feature picked its own. |

Every approach below attacks some of these problems. None attacks all of them, which is why real projects combine several (for example tokens + layers + CSS Modules + Stylelint).

## Naming Methodologies

A naming methodology solves the global-namespace and specificity problems **by convention**: if every class name is unique and every selector is a single class, collisions and specificity wars mostly disappear. Nothing enforces it except discipline and linting.

### BEM (Block, Element, Modifier)

| Part | Meaning | Syntax | Example |
|---|---|---|---|
| Block | A standalone, reusable component | `.block` | `.card`, `.search-form` |
| Element | A part of a block that has no meaning on its own | `.block__element` | `.card__title`, `.search-form__input` |
| Modifier | A variant or state of a block or element | `.block--modifier`, `.block__element--modifier` | `.card--featured`, `.button--size-large` |

```html
<article class="card card--featured">
  <img class="card__image" src="..." alt="...">
  <h2 class="card__title">Title</h2>
  <a class="card__link card__link--disabled" href="...">Read more</a>
</article>
```

```css
.card { padding: 1rem; border-radius: 8px; }
.card__title { font-size: 1.25rem; }
.card--featured { border: 2px solid gold; }
.card__link--disabled { opacity: 0.5; pointer-events: none; }
```

The rules that make BEM work:

- **One class per selector.** Every rule has specificity (0, 1, 0), so source order inside a component is the only tie-breaker and overriding never escalates.
- **No element chains.** Elements belong to the block, not to other elements: `.card__title`, not `.card__body__title`. The DOM can be nested deeply; the class names stay flat.
- **A modifier sits next to the base class.** `class="card card--featured"`, never `card--featured` alone, so the modifier only describes the difference.
- **A block doesn't position itself.** Outer `margin`, `width` and `position` belong to whoever places the block. Use a **mix** (two blocks' classes on one element) for that: `<article class="card search-results__item">`, where `.search-results__item` sets the spacing.
- The one accepted nesting is a block modifier styling its elements: `.card--featured .card__title { ... }`.

```css
/* ❌ couples CSS to the DOM structure and raises specificity */
.card div h2 { font-size: 1.25rem; }
.sidebar .card .card__title { color: red; }

/* ✅ flat, unique, independent of nesting */
.card__title { font-size: 1.25rem; }
.card__title--danger { color: red; }
```

> **Note:** Sass lets you write `&__title` inside `.card { }` to produce `.card__title`. Native CSS nesting does **not** concatenate strings: `&__title` doesn't produce `.card__title`. With native nesting, write the full class names.

States are often written as SMACSS-style `is-` classes (`.is-open`, `.is-active`) or, better for accessibility, as ARIA attribute selectors that style the real state: `.accordion__button[aria-expanded="true"]`. That keeps the visual state and the accessible state from drifting apart.

### OOCSS, SMACSS and ITCSS (briefly)

| Methodology | Core idea | What survives today |
|---|---|---|
| **OOCSS** (Object-Oriented CSS, Nicole Sullivan) | Separate structure from skin (layout vs colours) and container from content (styles don't depend on where an element sits). The "media object" is the classic example. | Reusable layout primitives (stack, cluster, sidebar), and the idea behind utility classes. |
| **SMACSS** (Jonathan Snook) | Sort rules into categories: Base, Layout (`l-` prefix), Module, State (`is-` prefix), Theme. | `is-open`/`is-active` state classes; thinking in categories. |
| **ITCSS** (Inverted Triangle CSS, Harry Roberts) | Order the whole stylesheet from generic and far-reaching to specific and local: Settings, Tools, Generic, Elements, Objects, Components, Utilities. Specificity rises only as you go down. | Exactly the order you now express with cascade layers. |

Newer variations (for example CUBE CSS: Composition, Utility, Block, Exception) mix these ideas with utilities and lean on the cascade instead of fighting it. The common thread is the same: decide **where** each kind of rule lives and keep specificity low and predictable.

## CSS Modules

CSS Modules solve the namespace problem **at build time** instead of by convention. Each `.module.css` file is local by default: the bundler (Vite, webpack, Next.js and others support it out of the box) rewrites every class name to a unique one and gives you an object that maps the original names to the generated ones.

```css
/* Card.module.css: short names, no prefixes needed */
.card { padding: 1rem; border-radius: 8px; }
.title { font-size: 1.25rem; }
.featured { border: 2px solid gold; }
```

```jsx
import styles from './Card.module.css';

export function Card({ title, featured }) {
  return (
    <article className={featured ? `${styles.card} ${styles.featured}` : styles.card}>
      <h2 className={styles.title}>{title}</h2>
    </article>
  );
}
// rendered HTML: <article class="Card_card__x7a2b"> (the exact format depends on the bundler)
```

| Strength | Limitation |
|---|---|
| Collisions are impossible between modules, without any naming rules | Element selectors (`h2 { }`) and anything inside `:global(...)` are still global |
| Plain CSS: no runtime cost, all CSS features work | Two module classes on one element with equal specificity still depend on load order |
| Styles are co-located with the component; deleting the component deletes its CSS | Dynamic values need class toggles or custom properties |
| Unused classes are easy to spot (editor and TypeScript plugins) | Global concerns (reset, tokens, typography) still need a non-module stylesheet |

`composes: base from './shared.module.css';` reuses another module's class, and `:global(.some-library-class)` is the escape hatch for styling things you don't control.

## Utility-First CSS (Tailwind)

Utility-first CSS styles elements with many small single-purpose classes instead of component classes:

```html
<article class="rounded-lg bg-white p-4 shadow-sm md:p-6">
  <h2 class="text-xl font-semibold text-gray-900">Title</h2>
  <a class="text-blue-600 hover:underline focus-visible:outline-2" href="...">Read more</a>
</article>
```

Tailwind scans your source files and generates CSS only for the classes it finds, so the stylesheet stays small and stops growing with the codebase. Every class maps to a value on a design scale (`p-4` is a spacing step, `text-blue-600` a palette entry), so the scale works as a set of design tokens. Tailwind v4 (released in 2025) is configured in CSS with an `@theme` block that defines those tokens as custom properties, and it puts its output into native cascade layers.

| Pros | Cons |
|---|---|
| No naming, no new CSS file per component; fast to build UI | Long class lists make markup noisy and diffs harder to review |
| Local reasoning: the styles are on the element you're reading | Repetition unless you extract components (a `Button` component, not copied class lists) |
| No dead CSS: unused utilities are never generated, and deleting markup deletes its styles | A parallel vocabulary to learn on top of CSS |
| Consistency: values come from a constrained scale | Arbitrary values (`w-[317px]`) let the scale erode if not reviewed |
| Responsive, state and dark-mode variants inline (`md:`, `hover:`, `dark:`) | Class names must appear as complete strings in the source: `` `bg-${color}-500` `` is never generated |
| Small, cacheable CSS that plateaus in size | Styling HTML you don't control (CMS content, Markdown) needs a separate approach (for example a typography plugin) |

> **Note:** In `class="p-2 p-4"`, the order of classes in the attribute is irrelevant. Both rules have the same specificity, so whichever comes later **in the generated CSS** wins. Component APIs that accept extra classes therefore use a merge helper (such as `tailwind-merge`) that removes the conflicting class.

The honest summary: utility-first is very productive for product teams building UI in a component framework, and it scales well **because** components, not class strings, become the unit of reuse. It is a poor fit for content-heavy sites with HTML from a CMS and for teams that won't extract components.

## CSS-in-JS

CSS-in-JS means writing styles in JavaScript or TypeScript, next to the component. There are two very different families.

**Runtime CSS-in-JS** (styled-components, Emotion): styles are template literals or objects evaluated **in the browser while rendering**. The library serialises them, hashes them into class names, and injects `<style>` rules into the document.

```jsx
const Button = styled.button`
  padding: 0.5rem 1rem;
  background: ${(props) => (props.$primary ? 'royalblue' : 'white')};
`;
```

It gave automatic scoping, co-location and props-driven dynamic styles, and it dominated React styling for years. It has fallen out of favour for concrete reasons:

- **Runtime cost**: the library ships to every user, and styles are serialised and inserted during render. Inserting rules forces style recalculation, which shows up as slower interactions on large pages.
- **React Server Components**: server components can't use context, state or effects, which runtime libraries depend on (for example a `ThemeProvider`). Every styled component has to become a client component, which defeats the point of server components.
- **Streaming SSR**: the server sends HTML in chunks, so the library has to collect and flush the right styles with each chunk. React 18 added `useInsertionEffect` specifically for these libraries, but the integration stays complex and fragile.
- styled-components itself announced in 2025 that it is in maintenance mode.

**Zero-runtime CSS-in-JS** (vanilla-extract, Linaria, Panda CSS, StyleX from Meta): you still write styles in TypeScript, but a compiler extracts them into static `.css` files at build time. You keep type safety, typed tokens and co-location; the browser gets plain CSS with no runtime. Dynamic values go through CSS custom properties.

```ts
// button.css.ts (vanilla-extract): runs at build time, outputs a .css file
import { style } from '@vanilla-extract/css';

export const button = style({
  padding: '0.5rem 1rem',
  background: 'royalblue',
  ':hover': { background: 'navy' },
});
```

| | Runtime CSS-in-JS | Zero-runtime CSS-in-JS |
|---|---|---|
| When styles are generated | In the browser, during render | At build time |
| JavaScript shipped for styling | The library plus style objects | None (or a tiny helper) |
| Works in React Server Components | No (client components only) | Yes |
| Dynamic styles from props | Any value, at runtime | Variants, or values through custom properties |
| Examples | styled-components, Emotion | vanilla-extract, Linaria, Panda CSS, StyleX |

## Design Tokens and Custom Properties

A **design token** is a named design decision: a colour, a spacing step, a font size, a radius, a shadow, a motion duration. Tokens are usually stored in a platform-neutral format (JSON, increasingly the W3C Design Tokens Community Group format) and transformed by a tool such as Style Dictionary into CSS custom properties, iOS and Android values, and documentation. On the web, the delivery format is custom properties (see [CSS Variables](../16-custom-properties/notes.md)).

Large systems use three tiers:

| Tier | Example | Used by |
|---|---|---|
| Primitive (raw palette and scale) | `--blue-600`, `--space-4` | Only the semantic tier |
| Semantic (meaning) | `--color-accent`, `--color-surface`, `--color-text-muted` | Components |
| Component (public API of one component) | `--card-accent`, `--button-bg` | The component itself, and consumers who customise it |

```css
:root {
  --blue-600: #2563eb;               /* primitive */
  --color-accent: var(--blue-600);   /* semantic */
}

[data-theme="dark"] {
  --color-accent: #60a5fa;           /* a theme swaps semantic tokens only */
}

.card {
  --card-accent: var(--color-accent);   /* component token with a default */
  border-top: 4px solid var(--card-accent);
}

.card--featured {
  --card-accent: crimson;               /* a variant changes the token, not the property */
}
```

Why the tiers matter: theming, dark mode and white-labelling change only the semantic layer, and no component CSS is touched. Component tokens give consumers a supported way to customise (`--card-accent`) instead of overriding internal properties with higher specificity. Custom properties also inherit through Shadow DOM boundaries, which makes them the standard theming API for web components.

## Cascade Layers as an Architecture Tool

`@layer` lets you decide the priority of whole groups of rules **up front**, independent of specificity and file order. The mechanics (layer order, unlayered styles, `!important` reversal) are in [CSS Specificity and the Cascade](../03-specificity-and-cascade/notes.md); here is how they are used to structure a codebase.

```css
/* the first statement fixes the order for the whole app, whatever order the files load in */
@layer reset, tokens, base, vendor, layouts, components, utilities;

@import url("third-party-datepicker.css") layer(vendor);

@layer components {
  #promo .card__title { color: crimson; }   /* (1,1,0), but in an earlier layer */
}

@layer utilities {
  .u-color-inherit { color: inherit; }      /* (0,1,0) still wins: later layer */
}
```

What layers fix:

- **Ordering**: the layer statement decides priority once, so code-split CSS loading in a different order on different routes no longer changes the result.
- **Specificity wars**: specificity only matters inside a layer. A utility beats any component rule because of its layer, not because of a heavier selector.
- **Third-party CSS**: import a library into a low layer and your own rules win without `!important` or selector hacks.
- **ITCSS for free**: the layer list is the inverted triangle, enforced by the browser.

Two rules to remember: **unlayered styles beat every layer** (so CSS you forget to put in a layer quietly wins), and nested layers (`@layer components.card`) let a large app give each area its own sub-layers. Cascade layers are supported in all major browsers since 2022, and Tailwind v4 uses them internally.

In the demo, `#promo .card__title` sets the featured titles to crimson, but the second title also has `.u-color-inherit`. That single class is in the later `utilities` layer, so it wins over the ID selector, which you can see in the DevTools Styles panel (rules are grouped by layer).

## Scoping: `@scope` and Shadow DOM

Naming conventions and CSS Modules **simulate** scoping. The platform now has two real mechanisms.

**`@scope`** limits a set of rules to a subtree, optionally with a lower boundary ("donut scope"):

```css
@scope (.prose) to (.card) {
  p { font-size: 1.125rem; }   /* paragraphs inside .prose, but not inside cards embedded in it */
  a { color: var(--color-accent); }
}
```

- The selectors inside don't need prefixes, and they don't get the scope root's specificity added.
- **Scope proximity**: when two scoped rules with equal specificity conflict, the one whose scope root is closer to the element wins (instead of source order). This fixes the classic "light theme inside dark theme inside light theme" problem.
- A `<style>` element containing `@scope { ... }` with no selector is scoped to its parent element, which is handy for component-level `<style>` blocks.

> **Note:** `@scope` is supported in Chromium since 2023 and Safari since 2024; Firefox lagged behind, so check Can I use before relying on it without a fallback. The demo's `@scope` rule is ignored in browsers without support, and the paragraph simply keeps its normal size.

**Shadow DOM** gives real encapsulation: styles inside a shadow root don't leak out, and page styles don't leak in. Only inherited properties (colour, font) and custom properties cross the boundary, and the component exposes deliberate styling hooks with `:host`, `::slotted()` and `::part()`. It suits design systems shipped as web components to many frameworks; the costs are harder global theming, form integration work and server rendering through Declarative Shadow DOM. See [Interactive Elements and Web Components](../../01-html/12-interactive-elements-and-web-components/notes.md).

| Approach | Enforced by | Outside styles leak in? | Inside styles leak out? | Runtime cost |
|---|---|---|---|---|
| BEM | Convention and lint rules | Yes | Only by mistake | None |
| CSS Modules | Build tool (renamed classes) | Yes (element selectors, globals) | No (for classes) | None |
| `@scope` | Browser | Yes | No | None |
| Shadow DOM | Browser | Only inherited and custom properties | No | Small (per shadow root) |
| Runtime CSS-in-JS | Library (generated classes) | Yes | No | Yes, during render |

## Linting and Guardrails

Every convention above decays without automation. **Stylelint** is the standard CSS linter: it catches errors and enforces the architecture in code review, before a human has to.

```json
{
  "extends": ["stylelint-config-standard"],
  "rules": {
    "selector-max-id": 0,
    "selector-max-specificity": "0,3,0",
    "declaration-no-important": true,
    "max-nesting-depth": 2,
    "selector-class-pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$",
    "declaration-property-value-disallowed-list": { "transition": ["/\\ball\\b/"] }
  }
}
```

| Rule | What it protects |
|---|---|
| `selector-max-id`, `selector-max-specificity` | Flat specificity; no escalation |
| `declaration-no-important` | `!important` only where explicitly disabled (utilities) |
| `max-nesting-depth` | Sass or native nesting that silently builds long selectors |
| `selector-class-pattern` | BEM (or another) naming; the standard config expects kebab-case, so BEM projects override it |
| `declaration-property-value-disallowed-list` | Banned patterns such as `transition: all` |

Plugins can also require tokens instead of raw values (for example `stylelint-declaration-strict-value` for colours). Other guardrails worth having: the DevTools **Coverage** tab and tools like PurgeCSS to find unused CSS, visual regression tests (screenshot comparison in Playwright or a component-story service) so refactors don't change pixels, and a CSS bundle-size budget in CI.

## Choosing an Approach

| Situation | Recommended approach | Why |
|---|---|---|
| Content site, marketing pages, HTML from a CMS | Plain CSS with BEM, tokens and layers | Works with HTML you don't control; no build step required |
| SPA built by one product team | Tailwind, or CSS Modules | Fast iteration; scoping and dead-code removal come for free |
| Large app, many teams, shared design system | CSS Modules or zero-runtime CSS-in-JS, plus tokens, layers and Stylelint | Build-time scoping, typed tokens, enforceable rules |
| React Server Components (Next.js App Router) | CSS Modules, Tailwind, or zero-runtime CSS-in-JS | Runtime CSS-in-JS forces client components |
| Design system used by several frameworks | Framework-agnostic CSS (prefixed BEM in a `@layer`) or web components with Shadow DOM, both themed with custom properties | One implementation for React, Angular and server-rendered pages |
| Legacy codebase with specificity wars | Wrap legacy and vendor CSS in low layers, write new code in higher layers, lint new code | Incremental: no rewrite needed |
| Heavy theming or white-labelling | Semantic tokens as custom properties, whatever the component approach | Themes become data, not code |

> **Note:** These approaches combine. A common modern stack is tokens as custom properties, a layer order, CSS Modules or Tailwind for components, and Stylelint. What matters most is that the team picks **one** primary approach and enforces it.

## Common Mistakes

- Adopting a methodology in a wiki page but not enforcing it with lint rules, so it drifts within months.
- BEM element chains (`.card__body__title`) or nesting BEM classes (`.sidebar .card .card__title`), which bring back DOM coupling and higher specificity.
- Components that set their own outer `margin`, `width` or `position`, so they can't be reused in a different layout. Let the parent or a layout primitive handle spacing.
- Mixing approaches (Bootstrap, legacy Sass, Tailwind) with no layer order, so which rule wins depends on load order.
- Building Tailwind class names dynamically (`` `text-${color}-600` ``), so the classes are never generated.
- Using runtime CSS-in-JS in a Server Components app, and marking whole trees as client components to make it work.
- Tokens named after their values (`--blue`, `--space-16px`) used directly in components, so a theme change means a find-and-replace.
- Adopting cascade layers but leaving some CSS unlayered, then being surprised that it beats everything.
- Writing `&__title` with native CSS nesting and expecting BEM concatenation like Sass.

## Key Takeaways

- CSS at scale fails through the global namespace, specificity escalation, order dependence, dead code and coupling to markup; each architecture tool targets some of these.
- BEM keeps every selector a single unique class: flat specificity, no DOM coupling, enforced only by convention and linting.
- CSS Modules scope class names at build time with no runtime cost; Tailwind removes naming and dead CSS but needs component extraction to stay readable.
- Runtime CSS-in-JS has fallen out of favour because of its runtime cost and its clash with Server Components and streaming; zero-runtime libraries keep the authoring style and output static CSS.
- Design tokens in three tiers (primitive, semantic, component), delivered as custom properties, make theming a data change and give components a styling API.
- Cascade layers fix ordering and specificity problems architecturally: declare the order once, put vendor and legacy CSS low, utilities high.
- `@scope` and Shadow DOM are real, browser-enforced scoping; check `@scope` support before relying on it.
- Choose one primary approach per codebase and enforce it with Stylelint, coverage checks and visual regression tests.

## Interview Questions

### Junior (0–1 year)

**Q1. Why does CSS become harder to maintain as a codebase grows?**
All selectors share one global namespace, so names collide and a change in one place restyles another. Conflicts are resolved by specificity and source order, which leads to ever-heavier selectors and `!important` (specificity wars) and to bugs that depend on load order. Because it is hard to prove a selector is unused, dead CSS is rarely deleted, and descendant selectors tie styles to a particular DOM structure. Architecture approaches exist to control exactly these problems.

**Q2. What is BEM? Give an example.**
BEM stands for Block, Element, Modifier, a naming convention for classes. A block is a standalone component (`.card`), an element is a part of it written `block__element` (`.card__title`), and a modifier is a variant or state written `block--modifier` or `block__element--modifier` (`.card--featured`). In HTML, a modifier goes next to the base class: `class="card card--featured"`.

**Q3. Why does BEM use only single-class selectors instead of selectors like `.card h2`?**
A single class always has the same specificity, (0, 1, 0), so overriding never requires a heavier selector, and the order of rules inside a component is the only tie-breaker. A selector like `.card h2` also depends on the HTML structure: it matches every `<h2>` inside the card, including one in a nested component, and breaks when the heading changes to `<h3>`. Unique class names make styles independent of nesting and easy to search for.

**Q4. What are CSS Modules, and what problem do they solve?**
CSS Modules are CSS files (usually `*.module.css`) whose class names are local by default. The bundler rewrites each class to a unique name such as `Card_title__x7a2b` and the component imports an object mapping `styles.title` to it. They solve the global-namespace problem without naming rules: two components can both use `.title` without colliding. The output is plain CSS, so there is no runtime cost.

**Q5. What is utility-first CSS? Give one advantage and one disadvantage.**
Styling with many small single-purpose classes (`p-4`, `flex`, `text-gray-900`) directly in the markup instead of writing component classes, as Tailwind does. An advantage: no naming, consistent values from a design scale, and no dead CSS, because only used classes are generated. A disadvantage: long class lists in the markup and repetition unless you extract reusable components.

**Q6. What are design tokens, and how do they relate to CSS custom properties?**
Design tokens are named design decisions (colours, spacing, font sizes, radii, motion durations) stored in one place so every platform uses the same values. On the web they are usually delivered as CSS custom properties, such as `--color-accent` or `--space-4`, which components reference with `var()`. Because custom properties are resolved at runtime and inherit, changing a token on `:root` or a theme selector restyles every component that uses it.

### Mid-level (2–4 years)

**Q7. How would you use cascade layers to structure a large stylesheet?**
Declare the order once at the top, for example `@layer reset, tokens, base, vendor, layouts, components, utilities;`. Later layers beat earlier ones regardless of specificity, so utilities always win over components and your components win over third-party CSS imported with `@import url(lib.css) layer(vendor);`. Because the order is fixed by that statement, code-split stylesheets that load in different orders still produce the same result. Watch for unlayered CSS: it beats all layers, so either put everything in a layer or keep only deliberate overrides unlayered.

**Q8. What is the difference between runtime and zero-runtime CSS-in-JS, and why has runtime CSS-in-JS fallen out of favour?**
Runtime libraries (styled-components, Emotion) generate and inject CSS in the browser during render; zero-runtime libraries (vanilla-extract, Linaria, Panda CSS, StyleX) extract static CSS files at build time. Runtime CSS-in-JS costs JavaScript bundle size and render time (serialising and inserting rules causes style recalculation), it can't run in React Server Components because it depends on context and effects, and it needs complex integration to flush styles with streamed HTML. Zero-runtime keeps the TypeScript authoring and type-safe tokens while shipping plain CSS.

**Q9. Compare BEM, CSS Modules, `@scope` and Shadow DOM as ways to scope styles.**
BEM scopes by convention: unique names, nothing enforced, outside styles can still reach in. CSS Modules enforce unique class names at build time, but element selectors and globals still leak. `@scope` is browser-enforced: rules apply only inside a subtree (optionally with a lower boundary), and closer scopes win conflicts; support is newer, so check it. Shadow DOM is full encapsulation in both directions, apart from inherited and custom properties, with `::part()` as the styling hook; it suits web components but makes global theming and server rendering harder.

**Q10. In Tailwind, an element has `class="p-2 p-4"`. Which padding applies, and how do component libraries deal with this?**
The order in the `class` attribute doesn't matter. Both classes have the same specificity, so whichever rule appears later in the generated stylesheet wins, which you can't tell from the markup. That becomes a real problem when a `Button` component has `p-2` and a consumer passes `className="p-4"`. Libraries solve it with a merge helper such as `tailwind-merge`, which removes the earlier conflicting utility, and with explicit variant props (often built with a helper like `class-variance-authority`) instead of free-form class overrides.

**Q11. How should a reusable component let consumers customise its appearance without breaking encapsulation?**
Expose a deliberate, documented API rather than letting consumers override internal selectors. Use variant props or modifier classes for supported variations (`size`, `tone`), component-level custom properties for values (`--button-bg`, `--card-accent`), and with Shadow DOM, `::part()` for specific internal elements. Avoid accepting arbitrary `className` or `style` that target internals, because every internal refactor then becomes a breaking change. The API should be small, versioned, and covered by visual tests.

**Q12. How do you find and safely remove dead CSS in a large codebase?**
Measure first: the DevTools Coverage tab shows which rules were used on a page, and tools such as PurgeCSS compare selectors against the source files. Neither is proof, because class names can be built in JavaScript, come from a CMS or appear only in rare states, so keep a safelist and remove in small steps backed by visual regression tests. The long-term fix is structural: with CSS Modules, Tailwind or co-located component styles, CSS is deleted together with the component that uses it.

**Q13. Which Stylelint rules would you enable for a team, and why?**
Start from `stylelint-config-standard` for correctness and consistency. Add architecture rules: `selector-max-id: 0` and `selector-max-specificity` to keep specificity flat, `declaration-no-important` (disabled only in the utilities layer), `max-nesting-depth` so nesting doesn't build long selectors, `selector-class-pattern` matching your naming convention, and `declaration-property-value-disallowed-list` for banned patterns such as `transition: all`. If you use tokens, add a plugin that rejects raw colour values. Run it in the editor, in pre-commit hooks and in CI so violations never reach review.

### Senior (5+ years)

**Q14. You are choosing the styling architecture for a new Next.js App Router product with eight teams and a shared design system. What do you choose and why?**
Constraints first: Server Components rule out runtime CSS-in-JS; eight teams need enforced scoping and a shared vocabulary; the design system needs theming. A solid answer is tokens generated from a single source (for example JSON through Style Dictionary) into CSS custom properties with primitive, semantic and component tiers; a global layer order (`reset, tokens, base, vendor, components, utilities`); and one component styling approach for everyone, either CSS Modules (plain CSS, lowest risk) or Tailwind configured with the same tokens (fastest iteration, needs component extraction), or a zero-runtime library if typed style APIs matter. Add Stylelint, visual regression tests on the design-system components, and a CSS size budget. Recommendation: CSS Modules or Tailwind on top of tokens and layers; the decision matters less than making it once and enforcing it in CI.

**Q15. How would you migrate a large legacy codebase (global Sass with Bootstrap overrides and heavy `!important` use) to a modern architecture without a big-bang rewrite?**
Use a strangler approach. First, freeze the current behaviour with visual regression snapshots of key pages. Then use layers to stop the bleeding: declare `@layer vendor, legacy, components, utilities;`, import Bootstrap into `vendor` and wrap the legacy Sass output in `legacy`, so every new component (in `components`) wins without specificity hacks. Watch the `!important` declarations in the legacy layer: in layers their priority is reversed, so test those pages carefully. Enable Stylelint for new files only, then migrate component by component (by traffic or by how often they change), deleting legacy rules as each page stops using them, with coverage data to confirm. Recommendation: layers first, because they make the old and new styles coexist predictably; rewriting comes after, in small, measurable steps.

**Q16. Your design system must work in a React app, an Angular app and a server-rendered CMS site. How do you package its styles?**
Make the styles framework-agnostic and the frameworks thin wrappers. Ship tokens as CSS custom properties (plus JSON for tooling), and component CSS as plain, prefixed class names (`.ds-button`, `.ds-button--primary`) inside a named layer (`@layer ds`) so consumers can override from a later layer without specificity battles. Keep the reset optional and scoped, so importing the design system doesn't restyle the host application. React and Angular packages only map props to those classes, and the CMS uses the same classes in templates. Web components with Shadow DOM are the alternative when strict encapsulation matters more than easy theming and server rendering. Recommendation: prefixed classes in a layer plus token custom properties, versioned with semantic versioning and a changelog that treats class names and tokens as public API.

**Q17. After a release, buttons look different depending on which page the user visited first, but only in production. How do you debug it, and how do you prevent it?**
That pattern points at **CSS order**: in production the bundler splits CSS per route, so two rules with equal specificity (for example a shared `.button` and a page-level `.checkout-button`, or two module classes on one element) win or lose depending on which chunk was inserted last. Reproduce it by navigating in different orders, then inspect the element in DevTools to see which rule wins and which stylesheet it comes from. Fix the immediate bug by making the intended winner explicit. Prevent it structurally: put shared and page-level styles in cascade layers so priority no longer depends on insertion order, avoid applying two competing classes to one element (use variants instead), and add an end-to-end test that visits pages in different orders and compares screenshots. Recommendation: in any code-split application, rely on layers for priority, never on source order between files.

## References

- [MDN: Organizing your CSS](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Organizing)
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [MDN: @scope](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope)
- [MDN: Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [BEM: Introduction](https://getbem.com/introduction/)
- [CSS Modules (GitHub)](https://github.com/css-modules/css-modules)
- [Tailwind CSS: Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes)
- [vanilla-extract](https://vanilla-extract.style/)
- [StyleX](https://stylexjs.com/)
- [Style Dictionary](https://styledictionary.com/)
- [Stylelint: Rules](https://stylelint.io/user-guide/rules)
- [CSS-Tricks: A Complete Guide to CSS Cascade Layers](https://css-tricks.com/css-cascade-layers/)
