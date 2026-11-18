# Media, SVG, Canvas and Iframes

> HTML · Topic 9 · Demo: [index.html](index.html) · [iframe.html](iframe.html) · [Exercise/index.html](Exercise/index.html) · [Exercise/style.css](Exercise/style.css)

HTML can show rich content natively, with no plugins: `<video>` and `<audio>` play media files, `<svg>` draws scalable vector graphics, `<canvas>` gives JavaScript a bitmap to draw on, and `<iframe>` embeds a whole other web page, such as a YouTube player. This note covers how each one works, when to choose SVG, canvas or a plain image, and the iframe details that interviews probe: iframes as link targets, why some sites "refuse to connect", `sandbox` and cross-origin `postMessage`. `index.html` demos video, audio, SVG and a YouTube embed, `iframe.html` uses an iframe as a link target, and the exercise builds a small "Vibe" media-player page from all of them.

## `<video>`

```html
<video src="video.mp4" height="255" controls loop muted poster="download.jpg"></video>
```

| Attribute | Effect |
|-----------|--------|
| `src` | The video file |
| `controls` | Shows the browser's play/pause, timeline, volume and fullscreen controls. Without it there is no way for the user to play the video (unless you build controls with JavaScript). |
| `autoplay` | Starts playing as soon as possible. Usually blocked unless `muted` is also set (see below). |
| `muted` | Starts with the sound off |
| `loop` | Restarts from the beginning when it ends |
| `poster` | Image shown before the video plays (the demo uses `download.jpg`) |
| `width`, `height` | Display size in pixels. The demo sets only `height="255"`; the width follows the video's aspect ratio. |
| `preload` | `none` (download nothing until play), `metadata` (only duration/size), `auto` (browser may download the whole file) |
| `playsinline` | On iPhones, plays inside the page instead of switching to fullscreen |

All of these except `src`, `width`, `height`, `poster` and `preload` are **boolean** attributes: writing the name turns them on.

### Several formats, fallback text and captions

```html
<video controls width="640" height="360" poster="download.jpg">
    <source src="video.webm" type="video/webm">
    <source src="video.mp4" type="video/mp4">
    <track src="captions-en.vtt" kind="captions" srclang="en" label="English" default>
    Your browser does not support the video tag.
</video>
```

- The browser plays the **first** `<source>` it supports; `type` lets it skip unsupported files without downloading them.
- The text inside is shown only by browsers that do not support `<video>` at all.
- `<track>` adds captions or subtitles from a WebVTT (`.vtt`) file. Captions are essential for deaf users and for anyone watching without sound.

## `<audio>`

```html
<audio src="sachin.mp3" controls autoplay loop muted></audio>
```

`<audio>` takes the same attributes as `<video>` except the visual ones (`poster`, `width`, `height`). Without `controls`, an audio element is **invisible**.

In the demo the audio has `autoplay` and `muted` together, so it starts playing silently and the user has to unmute it. Without `muted`, the browser would most likely block the autoplay.

### Common formats

| Type | Format | Notes |
|------|--------|-------|
| Video | MP4 (H.264 + AAC) | Plays everywhere; the safe default |
| Video | WebM (VP9 / AV1) | Smaller files; supported by all modern browsers |
| Audio | MP3 | Plays everywhere |
| Audio | AAC / M4A, Ogg / Opus | Good quality at small sizes |
| Audio | WAV | Uncompressed, very large; avoid on the web |

## Autoplay rules

Browsers block media that would start making **sound** on its own, because unexpected noise is a terrible experience.

- **Muted autoplay is allowed**: `autoplay muted` (and `playsinline` for iPhones) works for background videos.
- **Autoplay with sound** is normally allowed only after the user has interacted with the site (a click or tap), or on sites the user frequently plays media on.
- From JavaScript, `media.play()` returns a Promise that is **rejected** when playback is blocked, so handle it:

```js
const audio = document.querySelector("#audio_music");
audio.play().catch(() => {
    console.log("Autoplay blocked: show a play button instead");
});
```

### Controlling media with JavaScript

```js
const video = document.querySelector("video");
video.play();               // start
video.pause();              // pause
video.currentTime = 30;     // jump to 0:30
video.volume = 0.5;         // 0.0 to 1.0
video.muted = false;
video.addEventListener("ended", () => console.log("Finished"));
```

