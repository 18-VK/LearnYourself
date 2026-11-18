# SEO and Core Web Vitals

> HTML · Topic 10 · Demo: [index.html](index.html)

**SEO** (Search Engine Optimisation) is the practice of making pages easy for search engines to find, understand and rank. **Core Web Vitals** are three metrics Google uses to measure real users' experience of a page (loading speed, responsiveness and visual stability) and are one of its ranking signals. Good HTML is the foundation of both. This note covers how search engines process a page, the on-page tags in `<head>`, the three Core Web Vitals and how to measure them, and, in the Senior questions, monitoring, rendering strategy, faceted navigation and site migrations.

## How a search engine handles your page

1. **Crawl** — a bot (for example Googlebot) follows links and downloads your HTML.
2. **Index** — it reads the content and the tags (`<title>`, headings, text, `alt`, links) to work out what the page is about, and stores it.
3. **Rank** — when someone searches, it orders indexed pages by relevance and quality. Content quality and relevance matter most; links from other sites ("backlinks"), mobile-friendliness, HTTPS and page experience (including Core Web Vitals) are further signals.

SEO work is usually split into:

| Type | What it covers | Examples |
|------|----------------|----------|
| On-page | The content and HTML of the page | Title, meta description, headings, `alt` text, internal links |
| Technical | How easily the site can be crawled and how fast it is | `robots.txt`, `sitemap.xml`, canonical URLs, HTTPS, Core Web Vitals |
| Off-page | Signals from outside your site | Backlinks, mentions, reviews |

## On-page SEO in the HTML

The demo's `<head>`:

```html
<title>About - codeWithAman</title>
<meta name="description" content="The page is all about Aman..">
```

### `<title>`

- Shown in the browser tab and usually as the **blue clickable headline** in search results.
- Make it unique per page and descriptive; put the main topic first and the brand last, as the demo does ("About - codeWithAman").
- Search results cut off long titles (roughly 50–60 characters is a common guideline).

### Meta description

The meta description is a short summary of the page placed in `<head>`:

```html
<meta name="description" content="Aman is a MERN stack developer from Noida. Read about his projects, skills and how to get in touch.">
```

- Search engines often show it as the **snippet** under the title in results.
- It is **not a direct ranking factor**, but a clear, relevant description makes people more likely to click, and clicks are the point of ranking.
- Write a unique description per page, roughly 150–160 characters, that matches the page content and tells the reader what they get.
- Google may replace it with text from the page if it thinks that better matches the search query.

> **Note:** The demo's description, "The page is all about Aman..", is valid but too short and vague to help much. Also, `<meta name="keywords">` is ignored by Google and should not be relied on.

### The rest of the page

- **One `<h1>`** describing the main topic, then `<h2>`/`<h3>` in order. The demo uses `<h4>About Aman</h4>` as its only heading; for SEO and accessibility that should be an `<h1>`.
- **Semantic elements** (`<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`, see [Semantic HTML](../06-semantic-html/notes.md)) help crawlers find the main content.
- **Descriptive `alt` text** on images and **descriptive link text** ("Read the MERN roadmap" rather than "click here").
- **`lang` on `<html>`** and the **viewport meta tag**: Google indexes the mobile version of pages first.
- **Readable URLs**: `/blog/core-web-vitals` beats `/p?id=8231`.

### Other useful `<head>` tags

```html
<!-- The preferred URL when the same content is reachable at several URLs -->
<link rel="canonical" href="https://example.com/about">

<!-- Keep a page out of search results (it must still be crawlable to see this tag) -->
<meta name="robots" content="noindex">

<!-- Open Graph: the preview card when the link is shared on social media/chat apps -->
<meta property="og:title" content="About Aman">
<meta property="og:description" content="MERN developer, projects and contact details.">
<meta property="og:image" content="https://example.com/aman.jpg">
```

## Core Web Vitals

| Metric | Measures | Good | Needs improvement | Poor |
|--------|----------|------|-------------------|------|
| **LCP** — Largest Contentful Paint | Loading: when the biggest image or text block in the viewport has rendered | ≤ 2.5 s | 2.5–4 s | > 4 s |
| **INP** — Interaction to Next Paint | Responsiveness: delay between a click/tap/keypress and the next screen update, across the whole visit | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift | Visual stability: how much visible content unexpectedly moves | ≤ 0.1 | 0.1–0.25 | > 0.25 |

- A page "passes" when the **75th percentile** of real visits is in the "good" range for all three, measured separately for mobile and desktop.
- **INP replaced FID** (First Input Delay) as a Core Web Vital in March 2024. FID only measured the delay before the *first* interaction started being handled; INP covers the full latency of interactions throughout the visit. Older articles (including some linked below) may still mention FID.
- Supporting metrics that help diagnose the main three: **TTFB** (Time to First Byte, server speed) and **FCP** (First Contentful Paint).

