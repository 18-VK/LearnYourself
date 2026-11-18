# Text Formatting, Quotations, Entities and Code

> HTML · Topic 3 · Demo: [index.html](index.html) · [style.css](style.css) · [text-formatting.html](text-formatting.html) · [quotations.html](quotations.html)

Most of a page is text, and HTML has a small set of inline elements that say what a piece of text *is*: important, emphasised, deleted, a quotation, an abbreviation, a title, a piece of code. This note covers the text-formatting tags (`<strong>`, `<em>`, `<b>`, `<i>`, `<mark>`, `<del>`...), the quotation and citation tags (`<blockquote>`, `<q>`, `<abbr>`, `<address>`, `<cite>`), `mailto:` links, **entities** (the escape codes for characters such as `<` and `&` that HTML would otherwise read as markup), and the tags for showing code and preformatted text (`<pre>`, `<code>`, `<kbd>`, `<samp>`, `<var>`).

## The demo pages

| File | Shows |
|------|-------|
| `text-formatting.html` | `<b>`, `<strong>`, `<i>`, `<em>`, `<mark>`, `<del>`, `<sub>`, `<sup>`, and a `<details>` widget at the end |
| `quotations.html` | `<blockquote>`, `<q>`, `<abbr>`, `<address>` and an explanation of `<cite>` |
| `index.html` | Entities, `<pre>`, `<code>`, `<blockquote>`/`<q>`, and an empty `<canvas>` |
| `style.css` | Only a border for that canvas |

The `<details>`/`<summary>` widget is covered in [Interactive elements and web components](../12-interactive-elements-and-web-components/notes.md), and `<canvas>` in [Media, SVG, canvas and iframe](../09-media-svg-canvas-iframe/notes.md).

## Text formatting

Demo: [text-formatting.html](text-formatting.html)

```html
<b>This text is bold</b>
<strong>This text is important!</strong>
<i>This text is italic</i>
<em>This text is emphasized</em>
<p>Do not forget to buy <mark>milk</mark> today.</p>
<p>My favorite color is <del>blue</del> red.</p>
<p>This is <sub>subscripted</sub> text.</p>
<p>This is <sup>superscripted</sup> text.</p>
```

### `<b>` and `<strong>`

- **`<b>`** defines bold text, **without any extra importance**. HTML5 describes it as text you want to draw attention to: keywords in a summary, product names, the lead sentence of an article.
- **`<strong>`** defines text with **strong importance**, seriousness or urgency ("Warning: do not unplug during the update"). The content is typically displayed in bold.

### `<i>` and `<em>`

- **`<i>`** defines a part of text in an **alternate voice or mood**, typically displayed in italic. It is often used for a technical term, a phrase from another language, a thought, a ship name, etc.
- **`<em>`** defines **stress emphasis**, the kind that changes the meaning of a sentence when spoken: "I *never* said that" vs "I never said *that*". Typically displayed in italic.

### The difference

`<b>` and `<i>` used to be purely presentational: they meant "make this bold" and "make this italic". `<strong>` and `<em>` are semantic: they say the text is important or emphasised, and leave the actual styling to CSS (bold and italic by default). That is why `<strong>` and `<em>` are preferred in modern pages whenever you mean importance or emphasis.

| Tag | Meaning | Default look |
|-----|---------|--------------|
| `<b>` | Draw attention, no extra importance | Bold |
| `<strong>` | Strong importance / urgency | Bold |
| `<i>` | Alternate voice: terms, foreign words, thoughts, names | Italic |
| `<em>` | Stress emphasis that changes meaning | Italic |

> **Note:** HTML5 redefined `<b>` and `<i>` with the meanings above, so they are valid, not deprecated. Choose by meaning: if you just want bold text with no special meaning, use CSS `font-weight: bold`.

### Other formatting elements

