# HTML Forms

> HTML · Topic 7 · Demo: [index.html](index.html) · Part 2: [Input types and validation](../08-input-types-and-validation/notes.md) (the `<input>` tag and its types)

An HTML form is used to collect user input. The user input is most often sent to a server for processing: logins, sign-ups, search boxes, checkouts. The demo is a tournament enrolment form that uses most of the common form elements. This note covers the `<form>` element (GET vs POST, the other attributes), labels, `<select>`, `<textarea>`, buttons, submitting with JavaScript and, in the Senior questions, form components and validation at scale. The `<input>` element and its many types are covered in detail in part 2, [Input types and validation](../08-input-types-and-validation/notes.md).

## The `<form>` element

The `<form>` element is a container for different types of input elements, such as text fields, checkboxes, radio buttons, submit buttons, etc. On submit, it collects the values of the controls inside it and sends them somewhere.

```html
<form action="/action_page.php" method="get">
    <label for="fname">First name:</label><br>
    <input type="text" id="fname" name="fname" value="John"><br>
    <label for="lname">Last name:</label><br>
    <input type="text" id="lname" name="lname" value="Doe"><br><br>
    <input type="submit" value="Submit">
</form>
```

Submitting this form with the default values sends the browser to:

```text
/action_page.php?fname=John&lname=Doe
```

Each control contributes one `name=value` pair. Spaces and special characters are encoded (`John Doe` becomes `John+Doe`).

### What happens on submit

1. The user clicks a submit button or presses Enter in a text field.
2. The browser runs built-in validation (`required`, `pattern`, `type="email"`...). If anything fails, it shows a message and stops.
3. It collects `name=value` pairs from every enabled control that has a `name`.
4. It sends them to the `action` URL using the `method`, and **loads the server's response as a new page** (unless JavaScript intercepts the submit).

## Form attributes

| Attribute | Values | Default | Purpose |
|-----------|--------|---------|---------|
| `action` | A URL | The current page's URL | Where the data is sent |
| `method` | `get`, `post` (`dialog` inside a `<dialog>`) | `get` | HTTP method used to send it |
| `target` | `_self`, `_blank`, `_parent`, `_top`, frame name | `_self` | Where to show the response |
| `enctype` | `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` | `application/x-www-form-urlencoded` | How the body is encoded (POST only) |
| `autocomplete` | `on`, `off` | `on` | Whether the browser may auto-fill fields |
| `novalidate` | Boolean | absent | Skip built-in validation on submit |
| `name` | Any text | — | Name for referring to the form from JavaScript |

### The `action` attribute

The `action` attribute defines the action to be performed when the form is submitted. Usually the form data is sent to a file or route on the server when the user clicks the submit button. In the example above, the data goes to `action_page.php`, a server-side script that handles the form data. In a MERN app it would be an Express route such as `action="/api/register"`.

The demo uses `action=""`, which means "submit to the current page's URL". Opened as a local file there is no server behind it, so nothing actually processes the data; the page just reloads.

### The `method` attribute: GET vs POST

The `method` attribute specifies the HTTP method used to submit the form data. The data is sent as URL variables (`method="get"`) or in the body of an HTTP POST request (`method="post"`). The default is **GET**. (The demo uses `post`; its comment says the difference would be explained later, and here it is.)