### Improving LCP (loading)

- Serve HTML quickly: caching, a CDN, a fast server (low TTFB).
- Compress and correctly size images; use WebP/AVIF.
- Do **not** lazy-load the hero image; give it priority instead:

```html
<img src="hero.webp" alt="..." width="1200" height="600" fetchpriority="high">
```

- Reduce render-blocking CSS and JavaScript (`defer` scripts, keep critical CSS small).

### Improving CLS (visual stability)

- Always set `width` and `height` (or CSS `aspect-ratio`) on images, videos and iframes.
- Reserve space for ads, embeds and banners before they load.
- Do not insert content above existing content unless the user asked for it.
- Animate with `transform` instead of properties that change layout (`top`, `height`).
- Load web fonts so that the swap does not reflow the page (for example `font-display: optional`, or a fallback font with matching metrics).

### Improving INP (responsiveness)

- Break up long JavaScript tasks (over 50 ms) so the main thread can respond to input between them.
- Ship less JavaScript; defer what is not needed immediately.
- Keep event handlers short; do the heavy work later or in a Web Worker.
- Keep the DOM reasonably small; huge DOMs make every update slower.

### Measuring

| Tool | Data type | Notes |
|------|-----------|-------|
| PageSpeed Insights | Field + lab | Shows real-user (CrUX) data for the URL plus a Lighthouse run |
| Google Search Console (Core Web Vitals report) | Field | Groups URLs of your whole site by status |
| Lighthouse (Chrome DevTools) | Lab | Simulated load on your machine; great for debugging, but has no real INP |
| Chrome DevTools Performance panel | Lab/live | Shows live LCP, CLS and INP while you use the page |
| `web-vitals` JavaScript library | Field | Collect the metrics from your own users and send them to analytics |

**Lab data** is a controlled test run; **field data** (Real User Monitoring) comes from real visitors on real devices and networks. Google's ranking uses field data.

> **Note:** This note covers what the metrics mean for SEO. How the browser turns HTML into pixels and how to optimise loading in depth are covered in [Rendering pipeline](../../04-browser-platform/01-rendering-pipeline/notes.md) and [Web performance](../../04-browser-platform/05-web-performance/notes.md).

## Common Mistakes