## SVG: Scalable Vector Graphics

SVG describes images as **shapes** (lines, circles, paths) instead of pixels, so it stays perfectly sharp at any size and is often tiny in file size. It is ideal for logos, icons and illustrations.

```html
<svg height="100" width="100">
    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>
```

| Attribute | Meaning |
|-----------|---------|
| `cx`, `cy` | Centre of the circle (50, 50 = middle of the 100 x 100 box) |
| `r` | Radius (40) |
| `stroke`, `stroke-width` | Outline colour and thickness |
| `fill` | Inside colour |

The demo shows the same red circle twice: once **inline** in the HTML, and once from a file with `<img src="img.svg" alt="My Svg Image">`. A standalone `.svg` file needs `xmlns="http://www.w3.org/2000/svg"` on its root (as `img.svg` has); inline SVG inside HTML does not.

| | Inline `<svg>` | `<img src="file.svg">` |
|-|----------------|------------------------|
| Style parts with page CSS (`circle { fill: blue; }`) | Yes | No |
| Animate / change with JavaScript | Yes | No |
| Cached separately by the browser | No (part of the HTML) | Yes |
| Best for | Icons that change colour on hover, interactive graphics | Logos and illustrations used as plain images |

## `<canvas>`: a bitmap you draw with JavaScript

`<canvas>` creates a blank rectangular drawing surface (a bitmap) that you draw on with **JavaScript**. Its demo lives on the [entities and code demo page](../03-text-quotes-entities-code/index.html), which only creates the canvas and gives it a border in `style.css`, so you see an empty 200 x 100 box. The fallback text below is not in the demo; it is added here because a canvas should always have one:

```html
<canvas id="myCanvas" width="200" height="100">
    Fallback text for browsers (and screen readers) that cannot show the canvas.
</canvas>
```

```css
canvas {
    border: 1px solid black;
}
```

Drawing on it:

```js
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");    // the 2D drawing API

ctx.fillStyle = "red";
ctx.fillRect(10, 10, 80, 50);           // x, y, width, height

ctx.beginPath();
ctx.arc(150, 50, 30, 0, Math.PI * 2);   // a circle: centre x, y, radius, start and end angle
ctx.stroke();
```

Canvas is **immediate mode**: once a shape is drawn, the canvas forgets it and keeps only pixels. To move the rectangle you clear the canvas and draw everything again; to know whether the user clicked the circle you do the maths yourself. SVG is the opposite (**retained mode**): every shape stays a DOM element you can style, animate and attach events to.

### Bitmap size vs CSS size (blurry canvases)

- The `width`/`height` **attributes** set the number of pixels in the bitmap (default 300 x 150).
- CSS `width`/`height` only **stretch** that bitmap on screen, so a 300 x 150 canvas displayed at `width: 100%` looks blurry or distorted.
- High-density screens (`devicePixelRatio` of 2 or 3 on phones) need 2–3 times more bitmap pixels than CSS pixels to look sharp.

```js
function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect(); // size in CSS pixels
    canvas.width = Math.round(width * dpr);                   // bitmap pixels
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                   // keep drawing in CSS pixels
    return ctx;
}
```

Setting `canvas.width` or `canvas.height` clears the bitmap and resets the context state, so redraw after every resize (a `ResizeObserver` on the canvas is the usual trigger).

### Canvas and accessibility

A canvas is just pixels: there are no elements inside to click, focus, style or read aloud. Screen readers see only what you provide:

- **Fallback content** between `<canvas>` and `</canvas>`. It is not painted, but it is exposed to assistive technology, so for a chart put a data table or a text summary there.
- **`role="img"` with an `aria-label`** for a static picture: `<canvas role="img" aria-label="Sales rose 20% from January to March">`.
- For an interactive canvas (a game, an editor), provide real HTML controls (`<button>`s) for every action.

### SVG, canvas or a raster image?