| | GET | POST |
|-|-----|------|
| Where the data goes | Appended to the URL as `?name=value&...` pairs | Inside the body of the HTTP request; not shown in the URL |
| Visible in | Address bar, browser history, server logs, shared links | Not in the URL (but still readable in DevTools, and in plain text without HTTPS) |
| Size | Limited by URL length. The HTTP spec sets no limit, but browsers and servers do; about 2,000 characters is the safe figure (the often-quoted 2,048 comes from old Internet Explorer). | No limit in the protocol; servers set their own (Express's body parsers default to 100 kB) |
| Bookmarkable / shareable | Yes, the result can be bookmarked | No, POST submissions cannot be bookmarked |
| Refresh / Back | Repeats silently | Browser asks "Confirm form resubmission" |
| Use for | Searches, filters, any request that only **reads** data (like query strings in Google) | Logins, sign-ups, payments, uploads, anything that **changes** data or is sensitive |

**Notes on GET:** NEVER use GET to send sensitive data, because the submitted form data is visible in the URL. GET is good for non-secure data, and useful when the user may want to bookmark the result.

**Notes on POST:** It can send large amounts of data and files, and the data does not appear in the URL.

**Tip:** Always use POST if the form data contains sensitive or personal information.

> **Note:** POST alone does not encrypt anything. Anyone on the network can read a POST body sent over plain `http://`. Sensitive data needs **POST + HTTPS**.

### The `target` attribute

The `target` attribute specifies where to display the response received after submitting the form.

| Value | Description |
|-------|-------------|
| `_blank` | The response is displayed in a new window or tab |
| `_self` | The response is displayed in the current window (default) |
| `_parent` | The response is displayed in the parent frame |
| `_top` | The response is displayed in the full body of the window |
| *framename* | The response is displayed in a named iframe |

### The `autocomplete` attribute

The `autocomplete` attribute specifies whether a form should have autocomplete on or off. When it is on, the browser automatically completes values based on values the user has entered before.

```html
<form action="/action_page.php" autocomplete="on">
```

It also works on individual fields, where specific tokens tell the browser exactly what to fill in:

```html
<input type="email" name="email" autocomplete="email">
<input type="password" name="new-pass" autocomplete="new-password">
<input type="text" name="otp" autocomplete="one-time-code" inputmode="numeric">
```

> **Note:** Browsers may ignore `autocomplete="off"` on login fields so that password managers keep working.

### The `novalidate` attribute

`novalidate` is a boolean attribute. When present, the form data is not validated by the browser when submitted.

```html
<form action="/action_page.php" novalidate>
```

It is typically used when JavaScript performs its own validation with custom error messages. `formnovalidate` on a single submit button does the same for that button only (for example a "Save draft" button).

### The `name` attribute of `<form>`

The `name` attribute gives the form a name so it can be referenced from JavaScript:

```html
<form action="/action_page.php" method="get" name="myForm">
    <!-- Data -->
</form>
```

```js
const form = document.forms.myForm; // or document.forms["myForm"]
```

> **Note:** The form's own `name` is **not** submitted with the data. It is the `name` on each **control** (input, select, textarea) that becomes the key of the submitted data.

## The `name` attribute of controls

Each input field must have a `name` attribute to be submitted. If `name` is omitted, the value of that field is not sent at all. Try it: [W3Schools — form submitted without a name](https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit_id).

```html
<input type="text" id="city" value="Noida">            <!-- not sent -->
<input type="text" id="city2" name="city" value="Noida"> <!-- sent as city=Noida -->
```

`id` and `name` do different jobs: `id` is for the page (labels, CSS, JavaScript), `name` is the key the server receives.

## Form elements

| Element | Purpose |
|---------|---------|
| `<input>` | Single-line field of many types (see [Input types and validation](../08-input-types-and-validation/notes.md)) |
| `<label>` | Caption for a control |
| `<select>` + `<option>` (+ `<optgroup>`) | Drop-down or list box |
| `<textarea>` | Multi-line text |
| `<button>` | Clickable button |
| `<fieldset>` + `<legend>` | Group related controls with a caption |
| `<datalist>` | Suggestions for an `<input>` |
| `<output>` | Result of a calculation |

### `<label>`

```html
<label for="NameOfPlayer">Enter your Name</label>
<input type="text" id="NameOfPlayer" name="username" placeholder="Your Name" autofocus>
```

The label's `for` must equal the control's `id` **exactly** (ids are case-sensitive). Once linked:

- clicking the label focuses the input (or ticks the checkbox), giving a bigger click target;
- screen readers announce "Enter your Name, edit text" when the field is focused.

You can also wrap the control instead of using `for`/`id`:

```html
<label>Enter your Name <input type="text" name="username"></label>
```

### `<fieldset>` and `<legend>`

The `<fieldset>` element groups related data in a form, and `<legend>` defines a caption for the `<fieldset>`. The browser draws a box with the legend in its border. Screen readers announce the legend with the controls inside, which is especially important for groups of radio buttons or checkboxes.

```html
<fieldset>
    <legend>Personal details:</legend>
    ...
</fieldset>
```

Adding `disabled` to a `<fieldset>` disables every control inside it.

### `<select>` and `<option>`

```html
<label for="SelectGender">Select your Gender</label>
<select name="gender" id="SelectGender">
    <option value="">-- Please choose --</option>
    <option value="Male">Male</option>
    <option value="Female">Female</option>
    <option value="Others">Others</option>
</select>
```

- The `value` of the chosen `<option>` is submitted (the text is used if `value` is missing).
- `selected` on an option pre-selects it; `disabled` greys it out; `<optgroup label="...">` groups options.
- **`size`** sets the number of visible options, turning the drop-down into a list box.
- **`multiple`** allows choosing more than one value: hold Ctrl (Cmd on Mac) and click. Each chosen value is sent as a separate pair (`gender=Male&gender=Others`).

> **Note:** `multiple` is a boolean attribute, so the demo's `multiple="2"` is the same as plain `multiple`; the `2` does nothing. To show two rows, use `size="2"`.

### `<textarea>`

```html
<label for="about">Write about yourself</label>
<textarea name="About" id="about" cols="15" rows="10"></textarea>
```

- `rows` and `cols` set the visible height and width in lines and characters (CSS `width`/`height` is more common today).
- It has **no `value` attribute**: default text goes between the tags, and any whitespace there (including indentation) becomes part of the value.
- `maxlength`, `placeholder`, `required` and `readonly` work as on `<input>`.

### Submit and reset buttons

The `<input type="submit">` defines a button for submitting the form data to a form-handler: the server script named in the form's `action` attribute. `<input type="reset">` restores every control to its initial value.

```html
<input type="submit" id="Sub">         <!-- label text defaults to "Submit" -->
<input type="reset" value="Reset">
<button type="submit">Enroll now</button>
```

`<button>` can contain HTML (icons, `<strong>`), so it is usually preferred. Its default `type` inside a form is **`submit`**; write `type="button"` for buttons that should not submit.

> **Note:** Reset buttons are rarely used today: one accidental click wipes everything the user typed.

### Useful field attributes seen in the demo

| Attribute | Effect |
|-----------|--------|
| `placeholder` | Hint text shown while the field is empty. Not a replacement for a `<label>`. |
| `autofocus` | Focuses this field when the page loads (use on one field at most). |
| `required` | The field is mandatory; the form will not submit while it is empty. |
| `pattern` | Regular expression the value must match. |
| `inputmode` | Which virtual keyboard to show on phones. |

All the input attributes are explained in [Input types and validation](../08-input-types-and-validation/notes.md). There are many more input types and elements; see the links in the References.

## Validation

The browser validates the form before submitting: `required` fields must be filled, `type="email"`/`type="url"` must look right, numbers must respect `min`/`max`/`step`, and values must match `pattern`. CSS can style the state:

```css
input:invalid { border-color: red; }
input:valid   { border-color: green; }
```

> **Note:** Client-side validation is a convenience for the user, not security. Anyone can remove `required` in DevTools or send a request with Postman. Always validate again on the server (in a MERN app, in the Express route).

## Handling forms with JavaScript

To submit without a page reload, intercept the `submit` event:

```js
const form = document.querySelector("form");

form.addEventListener("submit", async (event) => {
    event.preventDefault();                  // stop the normal page navigation
    const data = new FormData(form);         // reads every named control
    console.log(Object.fromEntries(data));   // → { username: "Aman", DOB: "2004-05-01", ... }

    // A FormData body is sent as multipart/form-data
    await fetch("/api/register", { method: "POST", body: data });
});
```

On an Express server, `app.use(express.urlencoded({ extended: true }))` puts URL-encoded POST data (a normal HTML form submit) in `req.body`, GET data arrives in `req.query`, and `multipart/form-data` (file uploads, or a `FormData` body sent by `fetch`) needs a library such as `multer`. To send JSON instead, use `body: JSON.stringify(Object.fromEntries(data))` with a `Content-Type: application/json` header and `express.json()` on the server.

## `<br>` and `<hr>`

### `<br>` — line break

- Inserts a single line break.
- Useful for writing addresses or poems, where the line breaks are part of the content.
- It is an empty (void) tag, which means it has no end tag.
- Do not use several `<br>`s to create vertical space; use CSS `margin` instead. (The original W3Schools example above uses `<br>` between label and input only to keep the example short.)

### `<hr>` — horizontal rule

- Defines a **thematic break** in an HTML page (a change of topic or section) and is most often displayed as a horizontal line.
- Used to separate content (or define a change). The demo puts one between the fields and the submit button.
- Also a void element. Style it with CSS (`border`, `color`, `margin`), not the obsolete `size`/`width`/`noshade` attributes.

## Common Mistakes

These all appear in, or are easy to make with, the demo:

- **`for`/`id` mismatch** — the demo has `<label for="About">` but `<textarea id="about">`. Ids are case-sensitive, so the label is not connected: clicking it does nothing and screen readers do not announce it.
- **Pattern does not match the placeholder** — `pattern="[0-9]{3}-[0-9]{2}-[0-9]{3}"` expects `123-45-678`, but the placeholder suggests `123-123-1234`, which would be rejected. To accept the placeholder's format use `[0-9]{3}-[0-9]{3}-[0-9]{4}`.
- **`multiple="2"`** — `multiple` is boolean; use `size` for the number of visible rows.
- **`placeholder` on `type="date"`** — date pickers ignore it.
- **File upload without `enctype="multipart/form-data"`** — with the default encoding only the file *name* is sent, not the file. File uploads also need `method="post"`.
- **Missing `name`** — the field is silently left out of the submitted data.
- **Spaces in `name`** — `name="Select Gender"` works but arrives as `Select+Gender`; use `gender` or `select_gender`.
- **Placeholder used instead of a label** — it disappears as soon as the user types and is not reliably read by assistive technology.
- **`<button>` without `type` inside a form** — it submits the form, which surprises people who meant it for a JavaScript action.
- **Relying on client-side validation only** — always re-validate on the server.

## Key Takeaways

- `<form>` collects named controls and sends `name=value` pairs to `action` using `method` (default GET, to the current URL).
- GET puts data in the URL (bookmarkable, for reading/searching); POST puts it in the request body (for sensitive or changing data, and always with HTTPS).
- Only enabled controls **with a `name`** are submitted; the form's own `name` is just for JavaScript.
- Every control needs a `<label>` linked by `for`/`id` (case-sensitive) or by wrapping.
- Use `<fieldset>`/`<legend>` to group related fields; `select` + `option` for choices; `textarea` for multi-line text.
- File uploads need `method="post"` and `enctype="multipart/form-data"`.
- Built-in validation helps users; server-side validation protects the app.
- `<br>` is a line break inside content; `<hr>` is a thematic break; both are void elements.

## Interview Questions

### Junior (0–1 year)

**Q1. What is the difference between GET and POST for form submission?**
GET appends the data to the URL as a query string, so it is visible, bookmarkable, cached in history and limited by URL length; use it for searches and filters. POST sends the data in the request body, so it is not in the URL, can be large and can carry files; use it for logins, sign-ups and anything that changes data. GET is the default.

**Q2. What is submitted when this form is sent?**

```html
<form action="/search">
  <input type="text" id="q" value="html forms">
  <input type="text" name="lang" value="en">
  <button>Go</button>
</form>
```

Only `lang` is sent, so the browser goes to `/search?lang=en`. The first input has no `name`, so it is not submitted even though it has an `id` and a value.

**Q3. Why do we use `<label>`, and how do you connect it to an input?**
A label gives the control an accessible name that screen readers announce, and clicking it focuses or toggles the control. Connect it with `for` equal to the input's `id`, or wrap the input inside the `<label>`.

**Q4. What are `<fieldset>` and `<legend>` used for?**
`<fieldset>` groups related controls (for example "Personal details" or a set of radio buttons), and `<legend>` gives that group a caption. Browsers draw a border around the group, and screen readers announce the legend together with each control inside it.

**Q5. What is the default `type` of a `<button>` inside a form?**
`submit`. A plain `<button>Click</button>` inside a form submits it. Use `type="button"` for buttons that only run JavaScript, and `type="reset"` to reset the form.

**Q6. What is the difference between `placeholder` and `value`?**
`value` is the actual initial content of the field; it is submitted if the user does not change it. `placeholder` is only a grey hint shown while the field is empty and is never submitted.

**Q7. How do you let a user pick several options in a `<select>`?**
Add the boolean `multiple` attribute; users hold Ctrl/Cmd and click. Add `size` to control how many options are visible. Each selected option is submitted as a separate `name=value` pair with the same name.

### Mid-level (2–4 years)

**Q8. Is HTML5 validation (`required`, `pattern`, `type="email"`) enough to protect your backend?**
No. It only improves the user experience; anyone can bypass it by editing the DOM, disabling it with `novalidate`, or sending a request directly with curl or Postman. The server must validate and sanitise every field again (for example with a validation library in the Express route) and must enforce rules such as uniqueness that the browser cannot know.

**Q9. A file upload form sends only the file name to the server. What is wrong?**
The form is missing `enctype="multipart/form-data"` (and must use `method="post"`). With the default URL-encoded format, a file input contributes only its file name. On an Express server the multipart body then needs a parser such as `multer`.

**Q10. In the demo, clicking "Write about yourself" does not focus the textarea. Why?**
The label has `for="About"` but the textarea has `id="about"`. Ids and `for` values are case-sensitive, so they do not match and the label is not associated with any control. Change one so they match exactly (and note that the textarea's `name="About"` is unrelated to this).

**Q11. After submitting a POST form, refreshing the page shows "Confirm form resubmission" and can create duplicate orders. How do you prevent that?**
Use the Post/Redirect/Get pattern: the server handles the POST, then responds with a redirect (303 or 302) to a GET page such as `/orders/123`. Refreshing then repeats only the harmless GET. Additionally disable the submit button while a request is in flight and make the server operation idempotent (for example with a unique order token).

**Q12. How do you submit a form with JavaScript without reloading the page?**
Listen for the form's `submit` event (not the button's `click`, so Enter-key submits are caught too), call `event.preventDefault()`, build the payload with `new FormData(form)`, and send it with `fetch`. Keep the native validation by not adding `novalidate`, or call `form.reportValidity()` before sending.

**Q13. What makes a form accessible?**
Every control has a visible, programmatically linked `<label>`; related controls, especially radio groups, sit in a `<fieldset>` with a `<legend>`; placeholders are not used as labels; error messages are text (not only red borders) and are linked to the field with `aria-describedby`; required fields are marked with `required`; the whole form works with the keyboard in a logical tab order; and `autocomplete` tokens help users fill fields quickly.

### Senior (5+ years)

**Q14. Design the API of a reusable `TextField` component for a design system so that every form built with it is accessible and still works with native form submission.**
Keep it a thin wrapper around a real `<input>`. The component owns the wiring: a required `label` prop (enforced by the types) rendered as a real `<label for>`, an auto-generated id (`useId()` in React) unless one is passed, hint and error text rendered as elements whose ids go into `aria-describedby`, `aria-invalid="true"` while there is an error, and an error that is text, not only a red border.

Everything native passes straight through to the `<input>`: `name`, `type`, `autocomplete`, `inputMode`, `required`, `pattern`, `maxLength`, `defaultValue`, plus a forwarded `ref`. Do not rename `name` or swallow attributes, otherwise `FormData`, autofill, password managers and built-in validation silently break; support uncontrolled use (`defaultValue`), not only controlled. Widgets with no native equivalent (a combobox, a rating) must still take part in the form, through a hidden input or a form-associated custom element (see [Interactive elements and web components](../12-interactive-elements-and-web-components/notes.md)). Recommendation: the component guarantees the label and ARIA wiring, the consumer keeps full control of the native attributes.

**Q15. On a long checkout form, when should validation errors appear, and how do you merge server-side errors into the same UI?**
Timing matters as much as wording. Do not flag a field while the user is still typing in it for the first time; validate on blur or on the first submit attempt, then re-validate live while they correct it, so the error disappears as soon as it is fixed (`:user-invalid` follows the same idea). Messages say how to fix the problem ("Enter a date in the past"), not just "Invalid".

On a failed submit, show an **error summary** at the top (a heading and a list of links to each invalid field), move focus to it, and keep the inline message next to each field; this is the GOV.UK pattern and works well with screen readers. The server returns errors in the same shape as the client validator (for example `{ "errors": { "email": "This email is already registered" } }`), so they go through the same summary and inline rendering; errors that belong to no field (a declined card) go in a form-level alert. Never clear what the user typed, and do not disable the submit button to signal errors, because a disabled button explains nothing. Recommendation: one error shape for client and server, one presentation (inline + summary + focus), and validation timed to the user's progress.

**Q16. A 150-field insurance form in React lags on every keystroke. What is the likely cause and how do you fix it?**
Usually every input is controlled, with all values in one piece of state at the top of the form. Each keystroke updates that state and re-renders the whole tree, often re-running validation for every field, which shows up as slow interactions (poor INP). Confirm it with the React Profiler and the DevTools Performance panel before changing anything.

Fixes, roughly in order of impact: keep inputs **uncontrolled** and read the values with `new FormData(form)` on submit, since the DOM already stores them; or use a form library with field-level subscriptions so only the edited field re-renders (React Hook Form is built on uncontrolled inputs); validate only the field that changed and debounce expensive or async checks; split the form into steps or sections that mount when needed. Recommendation: for large forms, default to native uncontrolled inputs plus `FormData`, and make a field controlled only when its value drives other UI as the user types.

**Q17. Users report that their password manager does not offer to save or fill credentials on your login and sign-up pages. What do you check?**
Password managers rely on standard markup and heuristics. Check that there is a real `<form>` containing `<input type="password">` (not a text input masked with CSS), that fields have stable `name`/`id` values, and that they use the right `autocomplete` tokens: `username` and `current-password` on login, `new-password` on sign-up and password change (which also enables password generation), `one-time-code` for OTP fields. Do not set `autocomplete="off"` on these fields and do not block paste.

Multi-step "username first" flows break association, so include the username on the password step as well (a read-only or visually hidden field with `autocomplete="username"`). After a JavaScript login, navigate or update the URL so the manager can detect success. Recommendation: use the standard markup and tokens rather than fighting the heuristics, and test the flows with the browser's built-in manager and at least one third-party one.

## References
- [W3Schools: HTML form attributes](https://www.w3schools.com/html/html_forms_attributes.asp) — learn more about form attributes
- [W3Schools: HTML form elements](https://www.w3schools.com/html/html_form_elements.asp)
- [W3Schools Tryit: input without a name is not submitted](https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit_id)
- [Part 2 of these notes: the input tag](../08-input-types-and-validation/notes.md)
- [MDN: `<form>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form)
- [MDN: `<label>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label)
- [MDN: `<select>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select)
- [MDN: `<textarea>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea)
- [MDN: `<fieldset>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset)
- [MDN: `FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [GOV.UK Design System: Error summary](https://design-system.service.gov.uk/components/error-summary/)
- [web.dev: Sign-in form best practices](https://web.dev/articles/sign-in-form-best-practices)