| Element | Meaning | Default look | Example |
|---------|---------|--------------|---------|
| `<small>` | Side comments and small print (legal text, copyright). In HTML5 it means "small print", not just "smaller text". | Smaller font | `<small>Terms apply.</small>` |
| `<mark>` | Text marked or highlighted for reference, e.g. search matches | Yellow background | `Do not forget to buy <mark>milk</mark>` |
| `<del>` | Text **deleted** from a document | Strikethrough | `My favorite color is <del>blue</del> red.` |
| `<ins>` | Text **inserted** into a document | Underlined | `<ins>red</ins>` |
| `<sub>` | Subscript: half a character below the line, sometimes smaller | Lowered | H<sub>2</sub>O |
| `<sup>` | Superscript: half a character above the line, sometimes smaller | Raised | WWW<sup>[1]</sup>, x<sup>2</sup> |
| `<s>` | Content that is no longer accurate or relevant (not an edit) | Strikethrough | `<s>₹999</s> ₹499` |
| `<u>` | Unarticulated annotation, such as a spelling mistake | Underlined | `<u>speling</u>` |

- `<del>` and `<ins>` record **edits**. They accept `cite` (URL explaining the change) and `datetime` attributes: `<del datetime="2024-05-01">blue</del> <ins>red</ins>`.
- Use `<sub>` for chemical formulas like H<sub>2</sub>O, and `<sup>` for footnotes like WWW<sup>[1]</sup> and exponents.
- Avoid `<u>` for ordinary text: underlined text looks like a link.

## Quotations and citations

Demo: [quotations.html](quotations.html) (and the "Quotation Tags" part of [index.html](index.html))

### `<blockquote>` and `<q>`

`<blockquote>` defines a section quoted from another source: a longer, block-level quote that browsers indent. `<q>` defines a short inline quotation, and the browser adds the quotation marks itself.

```html
<p>Here is a quote from WWF's website:</p>
<blockquote cite="http://www.worldwildlife.org/who/index.html">
    For 60 years, WWF has worked to help people and nature thrive. ...
</blockquote>

<p>WWF's goal is to: <q>Build a future where people live in harmony with nature.</q></p>
<!-- → WWF's goal is to: "Build a future where people live in harmony with nature." -->
```

| | `<blockquote>` | `<q>` |
|-|----------------|-------|
| Display | Block, indented by the browser | Inline |
| Quotation marks | Not added | Added automatically (language-appropriate, based on `lang`) |
| Use for | Long quotes, possibly several paragraphs | A short phrase inside a sentence |

Both accept a `cite` attribute with the URL of the source. Browsers do **not** display it; it is metadata. To show the source to readers, add visible text, for example a link or a `<cite>` element with the title of the work.

### `<abbr>` for abbreviations

Defines an abbreviation or acronym, like "HTML", "CSS", "Mr.", "Dr.", "ASAP", "ATM". Marking abbreviations gives useful information to browsers, translation systems and search engines. The global `title` attribute holds the full form, which appears as a tooltip when the mouse hovers over the element:

```html
<p>The <abbr title="World Health Organization">WHO</abbr> was founded in 1948.</p>
```

Because tooltips do not appear on touch screens, it is good practice to also write the full form in the text the first time: "the World Health Organization (<abbr>WHO</abbr>)". `<abbr>` replaces the obsolete `<acronym>`.

### `<address>` for contact information

Defines contact information for the author/owner of a document or an article: an email address, URL, physical address, phone number, social-media handle, etc. The text usually renders in italic, and as a block element it always starts on a new line, with a line break after it.

```html
<address>
    Written by John Doe.<br>
    Visit us at:<br>
    Example.com<br>
    Box 564, Disneyland<br>
    USA
</address>
```

`<address>` is for contact details of the page or article author, not for any postal address mentioned in the text.

### `<cite>` for the title of a work

The demo's last part explains `<cite>`: it defines the **title of a creative work** (a book, a poem, a song, a movie, a painting, a sculpture, etc.). The text usually renders in italic.