| | SVG | `<canvas>` | Raster image (PNG, JPEG, WebP, AVIF) |
|-|-----|------------|--------------------------------------|
| Model | Shapes kept as DOM elements | Pixels only; the canvas forgets the shapes | A fixed grid of pixels |
| Scaling | Sharp at any size | Must be redrawn for the new size and pixel ratio | Blurry when enlarged |
| Styling and events | CSS and DOM events per shape | Manual hit-testing in JavaScript | Whole image only |
| Accessibility | `<title>`, real text, ARIA on shapes | Fallback content or `aria-label` only | `alt` text |
| Gets slow with | Thousands of DOM nodes | Huge bitmaps, redrawing everything each frame | Large files |
| Best for | Icons, logos, illustrations, simple charts | Games, charts with many points, image editing, real-time animation | Photographs and complex imagery |

## `<iframe>`: embedding another page

An inline frame embeds **another HTML document inside the current one**. The framed page is a complete, separate document with its own scripts, styles and `window`; when it comes from another origin, the same-origin policy stops the two pages from reading each other's DOM.

```html
<iframe src="url" title="description"></iframe>
```

| Attribute | Purpose |
|-----------|---------|
| `src` | URL of the page to show |
| `srcdoc` | HTML to show directly instead of loading `src` |
| `title` | Describes the frame for screen readers. Always include it. |
| `name` | Name used as a target for links and forms |
| `width`, `height` | Size in pixels (default 300 x 150); use CSS for responsive sizes |
| `loading="lazy"` | Load only when the frame is near the viewport |
| `allow` | Grants browser features to the framed page (`autoplay`, `fullscreen`, `camera`, `clipboard-write`...) |
| `allowfullscreen` | Lets the framed page go fullscreen (older equivalent of `allow="fullscreen"`) |
| `sandbox` | Restricts what the framed page may do (scripts, forms, pop-ups...) |
| `referrerpolicy` | How much of your page's URL is sent to the framed site in the `Referer` header |

### Embedding a YouTube video

`index.html` embeds a YouTube video:

```html
<iframe width="560" height="315"
    src="https://www.youtube.com/embed/tVzUXW6siu0?si=NuQZuYqrMHn7Pg-i&amp;start=739"
    title="YouTube video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen></iframe>
```

- Get this code from YouTube: **Share → Embed** under the video. The `/embed/VIDEO_ID` URL is a page designed to be framed; a normal `youtube.com/watch` URL is not allowed in an iframe.
- `start=739` starts playback at 739 seconds (12:19). The `si=` parameter is added by YouTube's share dialog; the video plays without it.
- `&amp;` is the correct way to write `&` inside an attribute value; the browser turns it back into `&`.
- `title` describes the frame for screen-reader users, who otherwise hear only "frame".
- `allow` grants the embedded page specific browser features (autoplay, picture-in-picture...), and `allowfullscreen` lets it go fullscreen.
- `frameborder="0"` is obsolete; use CSS `border: none` instead.
- `loading="lazy"` delays loading an iframe until it is near the viewport, which helps performance a lot for heavy embeds such as YouTube players.

### An iframe as a link target

An iframe can be the target frame for a link: when a link's `target` matches the iframe's `name`, the link opens **inside the iframe** instead of replacing the whole page. The same works for forms (`<form target="iframe_a">`). `iframe.html` does this:

```html
<iframe src="../03-text-quotes-entities-code/text-formatting.html" name="iframe_a"
    height="300px" width="100%" title="Iframe Example"></iframe>
<p><a href="https://www.youtube.com/" target="iframe_a">Youtube.com</a></p>
```

The iframe first shows the text-formatting demo page from [Text, quotations, entities and code](../03-text-quotes-entities-code/notes.md). Clicking "Youtube.com" tries to load YouTube inside it, and that fails (next section). The `mailto:` link at the bottom of `iframe.html` is explained in the same note.

> **Note:** The `width`/`height` attributes should be plain pixel numbers (`height="300"`). Browsers tolerate `"300px"` and `"100%"`, as in `iframe.html`, but strictly valid HTML uses numbers and leaves percentages to CSS.

### "Refused to connect": sites that forbid framing

After clicking the link in `iframe.html`, the frame shows an error such as **"www.youtube.com refused to connect"**. That is not a bug in the page: YouTube (like Google, banks and most large sites) sends a response header that forbids other sites from framing it. The same happens to the commented-out iframe in `index.html` that tries to frame a whole CodeWithHarry tutorial page.

The reason is **clickjacking**: an attacker frames your site invisibly on top of a harmless-looking page and tricks users into clicking real buttons ("Delete account", "Transfer") in your site, with their logged-in session. Sites protect themselves with these headers:

```http
Content-Security-Policy: frame-ancestors 'self' https://partner.example.com
X-Frame-Options: SAMEORIGIN
```

| Header | Notes |
|--------|-------|
| `Content-Security-Policy: frame-ancestors` | The modern control. Takes a list of origins (`'none'`, `'self'`, specific sites). When both headers are present, browsers follow `frame-ancestors`. It only works as an HTTP header, not in a `<meta>` CSP. |
| `X-Frame-Options` | The older header: `DENY` or `SAMEORIGIN` only. Still sent for old browsers. |

To show content from such sites, use their official embed URLs (YouTube's `/embed/`) or simply link to them in a new tab.

### `sandbox`: restricting an embedded page

An empty `sandbox` attribute puts the framed page in a strict jail: it is treated as a unique ("opaque") origin with no access to its own cookies or storage, and it cannot run scripts, submit forms, open pop-ups or navigate your page. You re-enable only what it needs with tokens:

```html
<!-- Untrusted HTML that must not run any code -->
<iframe sandbox srcdoc="<p>User-written comment preview</p>" title="Comment preview"></iframe>

<!-- A code playground's output: scripts run, but in an opaque origin -->
<iframe sandbox="allow-scripts" src="https://playground.example.com/run/42" title="Code output"></iframe>
```

| Token | Re-enables |
|-------|------------|
| `allow-scripts` | JavaScript |
| `allow-forms` | Form submission |
| `allow-popups` | `window.open` and `target="_blank"` links |
| `allow-same-origin` | Treating the content as its real origin (cookies, storage) |
| `allow-top-navigation-by-user-activation` | Navigating your page, but only after a user click |
| `allow-modals` | `alert()`, `confirm()`, `prompt()` |
| `allow-downloads` | Downloads |

> **Note:** Never combine `allow-scripts` and `allow-same-origin` for content served from **your own origin**: the framed script can then reach into the parent, remove the `sandbox` attribute and reload itself unrestricted.

### Talking across origins with `postMessage`

A parent page and a cross-origin iframe cannot touch each other's DOM. They talk by sending messages:

```js
// Parent page on https://app.example.com
const frame = document.querySelector("iframe");
frame.addEventListener("load", () => {
    frame.contentWindow.postMessage({ type: "theme", value: "dark" }, "https://widget.example.com");
});

window.addEventListener("message", (event) => {
    if (event.origin !== "https://widget.example.com") return; // ignore everyone else
    console.log(event.data);                                    // → { type: "resize", height: 480 }
});
```

```js
// Inside the iframe on https://widget.example.com
window.parent.postMessage({ type: "resize", height: document.body.scrollHeight }, "https://app.example.com");
```

- The **sender** passes an exact `targetOrigin`, not `"*"`, so the data is not delivered if the frame has navigated to another site.
- The **receiver** checks `event.origin` (and the shape of `event.data`) before trusting anything; any page that holds a reference to your window can post to it.
- A sandboxed frame without `allow-same-origin` has the origin `"null"`; check `event.source === frame.contentWindow` instead.

### A responsive 16:9 embed

```css
iframe {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    border: none;
}
```

## Quick quiz and the exercise

**Quick quiz:** Create a website that shows videos of different categories and audios of different categories. You can use YouTube videos in an iframe using YouTube's embedding feature.

The solution is in [Exercise/index.html](Exercise/index.html): a "Vibe - A media player" page with a Spotify-style logo (`<img>`), a list of categories (Audio, Offline Video, YouTube), an `<audio>` player, a `<video>` player and a YouTube `<iframe>`. Its `style.css` makes the title bold (`#Main_Name`) and the section headings cursive (`.underline`).

Things worth improving in it, as practice:

- `<label for="">` is not connected to anything; a label needs `for` matching a control's `id` (or use a `<p>` for plain text).
- The `<div>` before the audio player is never closed.
- `video copy.mp4` contains a space; it works locally, but file names without spaces (`video-copy.mp4`) avoid URL-encoding problems.
- The text inside `<audio>` ("lappu sachin") is fallback content, shown only by browsers that cannot play audio.
- The class name `.underline` sets a cursive font and no underline; name classes after what they do (`.section-title`).

## Common Mistakes

- **Forgetting `controls`** — the video shows only its poster or first frame and the user has no visible way to play it; an audio element is completely invisible.
- **`autoplay` without `muted`** — silently blocked by browsers.
- **Using a `youtube.com/watch?v=...` URL in an iframe** — refused by YouTube; use the `/embed/` URL from the Share → Embed dialog.
- **No `title` on iframes, no captions on videos** — accessibility failures.
- **Huge, unoptimised video files** — compress them, use `preload="none"` or `metadata` for videos below the fold, and always provide a `poster`.
- **Missing `width`/`height` (or `aspect-ratio`) on video and iframes** — causes layout shift (CLS) when they load.
- **Missing `xmlns` in a standalone `.svg` file** — the image does not display when loaded with `<img>`.
- **Sizing a canvas with CSS only** — the bitmap is stretched and blurry; set `canvas.width`/`height` (times `devicePixelRatio`) and redraw on resize.
- **A canvas with no text alternative** — screen readers get nothing; add fallback content or `role="img"` with `aria-label`.
- **Trying to frame sites that forbid it** — "refused to connect" is their clickjacking protection; use the official embed URL or a plain link.
- **`sandbox="allow-scripts allow-same-origin"` on same-origin content** — the frame can remove its own sandbox.
- **`postMessage(data, "*")`, or a `message` listener that never checks `event.origin`** — leaks data to, or accepts commands from, any page.

## Key Takeaways

- `<video>` and `<audio>` play media natively; add `controls` so users can operate them.
- `autoplay` only works reliably together with `muted` (plus `playsinline` on iPhones); `play()` returns a Promise that rejects when blocked.
- Use `<source>` elements for multiple formats, `<track>` for captions and `poster` for a preview image.
- SVG is vector graphics kept as DOM shapes: inline `<svg>` can be styled and scripted, `<img src="x.svg">` is cached and simpler.
- `<canvas>` is a JavaScript-drawn bitmap: size it with the `width`/`height` attributes (times `devicePixelRatio`), redraw on resize, and give it a text alternative.
- `<iframe>` embeds a separate document; always give it a `title`, consider `loading="lazy"`, and use YouTube's `/embed/` URL. A link whose `target` equals the iframe's `name` opens inside it.
- Sites block being framed with `frame-ancestors` / `X-Frame-Options` to prevent clickjacking; that is a security feature, not a bug in your code.
- `sandbox` limits untrusted frames; `postMessage` with an exact `targetOrigin` and an `event.origin` check is the only safe way to talk across origins.

## Interview Questions

### Junior (0–1 year)

**Q1. How do you add a video with play/pause controls to a page?**
Use the `<video>` element with `src` and the `controls` attribute: `<video src="clip.mp4" controls width="640" height="360"></video>`. For several formats, put `<source>` elements inside instead of `src`.

**Q2. What does the `poster` attribute do?**
It sets an image that is displayed before the video starts playing (or while it loads). Without it, the browser shows the first frame, or a blank box if `preload="none"`.

**Q3. Why does `autoplay` often not work, and how do you make a background video autoplay?**
Browsers block autoplay with sound until the user has interacted with the site. A video that is `muted` is allowed to autoplay, so use `autoplay muted loop playsinline` (`playsinline` keeps iPhones from switching to fullscreen).

**Q4. How do you support browsers that cannot play a particular format?**
List several `<source>` elements with `type` attributes inside `<video>` or `<audio>`. The browser picks the first one it can play and skips the rest without downloading them. Text placed after the sources is shown only if the element is not supported at all.

**Q5. How do you embed a YouTube video on your site?**
Click Share → Embed on YouTube and copy the `<iframe>` code, which uses a `https://www.youtube.com/embed/VIDEO_ID` URL. Add a `start=` parameter to begin at a given second, and keep a descriptive `title` attribute.

**Q6. What is the difference between inline `<svg>` and `<img src="image.svg">`?**
Inline SVG becomes part of the page's DOM, so CSS and JavaScript can style and animate individual shapes. An SVG loaded with `<img>` behaves like any image: it is cached separately and is simpler, but its internals cannot be styled from the page.

**Q7. How do you make a link open inside an iframe on the same page?**
Give the iframe a `name` and set the link's `target` to that name: `<iframe name="preview" title="Preview"></iframe>` and `<a href="page.html" target="preview">Open</a>`. `iframe.html` does exactly this with `name="iframe_a"`.

### Mid-level (2–4 years)

**Q8. A hero background video autoplays on desktop Chrome but not on an iPhone, and the console shows "play() failed because the user didn't interact with the document first". How do you debug and fix it?**
Make sure the video has `muted` (the attribute, not only `video.muted = true` set too late), `autoplay` and `playsinline`; iOS also refuses autoplay in Low Power Mode. Handle the Promise returned by `video.play()` and show a play button or the poster when it rejects. Do not try to work around the policy with sound.

**Q9. How do you make a video accessible?**
Provide captions with `<track kind="captions">` (WebVTT), audio descriptions or a transcript for important visual content, keep the native `controls` (keyboard accessible) or make custom controls real `<button>`s with labels, never autoplay with sound, and avoid flashing content. For iframes, add a meaningful `title`.

**Q10. How do media elements affect page performance, and what would you do about a page with several videos?**
Video files are large and can compete for bandwidth with critical resources. Use `preload="none"` or `metadata` for videos that are not immediately visible, always set a lightweight `poster`, compress and use efficient formats (WebM/MP4), set `width`/`height` to avoid layout shift, and lazy-load iframes with `loading="lazy"`. For YouTube, a "facade" (a thumbnail that loads the real player on click) saves a lot of JavaScript.

**Q11. How do you make an embedded iframe responsive at 16:9?**
Set `width: 100%`, `height: auto` and `aspect-ratio: 16 / 9` on the iframe (and `border: none`). Before `aspect-ratio` was widely supported, the trick was a wrapper with `padding-top: 56.25%` and an absolutely positioned iframe.

**Q12. In `iframe.html`, clicking a link targeted at the iframe shows "www.youtube.com refused to connect". Why, and how would you protect your own site the same way?**
YouTube's pages send `Content-Security-Policy: frame-ancestors` / `X-Frame-Options` headers that forbid being displayed in a frame on another origin, a defence against clickjacking; the browser respects them and shows an error inside the iframe. To show a video, use the official `/embed/` URL, or open the site in a new tab. To protect your own site, send `Content-Security-Policy: frame-ancestors 'self'` (or `'none'`, or a list of trusted partner origins) as an HTTP header, plus `X-Frame-Options: SAMEORIGIN` for old browsers.

**Q13. What does the `sandbox` attribute on an iframe do, and when do you use it?**
With an empty `sandbox` attribute, the framed page is treated as a unique origin and cannot run scripts, submit forms, open pop-ups, navigate the top window and so on. You then re-enable only what is needed with tokens such as `allow-scripts`, `allow-forms` or `allow-popups`, and grant browser features separately with `allow`. It is used to embed untrusted content such as user-generated HTML or third-party widgets. Combining `allow-scripts` with `allow-same-origin` for same-origin content lets the frame remove its own sandbox, so avoid that combination.

**Q14. How can a parent page and an iframe from another origin communicate?**
They cannot access each other's DOM because of the same-origin policy. They exchange messages with `window.postMessage(data, targetOrigin)` and listen with the `message` event. The receiver must check `event.origin` before trusting the data, and the sender should pass a specific `targetOrigin` rather than `"*"`.

**Q15. When would you use SVG, `<canvas>` or a raster image (PNG/JPEG/WebP)?**
Use SVG for logos, icons, illustrations and simple charts that must stay sharp and be styled or animated per shape. Use `<canvas>` for graphics drawn by JavaScript with many objects or per-pixel work, such as games, image editing or real-time charts with thousands of points. Use raster images for photographs and complex imagery.

**Q16. A canvas set to `width: 100%` in CSS looks blurry on a phone. Why, and how do you fix it?**
The bitmap size comes from the `width`/`height` attributes (default 300 x 150); CSS only scales that bitmap, and high-density screens need even more pixels. Set `canvas.width = canvas.clientWidth * devicePixelRatio` (and the same for height), scale the context with `ctx.scale(devicePixelRatio, devicePixelRatio)` or `setTransform`, and redraw when the size changes.

**Q17. How do you make canvas content accessible?**
Canvas output is only pixels, so screen readers see nothing. Put meaningful fallback content between the `<canvas>` tags (for a chart, a data table or a summary), or give it `role="img"` with an `aria-label`. For interactive canvases, provide equivalent keyboard-accessible HTML controls.

### Senior (5+ years)

**Q18. Marketing wants YouTube videos, a map and a chat widget on every product page. How do you keep performance, privacy and security under control when many teams add embeds?**
Every third-party iframe is a whole extra page: its own JavaScript, network requests and main-thread work, plus cookies and tracking. Load the real thing only when needed: a **facade** (a poster image with a play button, a static map image, a "Chat" button) that swaps in the iframe on click, `loading="lazy"` for anything below the fold, and space reserved with `aspect-ratio` so nothing shifts. Where consent rules apply, do not load tracking embeds before consent; YouTube's privacy-enhanced `youtube-nocookie.com` domain helps.

On the security side, keep an allow-list of embed origins in your CSP (`frame-src`), give each frame the least `allow` / `sandbox` permissions it needs and set `referrerpolicy`. Recommendation: forbid pasting raw embed codes; provide one shared `<Embed>` component that enforces `title`, dimensions, facade and consent, and let the CSP block anything that bypasses it. More on CSP in [Security: XSS, CSRF and CSP](../../04-browser-platform/04-security-xss-csrf-csp/notes.md).

**Q19. Your app must display untrusted content: user-written HTML email templates in one place, third-party plugins that run JavaScript in another. Sanitiser or iframe? Design it.**
If the content only needs **markup**, sanitise it (DOMPurify with a strict allow-list) and render it inline; it flows with the page and costs nothing extra, and a CSP is the second line of defence. If the content must **run code**, sanitising is the wrong tool: isolate it in an iframe served from a **separate registrable domain** (for example `usercontent.example-cdn.com`) with `sandbox="allow-scripts"` and no `allow-same-origin`, so it has an opaque origin and no access to your cookies, storage or DOM. The separate domain is defence in depth if someone later loosens the sandbox.

The parent and the plugin then talk through a small, versioned `postMessage` protocol: validate every message's shape, check `event.source === frame.contentWindow` (the origin is `"null"` for an opaque frame), never pass messages into `innerHTML` or `eval`, and never send secrets such as tokens into the frame. Recommendation: sanitise when you only need markup, isolate in a cross-origin sandboxed iframe when code must run, and design the message API as carefully as a public HTTP API.

**Q20. You are choosing the rendering technology for a charting library used by many dashboards: some charts have 50 points, some 200,000. SVG or canvas?**
SVG makes every mark a DOM node, which gives styling with CSS, DOM events and hit-testing for free, crisp text, per-shape `<title>`/ARIA and easy testing. The cost grows with the number of nodes: style, layout and memory, so beyond a few thousand marks updates and interactions become janky. Canvas draws everything into one bitmap and handles tens or hundreds of thousands of points, but you take on hit-testing (usually a spatial index), `devicePixelRatio` handling, redraws on resize, and all of the accessibility. WebGL is the next step for millions of points.

Libraries such as Apache ECharts expose both as a `renderer` option behind the same API. Recommendation: make the renderer an implementation detail; default to SVG for small charts, switch to canvas above a point threshold measured on a low-end target device, keep axes, labels, tooltips and focusable controls in an SVG/HTML overlay, consider `OffscreenCanvas` in a Worker for heavy redraws, and always ship an accessible data table or summary.

> **Note:** Related reading: [Web performance](../../04-browser-platform/05-web-performance/notes.md) for lazy loading and third-party cost.

## References
- [CodeWithHarry: HTML audio and video tags](https://www.codewithharry.com/tutorial/html-audio-video-tags/)
- [CodeWithHarry: HTML iframes](https://www.codewithharry.com/tutorial/html-iframes/)
- [CodeWithHarry: HTML canvas](https://www.codewithharry.com/tutorial/html-canvas/)
- [MDN: `<video>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video)
- [MDN: `<audio>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio)
- [MDN: `<track>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track)
- [MDN: `<svg>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/svg)
- [MDN: Canvas tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [MDN: `<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- [MDN: `Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [MDN: CSP `frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
- [web.dev: Best practices for using third-party embeds](https://web.dev/articles/embed-best-practices)