- **Same title and description on every page** — search engines cannot tell pages apart; each page needs its own.
- **Heading levels picked for size** (an `<h4>` as the page's main heading, as in the demo) — weakens the page outline.
- **Lazy-loading the LCP image** — delays the most important paint.
- **Images without dimensions** — the classic cause of high CLS.
- **Blocking a page in `robots.txt` to keep it out of results** — robots.txt stops crawling, not indexing; a blocked URL can still appear if other sites link to it. Use `noindex` (and let the page be crawled).
- **Optimising only for the Lighthouse score** — a perfect lab score does not guarantee good field data on slower phones.
- **Keyword stuffing** — repeating keywords unnaturally hurts readability and can be treated as spam.

## Key Takeaways

- Search engines crawl, index and rank; clear, semantic HTML makes the first two easy.
- Every page needs a unique, descriptive `<title>` and meta description; the description affects clicks, not ranking directly.
- Use one `<h1>`, a logical heading order, meaningful `alt` text and descriptive links.
- Core Web Vitals: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, judged at the 75th percentile of real visits.
- INP replaced FID in March 2024.
- Biggest quick wins: optimised, correctly sized images with `width`/`height`; prioritise (never lazy-load) the hero image; `defer` scripts; less JavaScript.
- Measure with field data (PageSpeed Insights, Search Console) and debug with lab tools (Lighthouse, DevTools).

## Interview Questions

### Junior (0–1 year)

**Q1. What is SEO and why should a front-end developer care?**
SEO is optimising a site so search engines can crawl, understand and rank it well. Much of it depends on front-end work: correct `<title>` and meta tags, a sensible heading structure, semantic elements, `alt` text, crawlable links, mobile-friendly layout and fast loading.

**Q2. What is a meta description, and does it improve ranking?**
It is a `<meta name="description" content="...">` summary of the page that search engines often show as the snippet in results. It is not a direct ranking factor, but a relevant, compelling description increases the click-through rate. Google may rewrite it if the page text matches a query better.

**Q3. Name the three Core Web Vitals and what each measures.**
LCP (Largest Contentful Paint) measures loading, good at 2.5 s or less. INP (Interaction to Next Paint) measures responsiveness to user input, good at 200 ms or less. CLS (Cumulative Layout Shift) measures visual stability, good at 0.1 or less.

**Q4. How does HTML structure help SEO?**
Search engines use the `<title>`, headings and semantic elements to understand what a page is about and which part is the main content. `alt` text describes images, descriptive link text describes linked pages, and `lang` indicates the language.

**Q5. Does Google use `<meta name="keywords">`?**
No. Google has ignored the keywords meta tag for ranking for many years because it was widely abused. Relevant content, titles and headings matter instead.

**Q6. Why should every page have a unique `<title>`?**
The title is the main headline in search results and in browser tabs and bookmarks. Duplicate titles make it hard for users and search engines to distinguish pages and can cause the wrong page to rank for a query.

### Mid-level (2–4 years)

**Q7. A product page has an LCP of 4.5 s on mobile. How would you investigate and fix it?**
First identify the LCP element (PageSpeed Insights or the DevTools Performance panel) and break the time into server response, resource load delay, load time and render delay. Typical fixes: reduce TTFB with caching or a CDN; make the hero image smaller and in WebP/AVIF; make sure it is not lazy-loaded and is discoverable in the HTML, with `fetchpriority="high"` or a preload; and remove render-blocking CSS/JS by deferring scripts and trimming critical CSS.

**Q8. Users complain that they click the wrong button because the page jumps while loading. Which metric is this, and what are the usual causes?**
That is layout shift, measured by CLS. Usual causes are images, videos or iframes without dimensions, ads or embeds injected without reserved space, banners inserted above content, and web fonts swapping in with different metrics. Fix by setting `width`/`height` or `aspect-ratio`, reserving space with `min-height`, inserting new content below the viewport or in response to user action, and tuning font loading.

**Q9. What is the difference between INP and FID, and why did Google switch?**
FID measured only the input delay of the first interaction: the time before the event handler could start. INP measures the full latency (input delay, handler processing and the next paint) of interactions throughout the visit and reports roughly the worst one. INP reflects real responsiveness much better, so it replaced FID as a Core Web Vital in March 2024.

**Q10. Lighthouse gives your page 98, yet Search Console reports "Poor" Core Web Vitals. How is that possible?**
Lighthouse is lab data: one simulated load on one configuration, without real user interactions. Search Console uses field data from real Chrome users at the 75th percentile, including slow phones and networks, and pages behind interactions. Investigate with field data (PageSpeed Insights, CrUX, or the `web-vitals` library in your own analytics) and reproduce under similar conditions.

**Q11. What is a canonical tag and when do you need one?**
`<link rel="canonical" href="...">` tells search engines which URL is the preferred version when the same content is available at several URLs, for example with tracking parameters, sorting options, `http`/`https` or `www` variants. It consolidates ranking signals onto one URL and prevents duplicate-content confusion.

**Q12. You are building a React (MERN) single-page app. What SEO risks does client-side rendering bring, and how do you address them?**
With pure client-side rendering the initial HTML is almost empty and content appears only after JavaScript runs, which delays indexing, can hurt LCP, and leaves non-JavaScript crawlers and link-preview bots with nothing. Titles and meta tags must also change per route. Solutions are server-side rendering or static generation (for example with Next.js), pre-rendering important routes, and managing per-page `<title>`/meta tags, while keeping real `<a href>` links so crawlers can follow them.

**Q13. What is the difference between blocking a URL in `robots.txt` and adding `<meta name="robots" content="noindex">`?**
`robots.txt` `Disallow` stops compliant crawlers from fetching the page, but the URL can still be indexed (without its content) if other pages link to it. `noindex` lets the page be crawled but tells the search engine not to include it in results. To remove a page from results, use `noindex` and do not block it in `robots.txt`, otherwise the crawler never sees the tag.

### Senior (5+ years)

**Q14. Search Console shows your product pages dropping from "Good" to "Poor" Core Web Vitals. How do you investigate, and what do you put in place so you hear about the next regression first?**
Search Console and CrUX report the 75th percentile of Chrome users over a rolling **28-day** window, grouped by similar URLs, so by the time a group turns red the regression shipped days or weeks ago. Use your own field data to find it: the `web-vitals` library's attribution build reports the LCP element and its time breakdown, the interaction and script behind a slow INP (via Long Animation Frames in Chromium), and the element that caused the largest layout shift. Segment by page template, device class, country and release version, and line the change up with deploys and tag-manager changes, since a newly added third-party script is a common cause. Then reproduce it in the lab on a throttled low-end mobile profile and fix it.

To catch the next one early: send RUM data on every page view and alert on the p75 per template; add lab budgets to CI (Lighthouse CI scores, JavaScript bundle-size limits) as guardrails; give each template an owner; and put third-party tags through the same review as code. Recommendation: field data is the truth for SEO, so alert on your own RUM rather than waiting for Search Console, and use lab budgets to stop obvious regressions before release.

**Q15. A large site has marketing pages, a product catalogue, search results and a logged-in dashboard. How do you choose a rendering strategy per route with SEO in mind?**
Decide per route by asking "does this page need to rank or be shared as a link?". If yes, the first HTML response must contain the content.

| Route | Strategy | Why |
|-------|----------|-----|
| Marketing pages, docs, blog | Static generation (rebuilt on publish) | Fastest TTFB from a CDN; complete HTML for every crawler |
| Product and category pages | Server rendering with CDN caching, or incremental regeneration | Fresh prices and stock, complete HTML |
| Internal search results | Server rendering; most parameter combinations `noindex` | Useful to users, but endless thin variants waste crawl budget |
| Logged-in dashboard | Client-side rendering | No search value; not reachable by crawlers anyway |

Google renders JavaScript, but rendering is queued after crawling, and many other crawlers and link-preview bots (social cards, chat apps) do not run JavaScript at all; "dynamic rendering" (a separate pre-rendered version for bots) is a workaround Google no longer recommends. Server rendering also has a cost: the HTML paints early (good LCP) but hydrating a large bundle blocks the main thread and hurts INP, so budget it with smaller client bundles, islands or server components. Recommendation: HTML-first (static or server-rendered) for every route that must rank, client rendering only behind login, and hydration cost treated as part of the decision.

**Q16. An e-commerce site's faceted filters (colour, size, brand, price, sort) generate millions of URL combinations. How do you keep it crawlable without wasting crawl budget or creating duplicate content?**
Classify every URL pattern into one of three groups and enforce it in one routing/SEO layer, not page by page. **Indexable landing pages** are the facet combinations people actually search for ("red running shoes"): give them clean URLs, a unique title, `<h1>` and description, a self-referencing canonical, internal links and a place in the sitemap. **Crawlable but not indexed** pages (sort orders, price ranges, multi-select combinations) get a canonical to the base category or `noindex`. **Not crawlable** patterns (session or tracking parameters, endless combinations) are blocked in `robots.txt`, or the filters are rendered as form controls rather than `<a href>` links so they never create crawl paths. Pick one mechanism per pattern: a URL blocked in `robots.txt` cannot show its `noindex` or canonical tag.

Pagination needs real links: Google stopped using `rel="next"`/`rel="prev"` years ago, so give each page a crawlable `<a href="?page=2">` and its own canonical (do not canonicalise page 2 to page 1), and back infinite scroll with paginated URLs. Keep parameter order and casing consistent. Search Console's URL Parameters tool was retired in 2022, so all of this must live in your own markup and routing; watch the "Duplicate, Google chose different canonical than user" report and crawl stats. Recommendation: decide which facets deserve to rank, make those first-class pages, and keep everything else out of the index with one consistent rule per URL pattern.

**Q17. You are migrating a site to a new URL structure (or rewriting a server-rendered site as a single-page app). How do you avoid losing search traffic?**
Treat URLs as a public API. Before launch, crawl the old site and export the top landing pages and most-linked URLs from Search Console and analytics. Map every old URL **one-to-one** to its closest new equivalent with permanent redirects (301 or 308), avoid redirect chains, and keep the redirects for at least a year; redirecting everything to the home page is treated as a soft 404 and throws the ranking away. Keep content and metadata parity: titles, descriptions, headings, structured data, canonical and `hreflang` tags. Update internal links and the XML sitemap to the new URLs instead of relying on redirects, and use Search Console's Change of Address tool if the domain changes.

For a SPA rewrite, also check rendering parity: inspect the rendered HTML with Search Console's URL Inspection, keep real `<a href>` links, set the title and meta tags per route, and return a real 404 status for missing pages (a SPA that answers 200 to everything creates soft 404s). Launch section by section if you can, and watch 404s, crawl errors, rankings and Core Web Vitals for several weeks, because some fluctuation is normal. Recommendation: a complete redirect map, verified by crawling before and after launch, with parity of content, metadata and rendered HTML.

## References
- [Backlinko: Core Web Vitals](https://backlinko.com/hub/seo/core-web-vitals) — learn it from here
- [Moz: Meta description](https://moz.com/learn/seo/meta-description) — learn about the meta description here
- [web.dev: Web Vitals](https://web.dev/articles/vitals)
- [web.dev: Largest Contentful Paint (LCP)](https://web.dev/articles/lcp)
- [web.dev: Interaction to Next Paint (INP)](https://web.dev/articles/inp)
- [web.dev: Cumulative Layout Shift (CLS)](https://web.dev/articles/cls)
- [MDN: `<meta>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta)
- [GitHub: `web-vitals` library](https://github.com/GoogleChrome/web-vitals)
- [Google Search Central: Pagination and incremental page loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
- [Google Search Central: Site moves with URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