```html
<p><cite>The Scream</cite> by Edvard Munch. Painted in 1893.</p>
```

A person's name is not the title of a work, so do not wrap names in `<cite>`. Note the difference between the `cite` **attribute** (an invisible source URL on `<blockquote>`, `<q>`, `<del>`, `<ins>`) and the `<cite>` **element** (a visible title).

> **Note:** In `quotations.html` the `<cite>` element is never closed, and the explanatory text contains a literal `<cite>`, which the browser parses as another tag instead of showing it. To show a tag as text, write `&lt;cite&gt;` (see [HTML entities](#html-entities) below). The "ote:" there should read "Note:".

## `mailto:` links: mail to someone

```html
<a href="mailto:email@example.com">Send Email</a>
```

Clicking it opens the user's default email app with the address filled in. You can pre-fill more fields with a query string; separate them with `&` (written `&amp;` in HTML) and encode spaces as `%20`:

```html
<a href="mailto:email@example.com?cc=boss@example.com&amp;subject=Hello%20there&amp;body=I%20saw%20your%20site.">
    Email me
</a>
```

| Part | Example |
|------|---------|
| Several recipients | `mailto:a@example.com,b@example.com` |
| `subject` | `?subject=Order%20query` |
| `cc`, `bcc` | `&cc=x@example.com` |
| `body` | `&body=Line%20one%0ALine%20two` (`%0A` is a new line) |

The similar `tel:` scheme starts a phone call on mobile: `<a href="tel:+911234567890">Call us</a>`. Other `href` kinds are listed in [Headings, links and bookmarks](../02-headings-links-bookmarks/notes.md#kinds-of-href).

> **Note:** A `mailto:` link does nothing useful if the visitor has no email app set up (common on shared or office computers), so also show the address as text. Addresses in page source are also harvested by spam bots; a contact form avoids both problems.

## HTML entities

### Why they exist

The browser treats `<` as the start of a tag and `&` as the start of an entity. If you want to write a tag **as text**, for example to show `<p></p>` on the page, you cannot type `<p></p>`: HTML cannot tell the difference between your text and real markup, so it creates a paragraph instead. You write the entities instead:

```html
this is a code for paragraph tag in HTML &lt;p&gt;&lt;/p&gt;
<!-- → this is a code for paragraph tag in HTML <p></p> -->
```

### Syntax

Every entity starts with `&` and ends with `;`. There are three equivalent forms:

| Form | Example for `<` |
|------|-----------------|
| Named | `&lt;` |
| Decimal code point | `&#60;` |
| Hexadecimal code point | `&#x3C;` |

Named entities are easier to read; numeric ones work for **any** Unicode character, including those without a name (for example `&#8377;` for the rupee sign ₹).

### Common entities

| Entity | Character | Use |
|--------|-----------|-----|
| `&lt;` | `<` | Less than; required to show a tag as text |
| `&gt;` | `>` | Greater than |
| `&amp;` | `&` | Ampersand; required when `&` could be read as the start of an entity |
| `&quot;` | `"` | Double quote inside a double-quoted attribute |
| `&apos;` (or `&#39;`) | `'` | Single quote inside a single-quoted attribute |
| `&nbsp;` | (non-breaking space) | A space the browser will not collapse or break a line at |
| `&copy;` | © | Copyright |
| `&reg;` | ® | Registered trademark |
| `&trade;` | ™ | Trademark |
| `&euro;` | € | Euro |
| `&times;` | × | Multiplication sign (and "close" buttons) |
| `&hellip;` | … | Ellipsis |
| `&mdash;` | — | Em dash |

### The non-breaking space `&nbsp;`

- Normal spaces collapse (ten spaces display as one) and lines may break at them.
- `&nbsp;` is never collapsed and never breaks, so it keeps things together: `10&nbsp;km`, `Mr.&nbsp;Sharma`.
- Do not use rows of `&nbsp;` for layout or indentation; use CSS `margin`/`padding`.

### Character sets

(The demo's tip: "learn about character sets".) A character set (encoding) maps characters to bytes. Old pages used ASCII (128 characters, English only) or ISO-8859-1 (Western European). Modern pages use **UTF-8**, which can represent every Unicode character, and declare it with `<meta charset="UTF-8">` (see [HTML document basics](../01-document-and-boilerplate/notes.md)). Because of UTF-8 you can type ©, € or ₹ directly in the file; you only *must* escape `<` and `&` in text (and the quote character inside an attribute value).

## `<pre>`: preformatted text

The `<pre>` tag defines preformatted text. Text inside `<pre>` is displayed in a fixed-width (monospace) font, and it **preserves both spaces and line breaks**: the text is displayed exactly as written in the HTML source.

```html
<pre>
        this is a line

                        this is a second line
</pre>
```

Everything you type is kept, including the indentation of your source code. That is why the demo's lines appear indented on the page. (A single newline directly after `<pre>` is ignored, so starting the content on the next line is fine.)

Use `<pre>` for code blocks, ASCII art, poems and command output. Long lines do not wrap, so add `overflow-x: auto` in CSS to avoid breaking the layout. The same whitespace behaviour is available on any element with CSS `white-space: pre` (or `pre-wrap` to also allow wrapping).

## `<code>` and friends

The `<code>` tag is a semantic tag for code snippets. Browsers display it in a monospace font. It can be used inline, or inside a block-level element like `<pre>` for multi-line code:

```html
<p>Use the <code>push()</code> method to add an item to an array.</p>

<pre><code>&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;title&gt;Document&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
&lt;/body&gt;
&lt;/html&gt;
</code></pre>
```

- `<code>` alone does **not** preserve whitespace; `<pre>` does. Combine them for blocks: `<pre>` keeps the layout, `<code>` says "this is code".
- `<code>` does not escape anything: `<` and `&` inside it must still be written as entities, as the demo does with the HTML boilerplate.
- Syntax highlighters such as Prism and highlight.js expect `<pre><code class="language-js">`.

> **Note:** The demo's boilerplate inside `<code>` contains a typo, `&lt;!DOCTYPE htm&gt;`, so the page shows `<!DOCTYPE htm>`; the correct text is `<!DOCTYPE html>`.

Related "computer text" tags:

| Tag | Meaning | Example |
|-----|---------|---------|
| `<code>` | A fragment of code | `<code>let x = 5;</code>` |
| `<kbd>` | Keyboard input | Press `<kbd>Ctrl</kbd> + <kbd>S</kbd>` |
| `<samp>` | Sample output from a program | `<samp>File saved.</samp>` |
| `<var>` | A variable (math or programming) | `<var>x</var> + 2` |

## Common Mistakes

- **Using `<b>`/`<i>` when you mean importance or emphasis** — use `<strong>`/`<em>`; and use CSS when you only want the look.
- **Using `<small>` just to shrink text** — it means small print; use CSS `font-size` for visual size.
- **Using `<del>` for a "was ₹999" price** — that is not an edit; `<s>` fits better.
- **Expecting the `cite` attribute on `<blockquote>`/`<q>` to be displayed** — it is invisible metadata.
- **Wrapping a person's name in `<cite>`** — `<cite>` is for titles of works.
- **Unencoded spaces or `&` in `mailto:` URLs** — encode spaces as `%20` and write `&amp;` in HTML.
- **Typing `<` or `&` in text unescaped** — `5 < 10` usually survives, but `<p>` or `&copy` in text turns into markup. Escape them.
- **Forgetting the semicolon** — `&lt` without `;` sometimes works by accident, but many entities do not; always write the `;`.
- **Using `&nbsp;` for spacing and indentation** — use CSS margins and padding.
- **Indenting the content of `<pre>`** to match the HTML — that indentation shows on the page.
- **Expecting `<code>` to preserve formatting or escape tags** — it does neither.

## Key Takeaways

- `<strong>` = importance, `<em>` = stress emphasis; `<b>`/`<i>` are for attention and alternate voice without extra importance. Choose by meaning, style with CSS.
- `<mark>` highlights, `<del>`/`<ins>` record edits, `<s>` marks outdated content, `<sub>`/`<sup>` lower/raise text, `<small>` is small print.
- `<blockquote>` = long block quote, `<q>` = short inline quote with automatic quotation marks; the `cite` attribute is not displayed.
- `<cite>` is for titles of works, `<abbr title>` for abbreviations, `<address>` for author contact details.
- `mailto:` links open the email app and can pre-fill `subject`, `cc`, `bcc` and `body`; always show the address as text too.
- Entities escape characters that have special meaning: `&lt;` `&gt;` `&amp;` `&quot;`, and give access to any character via `&#number;`. With UTF-8 you can type most symbols directly, but must still escape `<` and `&`.
- `&nbsp;` is a space that never collapses or breaks a line; it is not a layout tool.
- `<pre>` preserves spaces and line breaks in a monospace font; `<code>` marks code; use `<pre><code>` for code blocks.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between `<b>` and `<strong>`?**
Both are bold by default. `<strong>` means the content has strong importance, seriousness or urgency. `<b>` only draws attention to the text without adding importance, for example keywords or product names. Choose by meaning, and use CSS when you only want bold styling.

**Q2. What is the difference between `<i>` and `<em>`?**
`<em>` marks stress emphasis that changes the meaning of a sentence. `<i>` marks text in an alternate voice or mood, such as a technical term, a foreign phrase, a thought or a ship name. Both render in italic by default.

**Q3. What do `<del>` and `<ins>` represent, and how do they look?**
`<del>` marks text that has been removed from a document and is shown with a strikethrough; `<ins>` marks text that has been added and is underlined. Together they show edits, and both can carry `cite` and `datetime` attributes describing the change.

**Q4. What is the difference between `<blockquote>` and `<q>`?**
`<blockquote>` is a block-level element for long quotations and is indented by browsers. `<q>` is inline, for short quotations within a sentence, and the browser adds quotation marks automatically. Both accept a `cite` attribute with the source URL, which is not displayed.

**Q5. How do you show the full form of an abbreviation?**
Wrap it in `<abbr>` with a `title`: `<abbr title="World Health Organization">WHO</abbr>`. The full form appears as a tooltip on hover. Because tooltips are not available on touch devices or reliably to screen readers, also spell it out in the text on first use.

**Q6. How do you make a link that opens a new email with a subject already filled in?**
Use a `mailto:` URL with a query string: `<a href="mailto:hello@example.com?subject=Job%20enquiry">Email us</a>`. Further fields such as `cc`, `bcc` and `body` are added with `&` (written `&amp;` in HTML), and spaces are encoded as `%20`.

**Q7. What are HTML entities, and why do we need them?**
They are codes such as `&lt;` or `&#60;` that display a character which would otherwise be interpreted as markup or is hard to type. Without them you could not show `<p>` as text, because the browser would create a paragraph element instead.

**Q8. What does this display?**

```html
<p>5 &lt; 10 &amp;&amp; 10 &gt; 5</p>
```

`5 < 10 && 10 > 5`. Each entity is replaced by its character: `&lt;` by `<`, `&amp;` by `&` and `&gt;` by `>`.

**Q9. What is `&nbsp;` and when would you use it?**
A non-breaking space: it is not collapsed with other spaces, and the line will not break at it. Use it to keep two words together, such as a number and its unit (`100&nbsp;km`). Do not use it for layout spacing.

**Q10. What is the difference between `<p>`, `<pre>` and `<code>`?**
`<p>` is a paragraph: it collapses runs of spaces and line breaks into single spaces and wraps text normally. `<pre>` is about formatting: it keeps every space and line break exactly as written and uses a monospace font. `<code>` is about meaning: it marks text as computer code (monospace by default) and can be used inline, but it does not preserve whitespace. For a multi-line code block, use both: `<pre><code>...</code></pre>`.

### Mid-level (2–4 years)

**Q11. How does escaping relate to XSS, and how do you insert user-supplied text safely with JavaScript?**
If user input such as `<img src=x onerror=alert(1)>` is inserted as HTML, the browser runs it: that is cross-site scripting. Insert untrusted text with `textContent` (or `innerText`), which treats it as plain text, not with `innerHTML`. If you must build HTML from user data, escape `<`, `>`, `&`, `"` and `'` or use a sanitiser library such as DOMPurify. React escapes text in JSX automatically, except with `dangerouslySetInnerHTML`.

**Q12. If the page is UTF-8, do you still need entities?**
Mostly no: you can type ©, €, ₹ and text in any language directly. You still need to escape `<` and `&` in text, and the matching quote character inside attribute values. Entities remain useful for invisible or ambiguous characters such as `&nbsp;`, or when a file must stay pure ASCII.

**Q13. Do screen readers announce `<strong>` and `<em>` differently from normal text? Does the choice still matter?**
Most screen readers do not change voice or announce these elements by default, although some can be configured to. The choice still matters: the semantics are part of the document's meaning, they survive when styles are removed (reader mode, RSS, copy into other tools), and they keep the code honest about intent. Never rely on bold or italic alone to convey critical information.

**Q14. You need to show formatted code samples in a technical blog. How would you mark them up?**
Use `<pre><code class="language-js">` for blocks and `<code>` for inline snippets, escape `<` and `&` (or generate the markup with a tool that does), add `overflow-x: auto` so long lines scroll instead of breaking the layout, and use a syntax highlighter such as Prism or highlight.js. Make sure the scrollable block is keyboard-reachable, for example with `tabindex="0"`.

**Q15. Why does text inside `<pre>` appear with unexpected indentation, and how do you avoid it?**
`<pre>` preserves all whitespace, including the indentation used to line the content up with the surrounding HTML. Either start the content at column 0 in the source, or strip common indentation in a build step or with the syntax highlighter. Only the single newline immediately after the `<pre>` tag is ignored.

**Q16. What problems do `mailto:` links have, and how would you handle a "Contact us" feature in a production app?**
They depend on the visitor having a configured email client, they expose the address to spam harvesters, and you get no tracking or validation. A production app usually provides a contact form that POSTs to a server endpoint (an ASP.NET Core or Express API, for example), validates input on the server, adds spam protection (rate limiting, a honeypot field or CAPTCHA) and sends the email through a mail service, while still displaying a visible email address as a fallback.

### Senior (5+ years)

**Q17. Users (or CMS editors) can enter rich text with bold, italics, links, quotes and code. How do you store and render it safely?**
Treat the content as untrusted whoever wrote it. Prefer a restricted source format, such as Markdown or the structured JSON that most rich-text editors produce, store that, and turn it into HTML when rendering. Run the generated HTML through a sanitiser with an **allowlist**: only the tags you support (`p`, `strong`, `em`, `a`, `blockquote`, `code`, `pre`, lists), only safe attributes (`href` limited to `https:`, `http:` and `mailto:`), and nothing else: no `style`, no event handlers, no `<iframe>`. DOMPurify does this in the browser; on a .NET server, a library such as HtmlSanitizer does the same. Sanitise at render time (or at both save and render), so that tightening the allowlist later also protects content saved earlier.

Text pasted from Word or Google Docs needs normalising on save as well: strip inline styles and classes, turn runs of `&nbsp;` back into normal spaces, and map presentational markup onto the semantic tags your renderer supports. To make "never assign raw HTML" enforceable in a large codebase, turn on **Trusted Types** through CSP (`require-trusted-types-for 'script'`): `innerHTML` then accepts only values produced by your sanitiser policy and throws for plain strings. Support started in Chromium, so even before every engine enforces it, running your tests in a Chromium browser with the policy on catches the mistakes. Recommendation: restricted source format, allowlist sanitiser at render time, and Trusted Types as the guard rail.

**Q18. A teammate wrote one `escapeHtml()` helper and uses it for element text, attribute values, URLs and data embedded in a `<script>` block. What is wrong with that?**
Escaping depends on the context; characters that are dangerous in one place are harmless in another, and vice versa.

| Context | What is needed |
|---------|----------------|
| Element text | Escape `<` and `&` (escaping `>` too is harmless) |
| Quoted attribute value | Also escape the quote character; never leave attribute values unquoted |
| URL in `href`/`src` | HTML escaping does not stop `javascript:`; validate the scheme, and `encodeURIComponent` each query value |
| Inside `<script>` | Entities are not decoded there, so `&lt;` stays literal, and a string containing `</script>` ends the block early. Serialise with `JSON.stringify` and replace `<` with `<` |
| CSS (`<style>`, `style="..."`) | Do not put user data there at all |

Recommendation: do not hand-write escaping. Use templates that escape per context automatically (JSX, Razor, Angular), pass data to scripts through `data-*` attributes or a `<script type="application/json">` block read with `JSON.parse`, and review against the OWASP XSS prevention rules (see [Security: XSS, CSRF and CSP](../../04-browser-platform/04-security-xss-csrf-csp/notes.md)).

**Q19. You are building the documentation site for a component library with thousands of code samples. How would you render the code blocks?**
Start with semantic markup, `<pre><code class="language-tsx">`, with `<code>` for inline identifiers and `<kbd>` for keys. Then:

- **Highlight at build time** (for example Shiki or Prism run during the static build) rather than in the browser. The page ships already-coloured HTML with no highlighting JavaScript and no flash of uncoloured code. Runtime highlighting is only worth it for code the user types.
- **Make scrolling accessible**: `overflow-x: auto` plus `tabindex="0"` on the `<pre>`, so keyboard users can scroll long lines (axe flags scrollable regions that cannot be focused).
- **Add `translate="no"`** to code blocks, so browser translation does not "translate" keywords and identifiers.
- **Check the theme's contrast** in light and dark mode; highlighter themes often fail WCAG contrast, especially for comments.
- **Copy buttons** should copy the raw source with `navigator.clipboard.writeText()`, not the highlighted HTML, and confirm through an `aria-live` region.

Recommendation: build-time highlighting on semantic markup, with focusable scroll containers and `translate="no"`, so thousands of samples cost no runtime JavaScript.

> **Note:** Related questions answered elsewhere: [Media, SVG, canvas and iframe](../09-media-svg-canvas-iframe/notes.md#interview-questions) (canvas sizing and accessibility, iframes as link targets, `sandbox`, `postMessage`); [Interactive elements and web components](../12-interactive-elements-and-web-components/notes.md#interview-questions) (`<details>`/`<summary>` accordions).

## References
- [CodeWithHarry: HTML entities](https://www.codewithharry.com/tutorial/html-entities/)
- [CodeWithHarry: HTML code tags](https://www.codewithharry.com/tutorial/html-code-tags/)
- [GeeksforGeeks: How to create a link to send email in HTML](https://www.geeksforgeeks.org/how-to-create-a-link-to-send-email-in-html/)
- [MDN: `<strong>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/strong)
- [MDN: `<b>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/b)
- [MDN: `<del>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/del)
- [MDN: `<blockquote>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/blockquote)
- [MDN: `<abbr>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/abbr)
- [MDN: `<cite>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/cite)
- [MDN: Character references (entities)](https://developer.mozilla.org/en-US/docs/Glossary/Character_reference)
- [MDN: `<pre>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/pre)
- [MDN: `<code>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/code)
- [MDN: Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [OWASP: Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
