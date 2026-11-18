# The Input Tag and Its Types

> HTML · Topic 8 · Demo: [index.html](../07-forms/index.html) · Part 1: [Forms](../07-forms/notes.md) (the `<form>` element)

`<input>` is the most versatile form element: one tag that becomes a text box, a date picker, a checkbox, a slider or a file chooser depending on its `type`. Choosing the right type and attributes gives users the right keyboard on phones and free built-in validation. This note covers the input types, `inputmode`, the restriction attributes (`min`/`max`, `step`, `pattern`, `disabled`/`readonly`...) and validation feedback with CSS and the Constraint Validation API. It shares its demo with part 1, [Forms](../07-forms/notes.md), which covers the `<form>` element itself, GET/POST, labels, `<select>` and `<textarea>`.

## Basics

```html
<label for="NameOfPlayer">Enter your Name</label>
<input type="text" id="NameOfPlayer" name="username" placeholder="Your Name">
```

- `<input>` is a **void element**: no closing tag.
- If `type` is missing or unknown, it falls back to `type="text"`.
- It needs a `name` to be submitted, and an associated `<label>` to be accessible.

## Input types

Check out the full list: [W3Schools — HTML input types](https://www.w3schools.com/html/html_form_input_types.asp).

| Type | Renders as | Built-in behaviour |
|------|-----------|--------------------|
| `text` | Single-line text box | Default type |
| `password` | Text box with masked characters | Value still sent as plain text (use HTTPS) |
| `email` | Text box | Validates `name@domain`; email keyboard on phones; `multiple` allows a comma-separated list |
| `url` | Text box | Validates an absolute URL (`https://...`) |
| `tel` | Text box | Phone keypad on phones; **no** format validation (use `pattern`) |
| `number` | Box with spinner arrows | Only numbers; `min`, `max`, `step` |
| `range` | Slider | Imprecise number; default `min=0`, `max=100` |
| `search` | Text box | May show a clear (x) button; "search" key on phone keyboards |
| `date` | Date picker | Value is always `yyyy-mm-dd` |
| `time` | Time picker | Value is `hh:mm` (24-hour) |
| `datetime-local` | Date + time picker | No time zone |
| `month`, `week` | Month / week picker | Limited support in some desktop browsers (Firefox, Safari), where they fall back to a text box |
| `color` | Colour picker | Value is `#rrggbb` |
| `checkbox` | Tick box | Sent only when ticked |
| `radio` | Option button | One choice per group (same `name`) |
| `file` | "Choose file" button | `accept`, `multiple`; form needs `enctype="multipart/form-data"` |
| `hidden` | Nothing | Value sent with the form |
| `submit`, `reset`, `button` | Buttons | Submit form / reset form / nothing (for JavaScript) |
| `image` | Image used as a submit button | Sends click coordinates too |

### Input type `tel`

`<input type="tel">` is used for input fields that should contain a telephone number.

```html
<form>
  <label for="phone">Enter your phone number:</label>
  <input type="tel" id="phone" name="phone" pattern="[0-9]{3}-[0-9]{2}-[0-9]{3}">
</form>
```

Phone number formats differ between countries, so the browser does not validate `tel` at all; the `pattern` here requires exactly the shape `123-45-678`. For Indian 10-digit mobile numbers you might use `pattern="[6-9][0-9]{9}"`.

### Checkboxes and radio buttons

```html
<fieldset>
    <legend>Choose a plan</legend>
    <label><input type="radio" name="plan" value="free" checked> Free</label>
    <label><input type="radio" name="plan" value="pro"> Pro</label>
</fieldset>

<label><input type="checkbox" name="terms" value="yes" required> I accept the terms</label>
```

- Radio buttons with the **same `name`** form a group: selecting one deselects the others. Only the selected one's `value` is sent (`plan=free`).
- A checkbox is sent only when ticked. A ticked checkbox with no `value` sends `on` (`terms=on`).
- `checked` pre-selects the control when the page loads.

### File input

```html
<label for="myfile">Select a file:</label>
<input type="file" id="myfile" name="myfile" accept="image/*,.pdf" multiple>
```

`accept` filters the file picker (a hint, not security; check the file on the server) and `multiple` allows choosing several files.

## The `inputmode` attribute

`inputmode` changes which **virtual keyboard** appears on a phone or tablet (any device with an on-screen keyboard). It does not change validation or what the user is allowed to type.

```html
<input type="text" inputmode="numeric">
<input type="text" inputmode="email">
```

| Value | Keyboard shown |
|-------|----------------|
| `text` | Standard keyboard (default) |
| `numeric` | Digits 0–9 |
| `decimal` | Digits plus the decimal separator |
| `tel` | Telephone keypad (`*`, `#`, `+`) |
| `email` | Includes `@` and `.` |
| `url` | Includes `/` and `.com` style keys |
| `search` | Keyboard with a "Search"/"Go" key |
| `none` | No keyboard (for apps that provide their own) |

**`type` vs `inputmode`:** `type` decides the data and the built-in validation; `inputmode` only picks the keyboard. A good use of `inputmode` is a value made of digits that is not really a number, such as an OTP, PIN or card number:

```html
<input type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">
```

(`type="number"` would drop leading zeros, add spinner arrows and change the value when the user scrolls over it.) The demo combines `type="tel"` with `inputmode="numeric"`; that works, though `tel` already brings up a phone keypad on its own.

## Input restrictions (attributes)

Some common input restrictions:

| Attribute | Description |
|-----------|-------------|
| `checked` | The field is pre-selected when the page loads (for `type="checkbox"` or `type="radio"`) |
| `disabled` | The field is disabled |
| `max` | The maximum value for the field |
| `maxlength` | The maximum number of characters for the field |
| `min` | The minimum value for the field |
| `minlength` | The minimum number of characters (checked on submit) |
| `pattern` | A regular expression the value is checked against |
| `readonly` | The field is read-only (cannot be changed) |
| `required` | The field is required (must be filled out) |
| `size` | The visible width of the field, in characters |
| `step` | The legal number intervals for the field |
| `value` | The default value of the field |

Other frequently used attributes: `placeholder`, `autofocus`, `autocomplete`, `multiple`, `accept`, and `list` (connects to a `<datalist>` of suggestions):

```html
<input list="cities" name="city">
<datalist id="cities">
    <option value="Noida"></option>
    <option value="Delhi"></option>
</datalist>
```

### `min` and `max`

`min` and `max` set the minimum and maximum values. They work with these types: `number`, `range`, `date`, `datetime-local`, `month`, `time` and `week`.

**Tip:** Use `min` and `max` together to create a range of legal values.

```html
<form>
  <label for="datemax">Enter a date before 1980-01-01:</label>
  <input type="date" id="datemax" name="datemax" max="1979-12-31"><br><br>

  <label for="datemin">Enter a date after 2000-01-01:</label>
  <input type="date" id="datemin" name="datemin" min="2000-01-02"><br><br>

  <label for="quantity">Quantity (between 1 and 5):</label>
  <input type="number" id="quantity" name="quantity" min="1" max="5">
</form>
```

Date limits are always written as `yyyy-mm-dd`, whatever format the picker displays.

### `step`

`step` sets the allowed increments, counted from `min` (or from 0). The default for `number` is `1`, so a value like `1.5` is **invalid** unless you set `step="0.5"`, `step="0.01"` or `step="any"`. For `date` the step is in days, for `time` in seconds.

```html
<input type="number" name="price" min="0" step="0.01">   <!-- 19.99 is valid -->
```

### `maxlength` (and `minlength`)

`maxlength` sets the maximum number of characters allowed. When set, the field will not accept more characters than that. However, the attribute gives no feedback, so if you want to tell the user why typing stopped, you must write JavaScript (for example a "42/50" character counter).

> **Note:** Do not confuse them: `maxlength`/`minlength` limit the **number of characters**; `max`/`min` limit the **value** (a number or a date).

### `pattern`

```html
<input type="text" name="pin" pattern="[0-9]{6}" title="Six digits, e.g. 201301">
```

- The regular expression must match the **whole** value (the browser adds `^(?:` and `)$` for you).
- An empty field is not checked; add `required` if it must be filled.
- Use `title` to describe the expected format; browsers include it in the error message.
- Modern browsers compile the pattern with the JavaScript `v` flag, so some characters must be escaped inside a character class, for example a literal hyphen: `[\w\-]` rather than `[\w-]`. An invalid pattern is silently ignored.

### `disabled` vs `readonly`

A **disabled** field is unusable and un-clickable, and **its value is not sent** when the form is submitted. A **read-only** field cannot be modified, but the user can still tab to it, highlight it and copy the text, and **its value is sent** when the form is submitted.

| | `disabled` | `readonly` |
|-|-----------|------------|
| Can the user edit it? | No | No |
| Focusable / selectable? | No | Yes |
| Submitted with the form? | **No** | **Yes** |
| Validated? | No | No (`required` is ignored) |
| Looks | Greyed out | Normal |
| Works on | All controls, including `<select>`, buttons and `<fieldset>` | Text-like inputs and `<textarea>` only (not checkboxes, radios or `<select>`) |
| Typical use | Option not available right now | Show a value the user must see and submit but not change (an order ID) |

### `size`

`size` sets the visible width in characters for `text`, `search`, `tel`, `url`, `email` and `password` inputs. It does not limit how much can be typed (that is `maxlength`). Width is normally set with CSS today.

## Validation feedback with CSS and JavaScript

```css
/* :invalid matches immediately, even before the user types */
input:invalid { border-color: red; }

/* :user-invalid matches only after the user has interacted with the field */
input:user-invalid { border-color: red; }
```

```js
const email = document.querySelector("#email");
email.addEventListener("input", () => {
    if (email.validity.typeMismatch) {
        email.setCustomValidity("Please enter an email like name@example.com");
    } else {
        email.setCustomValidity(""); // clear the error, otherwise the field stays invalid
    }
});
```

## Common Mistakes

- **Using `type="number"` for phone numbers, PINs or card numbers** — leading zeros are lost, spinners appear and scrolling changes the value. Use `type="tel"` or `type="text"` with `inputmode="numeric"`.
- **Expecting `type="tel"` to validate** — it does not; add a `pattern`.
- **Radio buttons with different `name`s** — they no longer form a group, so several can be selected.
- **Decimals rejected by `type="number"`** — the default `step` is 1; set `step="any"` or a suitable value.
- **Using `disabled` for a value that must reach the server** — disabled values are not submitted; use `readonly` (or a hidden input).
- **Trusting hidden or read-only values on the server** — users can change them in DevTools.
- **Forgetting to clear `setCustomValidity`** — the field stays invalid forever.

## Key Takeaways

- `<input>` is a void element whose behaviour depends on `type`; the default is `text`.
- HTML5 types (`email`, `url`, `number`, `date`, `tel`...) give built-in validation and better mobile keyboards.
- `inputmode` changes only the virtual keyboard; `type` changes semantics and validation.
- `min`/`max`/`step` restrict values; `minlength`/`maxlength` restrict character count; `pattern` must match the whole value.
- `disabled` fields are not submitted; `readonly` fields are.
- Radio buttons in one group share a `name`; unchecked checkboxes are not submitted.
- Browser validation helps the user; the server must validate again.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the default `type` of `<input>`, and why use HTML5 types like `email` or `date`?**
The default is `text`. Specific types give built-in validation (an email must contain `@`), suitable mobile keyboards, native pickers for dates and colours, and better semantics for assistive technology and autofill, all without JavaScript.

**Q2. What is the difference between `disabled` and `readonly`?**
Both stop the user editing the field. A `disabled` field cannot be focused and its value is not submitted. A `readonly` field can be focused, selected and copied, and its value is submitted with the form.

**Q3. How do you make a group of radio buttons where only one can be selected?**
Give them all the same `name` and different `value`s. The browser then allows only one checked at a time and submits `name=value` for the chosen one. Wrap the group in a `<fieldset>` with a `<legend>` for accessibility.

**Q4. What is the difference between `maxlength` and `max`?**
`maxlength` limits how many characters can be typed into a text-like field. `max` limits the value of numeric and date/time inputs, such as `max="5"` on a number or `max="1979-12-31"` on a date.

**Q5. What does the `inputmode` attribute do?**
It tells devices with a virtual keyboard which keyboard to show, for example `numeric` for digits or `email` for a keyboard with `@`. It does not validate or restrict input.

**Q6. What is submitted for these checkboxes if the user ticks only the first?**

```html
<input type="checkbox" name="news" checked>
<input type="checkbox" name="offers" value="yes">
```

Only `news=on`. A ticked checkbox without a `value` sends `on`, and an unticked checkbox sends nothing at all, so `offers` is missing from the data.

### Mid-level (2–4 years)

**Q7. Why is `type="number"` a bad choice for an OTP, PIN or credit-card field, and what do you use instead?**
Those are strings of digits, not quantities. `type="number"` strips leading zeros, shows spinners, may change the value on mouse-wheel scroll, and can accept `e`, `+` or `-`. Use `type="text"` with `inputmode="numeric"`, a `pattern` such as `[0-9]{6}`, and an `autocomplete` token like `one-time-code` or `cc-number`.

**Q8. A field with `pattern="[\w-]+"` accepts anything, even spaces. What is going on?**
Modern browsers compile `pattern` with the `v` flag, in which an unescaped `-` inside a character class is a syntax error. When the regex is invalid, the browser ignores the pattern entirely, so no validation happens. Escape it, `[\w\-]+`, and test the pattern in the console with `new RegExp(pattern, "v")`.

**Q9. Validation styles turn every empty required field red as soon as the page loads. How do you fix that?**
`:invalid` matches immediately, before the user has done anything. Use `:user-invalid`, which only matches after the user has interacted with the field (or tried to submit), or add a class from JavaScript on `blur`/`submit` and style `.touched:invalid`.

**Q10. How do you show a custom validation message while still using the browser's validation?**
Use the Constraint Validation API: check `input.validity` (for example `valueMissing`, `typeMismatch`, `patternMismatch`) and call `input.setCustomValidity("message")`. Call `setCustomValidity("")` when the value becomes valid, otherwise the field stays invalid. `form.reportValidity()` shows the messages on demand.

**Q11. What does `input.value` return for `<input type="date">`, and how do you work with it in JavaScript?**
A string in `yyyy-mm-dd` format (or an empty string), regardless of how the picker displays the date to the user. Use `input.valueAsDate` to get a `Date` object (in UTC) or `input.valueAsNumber` for milliseconds since the epoch. Keep the ISO string format when sending it to an API.

**Q12. Your form uses a hidden input `<input type="hidden" name="price" value="499">`. What is the risk?**
Hidden inputs are only hidden visually; anyone can change the value in DevTools or send their own request, so a user could buy the item for 1. Never trust prices, roles or permissions from the client: send an ID and look up the price on the server. Hidden inputs are fine for non-sensitive context or for server-verified values like CSRF tokens.

### Senior (5+ years)

**Q13. Your design system needs a date field. Native `<input type="date">` or a custom date picker?**
The native input gives you keyboard support, the operating system's picker on phones (usually the best mobile experience), `min`/`max` validation and a value that is always ISO `yyyy-mm-dd`, for free. Its limits: the displayed format follows the browser or OS locale, not your app's locale setting; the popup cannot be styled; the desktop experience differs between browsers; and there is no range selection or "disable these dates" logic. A custom picker gives full control, but you must implement the ARIA date-grid pattern, keyboard navigation, screen-reader announcements, locale rules (first day of the week, calendars) and touch support, which is weeks of work and a lasting accessibility risk.

First ask whether a calendar is right at all. For dates people already know (date of birth, card expiry), three short text fields (day, month, year) with `inputmode="numeric"` and `autocomplete="bday-day"`/`bday-month`/`bday-year` are faster than any picker; GOV.UK uses this pattern. Recommendation: memorable dates as plain text fields, near-future dates with the native input, and a well-tested library (not a home-grown widget) only when you genuinely need ranges or business rules, always keeping a way to type the date.

**Q14. Product asks for input masks: phone numbers shown as `(555) 123-4567`, card numbers grouped in fours as you type. What are the risks, and how would you implement it?**
Masks that rewrite the value on every keystroke fight the user: the caret jumps to the end, deleting a character in the middle breaks the format, pasting an already formatted (or unformatted) value fails, browser autofill inserts a value in a different shape that the mask then mangles, screen readers announce every rewrite, and Android keyboards that compose text can produce duplicated characters.

The safer design: accept any formatting (spaces, dashes, brackets), show the expected format as hint text (not only as a placeholder), normalise the value when you use it (strip non-digits on blur, on submit and again on the server) and validate the normalised value. Formatting on blur, or display formatting that keeps the caret position, is fine. For cards use `inputmode="numeric"`, `autocomplete="cc-number"` and allow spaces. Recommendation: format for display, validate the normalised value, never block what the user types, and if a mask library is unavoidable, test paste, autofill, mid-string edits, Android keyboards and a screen reader before shipping it.

**Q15. How would you architect validation for a large app with many forms: native Constraint Validation, a JavaScript schema library, or both?**
Native validation is free, works before JavaScript loads, exposes `required` to assistive technology and drives `:user-invalid`. Its limits show at scale: messages appear in the browser's language rather than your app's, cannot be styled, show one at a time in a tooltip, differ in wording between browsers, and cross-field rules ("end date after start date", "passwords match") need custom `setCustomValidity` code. A schema library (Zod, Yup, Valibot) gives consistent messages, cross-field and async rules, and, in a JavaScript backend, the **same schema on the server**.

The common hybrid: keep the native attributes (`type`, `required`, `maxlength`, `min`) for semantics, mobile keyboards and accessibility; add `novalidate` to the form so the browser does not show its own bubbles (the `:invalid` states still apply); run the shared schema on blur and submit; render its messages in your own UI wired with `aria-describedby`; and have the server run the same schema and return errors in the same shape. Recommendation: one schema as the single source of truth on client and server, native attributes kept for semantics and progressive enhancement, browser bubbles off for a consistent, translatable UI.

**Q16. Your sign-up form rejects real customers: names with apostrophes, international phone numbers, email addresses with `+`. How strict should client-side validation be?**
Every strict rule is a guess about the world, and real data breaks it: names such as O'Brien, single names or non-Latin scripts; phone numbers whose length depends on the country (up to 15 digits in E.164, plus country codes); email addresses with `+tags` and new top-level domains. The HTML `type="email"` check is deliberately loose (it even accepts `name@localhost`-style addresses without a dot), and that is a feature: format checks cannot prove an address exists.

Client-side validation should catch empty fields and obvious typos, nothing more. Normalise and check authoritative formats on the server with proper libraries (for example libphonenumber for phone numbers), and prove ownership by action: a confirmation email or an SMS code. Log which rule rejected a submission (the field and rule, never the value, which is personal data) so you can spot rules that turn away real users. Recommendation: be liberal in what you accept, normalise on the server, verify by action, and treat validation failure rates as a product metric.

## References
- [W3Schools: HTML input types](https://www.w3schools.com/html/html_form_input_types.asp) — check out the link
- [Part 1 of these notes: HTML forms](../07-forms/notes.md)
- [MDN: `<input>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input)
- [MDN: `inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)
- [MDN: `pattern` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern)
- [MDN: `readonly` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/readonly)
- [MDN: `:user-invalid`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:user-invalid)
- [MDN: Constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation)
- [GOV.UK Design System: Date input](https://design-system.service.gov.uk/components/date-input/)
